import { Context } from "grammy";
import InvestmentService from "../services/investment.js";
import UserService from "../services/user.js";
import PackageService from "../services/package.js";
import logger from "../config/logger.js";
import {
  formatCurrency,
  formatDate,
  getUserDisplayName,
  calculateMaturityDate,
} from "../lib/helpers.js";
import { adminMenuKeyboard } from "../utils/keyboard.js";
import prisma from "../db/client.js";

type SessionContext = Context & { session: any };

/**
 * Enhanced investment management - view all investments with options
 */
export async function handleManageAllInvestments(ctx: SessionContext): Promise<void> {
  // Clear any previous workflow state to prevent interference
  delete ctx.session.addPackageStep;
  delete ctx.session.addPackageData;
  delete ctx.session.editPackageId;
  delete ctx.session.editPackageStep;
  delete ctx.session.editPackageField;
  delete ctx.session.announcementStep;
  delete ctx.session.announcementTitle;
  delete ctx.session.announcementMessage;
  delete ctx.session.announcementTarget;
  delete ctx.session.targetUserIds;

  const page = ctx.session.allInvestmentPage || 1;
  const limit = 5;
  const offset = (page - 1) * limit;

  try {
    const investments = await prisma.investment.findMany({
      skip: offset,
      take: limit,
      include: { user: true, package: true },
      orderBy: { createdAt: "desc" },
    });

    const count = await prisma.investment.count();
    const totalPages = Math.ceil(count / limit);

    if (investments.length === 0) {
      await ctx.reply(
        `<b>💰 Investment Management</b>\n\n
No investments found.\n\n
Options:
• Add Manual Investment\n\n
Use /add_investment to add a new manual investment.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "➕ Add Investment", callback_data: "add_investment_start" }],
              [{ text: "🔙 Back to Dashboard", callback_data: "back_to_admin" }],
            ],
          },
        }
      );
      return;
    }

    let message = `<b>💰 All Investments (${count} total) - Page ${page}/${totalPages}</b>\n\n`;

    for (const inv of investments) {
      message += `<b>${inv.package.icon} ${inv.package.name}</b>\n`;
      message += `User: ${getUserDisplayName(inv.user)}\n`;
      message += `Amount: ${formatCurrency(inv.amount)}`;
      if (inv.roiPercentage) message += ` | ROI: ${inv.roiPercentage}%`;
      message += `\n`;
      message += `Status: <b>${inv.status}</b>\n`;
      message += `Created: ${formatDate(inv.createdAt)}\n`;
      message += `ID: <code>${inv.id}</code>\n\n`;
    }

    ctx.session.allInvestmentPage = page;

    const paginationRow = [];
    if (page > 1) paginationRow.push({ text: "⬅️ Prev", callback_data: "all_inv_prev" });
    if (page < totalPages) paginationRow.push({ text: "Next ➡️", callback_data: "all_inv_next" });

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          ...(paginationRow.length > 0 ? [paginationRow] : []),
          [{ text: "➕ Add Investment", callback_data: "add_investment_start" }],
          [{ text: "🔙 Back to Dashboard", callback_data: "back_to_admin" }],
        ],
      },
    });
  } catch (error) {
    logger.error("Error fetching investments:", error);
    await ctx.reply("❌ Error loading investments", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Start adding new investment
 */
export async function handleAddInvestmentStart(ctx: SessionContext): Promise<void> {
  try {
    // Clear any previous workflow state
    delete ctx.session.addPackageStep;
    delete ctx.session.addPackageData;
    delete ctx.session.editPackageId;
    delete ctx.session.editPackageStep;
    delete ctx.session.editPackageField;
    delete ctx.session.announcementStep;
    delete ctx.session.announcementTitle;
    delete ctx.session.announcementMessage;
    delete ctx.session.announcementTarget;
    delete ctx.session.targetUserIds;

    const users = await UserService.getActiveUsers(10, 0);

    if (users.length === 0) {
      await ctx.reply("❌ No active users found to assign investments to.");
      return;
    }

    ctx.session.addInvestmentStep = "select_user";

    let message = `<b>➕ Add New Investment</b>\n\n
Select a user to assign the investment to:\n\n`;

    const keyboard = {
      inline_keyboard: users.map((user: any) => [
        {
          text: `${getUserDisplayName(user)} (${formatCurrency(user.totalInvested)})`,
          callback_data: `add_inv_user_${user.id}`,
        },
      ]),
    };

    keyboard.inline_keyboard.push([{ text: "🔙 Back", callback_data: "manage_all_investments" }]);

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error("Error starting investment creation:", error);
    await ctx.reply("❌ Error", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Select package for new investment
 */
export async function handleAddInvestmentSelectPackage(ctx: SessionContext, userId: string): Promise<void> {
  try {
    const user = await UserService.getUserById(userId);
    if (!user) {
      await ctx.reply("❌ User not found");
      return;
    }

    const packages = await PackageService.getActivePackages();

    if (packages.length === 0) {
      await ctx.reply("❌ No packages available");
      return;
    }

    ctx.session.addInvestmentData = { userId };
    ctx.session.addInvestmentStep = "select_package";

    let message = `<b>Adding Investment for ${getUserDisplayName(user)}</b>\n\nSelect Package:\n\n`;

    for (const pkg of packages) {
      message += `<b>${pkg.icon} ${pkg.name}</b> | ${formatCurrency(pkg.minAmount)}-${formatCurrency(pkg.maxAmount)} | ROI: ${pkg.roiPercentage}%\n`;
    }

    const keyboard = {
      inline_keyboard: packages.map((pkg: any) => [
        {
          text: `${pkg.icon} ${pkg.name}`,
          callback_data: `add_inv_package_${pkg.id}`,
        },
      ]),
    };

    keyboard.inline_keyboard.push([{ text: "🔙 Back", callback_data: "add_investment_start" }]);

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error("Error selecting package:", error);
    await ctx.reply("❌ Error", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Ask for investment amount
 */
export async function handleAddInvestmentAmount(ctx: SessionContext, packageId: string): Promise<void> {
  try {
    const pkg = await PackageService.getPackageById(packageId);
    if (!pkg) {
      await ctx.reply("❌ Package not found");
      return;
    }

    ctx.session.addInvestmentData!.packageId = packageId;
    ctx.session.addInvestmentStep = "enter_amount";

    await ctx.reply(
      `<b>Enter Investment Amount</b>\n\n
Package: ${pkg.icon} ${pkg.name}\n
Min: ${formatCurrency(pkg.minAmount)}\n
Max: ${formatCurrency(pkg.maxAmount)}\n\n
Type the amount (numbers only):`,
      {
        parse_mode: "HTML",
      }
    );
  } catch (error) {
    logger.error("Error asking for amount:", error);
    await ctx.reply("❌ Error", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Confirm and create investment
 */
export async function handleConfirmAddInvestment(
  ctx: SessionContext,
  amount: number
): Promise<void> {
  try {
    const { userId, packageId } = ctx.session.addInvestmentData;

    const user = await UserService.getUserById(userId);
    const pkg = await PackageService.getPackageById(packageId);

    if (!user || !pkg) {
      await ctx.reply("❌ Invalid user or package");
      return;
    }

    if (amount < pkg.minAmount || amount > pkg.maxAmount) {
      await ctx.reply(
        `❌ Amount must be between ${formatCurrency(pkg.minAmount)} and ${formatCurrency(pkg.maxAmount)}`
      );
      return;
    }

    const expectedReturn = amount + (amount * pkg.roiPercentage) / 100;
    const maturityDate = new Date();
    maturityDate.setDate(maturityDate.getDate() + pkg.duration);

    const message = `<b>✅ Confirm Investment</b>\n\n
User: ${getUserDisplayName(user)}\n
Package: ${pkg.icon} ${pkg.name}\n
Amount: ${formatCurrency(amount)}\n
ROI: ${pkg.roiPercentage}%\n
Expected Return: ${formatCurrency(expectedReturn)}\n
Duration: ${pkg.duration} days\n
Maturity Date: ${formatDate(maturityDate)}\n\n
Create this investment?`;

    ctx.session.addInvestmentData = { userId, packageId, amount, expectedReturn, maturityDate };
    ctx.session.addInvestmentStep = "confirm";

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Create", callback_data: "confirm_add_investment" },
            { text: "❌ Cancel", callback_data: "cancel_add_investment" },
          ],
        ],
      },
    });
  } catch (error) {
    logger.error("Error confirming investment:", error);
    await ctx.reply("❌ Error", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Create the investment
 */
export async function handleCreateInvestmentFinal(ctx: SessionContext): Promise<void> {
  try {
    const { userId, packageId, amount } = ctx.session.addInvestmentData || {};

    if (!userId || !packageId || !amount) {
      await ctx.reply("❌ Missing investment data", { reply_markup: adminMenuKeyboard });
      return;
    }

    const investment = await InvestmentService.createInvestment(userId, packageId, amount);

    const user = await UserService.getUserById(userId);

    if (!user) {
      await ctx.reply("❌ Error: User not found");
      return;
    }

    await ctx.reply(
      `✅ <b>Investment Created Successfully!</b>\n\n
User: ${getUserDisplayName(user)}\n
Amount: ${formatCurrency(amount)}\n
Status: ACTIVE\n\n
Investment ID: <code>${investment.id}</code>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "📊 Back to Investments", callback_data: "manage_all_investments" }]],
        },
      }
    );

    delete ctx.session.addInvestmentData;
    ctx.session.addInvestmentStep = undefined;
  } catch (error) {
    logger.error("Error creating investment:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`, { reply_markup: adminMenuKeyboard });
  }
}

/**
 * View pending deposits (awaiting payment confirmation)
 */
export async function handlePendingDeposits(ctx: SessionContext): Promise<void> {
  try {
    const page = ctx.session.pendingDepositPage || 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    // Get investments with PENDING or AWAITING_PAYMENT status
    const pendingDeposits = await prisma.investment.findMany({
      where: {
        status: {
          in: ["PENDING", "AWAITING_PAYMENT"],
        },
      },
      include: { user: true, package: true },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    });

    const count = await prisma.investment.count({
      where: {
        status: {
          in: ["PENDING", "AWAITING_PAYMENT"],
        },
      },
    });

    const totalPages = Math.ceil(count / limit);

    if (pendingDeposits.length === 0) {
      await ctx.reply(
        `<b>💳 Pending Deposits</b>\n\nNo pending deposits awaiting payment confirmation.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Back to Dashboard", callback_data: "back_to_admin" }],
            ],
          },
        }
      );
      return;
    }

    let message = `<b>💳 Pending Deposits (${count} total) - Page ${page}/${totalPages}</b>\n\n`;

    for (const deposit of pendingDeposits) {
      message += `<b>${deposit.package.icon} ${deposit.package.name}</b>\n`;
      message += `User: ${getUserDisplayName(deposit.user)}\n`;
      message += `Amount: ${formatCurrency(deposit.amount)}\n`;
      message += `Status: ${deposit.status === "PENDING" ? "🆕 PENDING" : "🕐 AWAITING_PAYMENT"}\n`;
      message += `Created: ${formatDate(deposit.createdAt)}\n`;
      message += `ID: <code>${deposit.id}</code>\n\n`;
    }

    ctx.session.pendingDepositPage = page;

    const keyboard: any = {
      inline_keyboard: [],
    };

    // Add pagination if needed
    const paginationRow = [];
    if (page > 1) paginationRow.push({ text: "⬅️ Prev", callback_data: "pending_deposit_prev_page" });
    if (page < totalPages) paginationRow.push({ text: "Next ➡️", callback_data: "pending_deposit_next_page" });
    if (paginationRow.length > 0) keyboard.inline_keyboard.push(paginationRow);

    // Add action buttons for each deposit
    for (const deposit of pendingDeposits) {
      keyboard.inline_keyboard.push([
        { text: `✅ Confirm ${formatCurrency(deposit.amount)}`, callback_data: `confirm_deposit_${deposit.id}` },
      ]);
    }

    keyboard.inline_keyboard.push([{ text: "🔙 Back to Dashboard", callback_data: "back_to_admin" }]);

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error("Error viewing pending deposits:", error);
    await ctx.reply("❌ Error loading pending deposits", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Manually confirm a pending deposit
 */
export async function handleConfirmDepositManually(ctx: SessionContext, investmentId: string): Promise<void> {
  try {
    const investment = await prisma.investment.findUnique({
      where: { id: investmentId },
      include: { user: true, package: true },
    });

    if (!investment) {
      await ctx.reply("❌ Investment not found");
      return;
    }

    if (investment.status !== "AWAITING_PAYMENT" && investment.status !== "PENDING") {
      await ctx.reply(
        `❌ This investment is not awaiting payment. Current status: ${investment.status}`
      );
      return;
    }

    // Calculate new maturity date from activation time
    const activationTime = new Date();
    const newMaturityDate = calculateMaturityDate(investment.package.duration, activationTime);

    // Update investment status to ACTIVE with activation timestamp and recalculated maturity date
    const updatedInvestment = await prisma.investment.update({
      where: { id: investmentId },
      data: {
        status: "ACTIVE",
        activatedAt: activationTime,
        maturityDate: newMaturityDate,
        paymentProofStatus: "VERIFIED",
        paymentVerifiedAt: new Date(),
      },
      include: { user: true, package: true },
    });

    logger.info(`✅ [MANUAL] Admin confirmed deposit manually for investment ${investmentId}`);

    // Notify the user about payment confirmation
    try {
      await ctx.api.sendMessage(
        Number(investment.user.telegramId),
        `✅ <b>Payment Confirmed!</b>\n\nYour payment has been verified by our team.\n\n<b>Investment Details:</b>\n📦 Package: ${investment.package.name}\n💰 Amount: ${formatCurrency(investment.amount)}\n💵 Expected Return: ${formatCurrency(investment.expectedReturn)}\n📅 Maturity Date: ${newMaturityDate.toLocaleDateString()}\n\n✨ Your investment is now <b>ACTIVE</b> and earning returns!\n\nUse <b>/portfolio</b> to view your investments.`,
        { parse_mode: "HTML" }
      );
      logger.info(`[NOTIFICATION] Manual confirmation notification sent to user ${investment.userId}`);
    } catch (error) {
      logger.error("Error notifying user of manual confirmation:", error);
    }

    // Show confirmation message to admin
    await ctx.answerCallbackQuery("✅ Deposit confirmed!");
    await ctx.reply(
      `✅ <b>Deposit Confirmed Successfully</b>\n\n<b>Investment Details:</b>\nUser: ${getUserDisplayName(investment.user)}\nPackage: ${investment.package.icon} ${investment.package.name}\nAmount: ${formatCurrency(investment.amount)}\nStatus: <b>ACTIVE</b>\n\nNotification sent to user.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "💳 Back to Pending Deposits", callback_data: "view_pending_deposits" }],
            [{ text: "🔙 Back to Dashboard", callback_data: "back_to_admin" }],
          ],
        },
      }
    );
  } catch (error) {
    logger.error("Error confirming deposit:", error);
    await ctx.answerCallbackQuery("❌ Error confirming deposit");
    await ctx.reply(`❌ Error: ${(error as Error).message}`, { reply_markup: adminMenuKeyboard });
  }
}
