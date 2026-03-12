import { Context } from "grammy";
import prisma from "../db/client.js";
import UserService from "../services/user.js";
import PackageService from "../services/package.js";
import InvestmentService from "../services/investment.js";
import EmailService from "../services/email.js";
import ReferralService from "../services/referral.js";
import PaymentAccountService from "../services/paymentAccount.js";
import TelegramNotificationService from "../services/telegramNotification.js";
import CurrencyService from "../services/currency.js";
import AboutService from "../services/about.js";
import { config } from "../config/env.js";
import logger from "../config/logger.js";
import { handleAdminPanel } from "./admin.js";
import {
  formatCurrency,
  formatDate,
  getUserDisplayName,
  calculateExpectedReturn,
  formatPaymentDetails,
} from "../lib/helpers.js";
import {
  mainMenuKeyboard,
  createPackageKeyboard,
  createAmountKeyboard,
  settingsKeyboard,
  securityKeyboard,
  confirmationKeyboard,
  createPaymentConfirmationKeyboard,
} from "../utils/keyboard.js";

type SessionContext = Context & { session: any };

/**
 * Start command
 */
export async function handleStart(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Main Menu / Start Screen by user ${ctx.session.userId}`);

  // Check if user is admin from session (already verified by middleware)
  if (ctx.session.isAdmin) {
    return handleAdminPanel(ctx);
  }

  // Fetch user for display purposes only
  const user = await UserService.getUserByTelegramId(BigInt(ctx.from!.id));

  if (!user) {
    await ctx.reply("❌ Failed to initialize user");
    return;
  }

  const about = await AboutService.getAbout();
  const platformName = about.platformName;

  // Use custom welcome text if set, otherwise use default
  const message = about.welcomeText 
    ? `${about.welcomeText}`
    : `👋 Welcome to ${platformName}, ${getUserDisplayName(user)}!

💼 Grow your wealth with our investment packages:
- 📊 Transparent packages with guaranteed ROI
- ✅ Professional management
- 🔒 Secure transactions
- 💰 Regular payouts

Choose an option below to get started:`;

  logger.info(`Welcome media config:`, {
    fileId: about.welcomeMediaFileId?.substring(0, 20),
    type: about.welcomeMediaType,
    hasFileId: !!about.welcomeMediaFileId,
  });

  // Send with media if available
  if (about.welcomeMediaFileId && about.welcomeMediaFileId.trim()) {
    try {
      logger.info(`Attempting to send media: ${about.welcomeMediaType}`);
      logger.info(`Media fileId: ${about.welcomeMediaFileId.substring(0, 20)}...`);
      
      if (about.welcomeMediaType === "video") {
        logger.info(`Sending video with full welcome message...`);
        await ctx.replyWithVideo(about.welcomeMediaFileId, {
          caption: message,
          parse_mode: "HTML",
        });
        logger.info(`✅ Video sent successfully`);
      } else if (about.welcomeMediaType === "animation") {
        logger.info(`Sending animation with full welcome message...`);
        await ctx.replyWithAnimation(about.welcomeMediaFileId, {
          caption: message,
          parse_mode: "HTML",
        });
        logger.info(`✅ Animation sent successfully`);
      } else {
        logger.info(`Sending photo with full welcome message...`);
        // Default to photo
        await ctx.replyWithPhoto(about.welcomeMediaFileId, {
          caption: message,
          parse_mode: "HTML",
        });
        logger.info(`✅ Photo sent successfully`);
      }
      
      // Send keyboard only
      await ctx.reply("📋 Choose an option:", {
        reply_markup: mainMenuKeyboard,
      });
    } catch (mediaErr) {
      logger.error("❌ Failed to send welcome media:", mediaErr);
      logger.warn("Falling back to text-only message");
      // Fallback to text if media fails
      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: mainMenuKeyboard,
      });
    }
  } else {
    logger.info(`No media fileId configured, sending text only`);
    // No media configured, send text only
    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard,
    });
  }
}

/**
 * View packages
 */
export async function handleViewPackages(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: View Packages`);
  const user = await UserService.getUserById(ctx.session.userId);

  // Check if user is registered
  if (!user || !user.firstName || !user.lastName || !user.email || !user.phoneNumber) {
    await ctx.reply(
      `❌ <b>Registration Required</b>\n\n
You must complete your profile before you can invest.

Let's get you registered! Please provide the following information:

1️⃣ Name
2️⃣ Email  
3️⃣ Phone Number

Let's start with your first name:`,
      {
        reply_markup: { remove_keyboard: true },
        parse_mode: "HTML",
      }
    );
    ctx.session.registrationStep = "firstName";
    return;
  }

  // Check if email is verified
  if (!user.emailVerified) {
    await ctx.reply(
      `⏳ <b>Email Verification Required</b>\n\n
You must verify your email before you can invest.

We've sent a verification email to: <code>${user.email}</code>

📧 <b>Please check your inbox and click the verification link.</b>

Once verified, you'll be able to invest immediately! 🚀`,
      {
        reply_markup: mainMenuKeyboard,
        parse_mode: "HTML",
      }
    );
    return;
  }

  const packages = await PackageService.getActivePackages();

  if (packages.length === 0) {
    await ctx.reply("❌ No packages available", {
      reply_markup: mainMenuKeyboard,
    });
    return;
  }

  let message = "<b>📦 Available Investment Packages</b>\n\n";

  for (const pkg of packages) {
    message += `<b>${pkg.icon} ${pkg.name}</b>\n`;
    message += `💰 ${formatCurrency(pkg.minAmount)} - ${formatCurrency(pkg.maxAmount)}\n`;
    message += `📈 ROI: ${pkg.roiPercentage}% | Duration: ${pkg.duration} days\n`;
    message += `⚠️ Risk: ${pkg.riskLevel}\n`;
    if (pkg.description) message += `📝 ${pkg.description}\n`;
    message += "\n";
  }

  const keyboard = createPackageKeyboard(packages);

  await ctx.reply(message, {
    reply_markup: keyboard,
    parse_mode: "HTML",
  });
}

/**
 * Handle package selection
 */
export async function handleSelectPackage(
  ctx: SessionContext,
  packageId: string
): Promise<void> {
  const user = await UserService.getUserById(ctx.session.userId);

  // Double-check email verification
  if (!user?.emailVerified) {
    await ctx.reply(
      `⏳ <b>Email Verification Required</b>\n\n
Please verify your email before investing.`,
      {
        reply_markup: mainMenuKeyboard,
        parse_mode: "HTML",
      }
    );
    return;
  }

  const pkg = await PackageService.getPackageById(packageId);

  if (!pkg) {
    await ctx.reply("❌ Package not found");
    return;
  }

  const message = `<b>${pkg.icon} ${pkg.name}</b>\n\n
📊 Investment Details:
• Amount: ${formatCurrency(pkg.minAmount)} - ${formatCurrency(pkg.maxAmount)}
• Duration: ${pkg.duration} days
• ROI: <b>${pkg.roiPercentage}%</b>
• Risk Level: ${pkg.riskLevel}
${pkg.description ? `• Info: ${pkg.description}` : ""}

💡 Example: Invest ${formatCurrency(pkg.minAmount)}, earn ${formatCurrency(
    calculateExpectedReturn(pkg.minAmount, pkg.roiPercentage)
  )}

Select an amount:`;

  const keyboard = createAmountKeyboard(pkg.minAmount, pkg.maxAmount, packageId);

  await ctx.reply(message, {
    reply_markup: keyboard,
    parse_mode: "HTML",
  });
}

/**
 * Handle amount selection
 */
export async function handleSelectAmount(
  ctx: SessionContext,
  packageId: string,
  amount: number
): Promise<void> {
  const user = await UserService.getUserById(ctx.session.userId);

  // Double-check email verification
  if (!user?.emailVerified) {
    await ctx.reply(
      `⏳ <b>Email Verification Required</b>\n\n
Please verify your email before investing.`,
      {
        reply_markup: mainMenuKeyboard,
        parse_mode: "HTML",
      }
    );
    return;
  }

  const pkg = await PackageService.getPackageById(packageId);

  if (!pkg) {
    await ctx.reply("❌ Package not found");
    return;
  }

  const expectedReturn = calculateExpectedReturn(amount, pkg.roiPercentage);
  const profit = expectedReturn - amount;

  const message = `<b>✅ Confirm Investment</b>\n\n
📦 Package: ${pkg.icon} ${pkg.name}
💰 Amount: ${formatCurrency(amount)}
📈 ROI: ${pkg.roiPercentage}%
💵 Expected Profit: ${formatCurrency(profit)}
💸 Total Return: ${formatCurrency(expectedReturn)}
📅 Duration: ${pkg.duration} days

👉 <b>Confirm this investment?</b>`;

  ctx.session.pendingInvestment = { packageId, amount };

  await ctx.reply(message, {
    reply_markup: confirmationKeyboard,
    parse_mode: "HTML",
  });
}

/**
 * Confirm investment
 */
export async function handleConfirmInvestment(ctx: SessionContext): Promise<void> {
  const { packageId, amount } = ctx.session.pendingInvestment || {};

  if (!packageId || !amount) {
    await ctx.reply("❌ Invalid investment data");
    return;
  }

  const user = await UserService.getUserById(ctx.session.userId);

  // Final check: email verification
  if (!user?.emailVerified) {
    await ctx.reply(
      `⏳ <b>Email Verification Required</b>\n\n
Please verify your email before investing.`,
      {
        reply_markup: mainMenuKeyboard,
        parse_mode: "HTML",
      }
    );
    return;
  }

  try {
    const investment = await InvestmentService.createInvestment(
      ctx.session.userId,
      packageId,
      amount
    );

    // Admin notification will be sent when payment is confirmed via webhook
    // Store investment data for payment flow
    ctx.session.currentInvestment = {
      investmentId: investment.id,
      packageName: investment.package.name,
      packageIcon: investment.package.icon,
      amount: investment.amount,
      packageDuration: investment.package.duration,
      expectedReturn: investment.expectedReturn,
      maturityDate: investment.maturityDate,
    };

    delete ctx.session.pendingInvestment;

    // Fetch enabled deposit cryptocurrencies from admin settings
    let availableCryptos: string[] = [];
    try {
      availableCryptos = await CurrencyService.getEnabledDepositCryptos();
    } catch (error) {
      logger.error("Failed to fetch deposit cryptocurrencies:", error);
      availableCryptos = ["USDT"]; // Default fallback
    }

    if (availableCryptos.length === 0) {
      await ctx.reply("❌ No cryptocurrencies are currently enabled for deposit. Please try again later.");
      return;
    }

    // Show merged crypto payment confirmation screen
    let message = `<b>💳 Confirm & Select Payment</b>\n\n`;
    message += `<b>Investment Summary:</b>\n`;
    message += `📦 Package: ${investment.package.icon} ${investment.package.name}\n`;
    message += `💵 Amount: ${formatCurrency(investment.amount)}\n`;
    message += `📅 Duration: ${investment.package.duration} days\n`;
    message += `📈 Expected Return: ${formatCurrency(investment.expectedReturn)}\n\n`;

    message += `<b>⏱️ Payment Window: 15 minutes</b>\n`;
    message += `Select your preferred cryptocurrency to proceed.\n`;
    message += `Payment will be confirmed instantly!\n\n`;

    message += `<b>🪙 Choose Cryptocurrency:</b>`;

    // Build keyboard with crypto options
    const keyboard: any = [];
    const cryptosPerRow = 2;

    for (let i = 0; i < availableCryptos.length; i += cryptosPerRow) {
      const row = availableCryptos.slice(i, i + cryptosPerRow).map((crypto) => ({
        text: crypto.toUpperCase(),
        callback_data: `select_crypto_${investment.id}_${crypto.toUpperCase()}`,
      }));
      keyboard.push(row);
    }

    // Add cancel button
    keyboard.push([
      {
        text: `❌ Cancel Investment`,
        callback_data: `cancel_investment_${investment.id}`,
      },
    ]);

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });

    logger.info(
      `Investment created: ${investment.id}, showing crypto payment screen`
    );
  } catch (error) {
    await ctx.reply(`❌ Failed to create investment: ${(error as Error).message}`);
  }
}

/**
 * View portfolio
 */
export async function handleViewPortfolio(ctx: SessionContext): Promise<void> {
  try {
    const { NotificationService } = await import(
      "../services/notification.js"
    );

    // Refresh user stats before displaying portfolio
    await UserService.updateUserStats(ctx.session.userId);

    const profile = await UserService.getUserProfile(ctx.session.userId);

    if (!profile) {
      await ctx.reply("❌ Profile not found");
      return;
    }

    // Get unread notification count
    const unreadCount = await NotificationService.countUnreadNotifications(
      profile.id
    );

    let message = `<b>📊 My Portfolio</b>\n\n`;

    // Show notification badge if there are unread notifications
    if (unreadCount > 0) {
      message += `🔔 <b>You have ${unreadCount} new notification${unreadCount !== 1 ? "s" : ""}</b>\n\n`;
    }

    message += `<b>Account Summary:</b>\n`;
    message += `💰 Total Invested: ${formatCurrency(profile.totalInvested)}\n`;
    message += `💵 Total Earned: ${formatCurrency(profile.totalEarned)}\n`;
    message += `🏦 Total Withdrawn: ${formatCurrency(profile.totalWithdrawn)}\n\n`;

    // Get pending withdrawals
    const pendingWithdrawals = await InvestmentService.getUserWithdrawals(
      profile.id,
      "PENDING",
      10,
      0
    );

    if (pendingWithdrawals.length > 0) {
      message += `<b>⏳ Pending Withdrawals:</b>\n`;
      for (const w of pendingWithdrawals) {
        message += `💸 ${formatCurrency(w.amount)} - Status: <b>Awaiting Approval</b>\n`;
      }
      message += `\n`;
    }

    const investments = await InvestmentService.getInvestmentsByUser(profile.id);
    const activeInvestments = investments.filter((inv: any) => inv.status === "ACTIVE");
    const maturedInvestments = investments.filter((inv: any) => inv.status === "MATURED");
    const completedInvestments = investments.filter((inv: any) => inv.status === "COMPLETED");
    
    // Check for pending withdrawal
    const hasPending = await InvestmentService.hasPendingWithdrawal(profile.id);
    const pendingWithdrawalDetails = hasPending ? await InvestmentService.getPendingWithdrawalDetails(profile.id) : null;
    
    // Show pending withdrawal warning
    if (hasPending && pendingWithdrawalDetails) {
      message += `<b>💼 Your Investment Portfolio</b>\n\n`;
      message += `⏳ <b>PENDING WITHDRAWAL</b>\n`;
      message += `Amount: ${formatCurrency(pendingWithdrawalDetails.amount)}\n`;
      message += `Status: ${pendingWithdrawalDetails.status}\n`;
      message += `Request ID: <code>${pendingWithdrawalDetails.id}</code>\n\n`;
      message += `⚠️ <i>You have a pending withdrawal. No new withdrawals can be made until this is completed.</i>\n\n`;
      message += `━━━━━━━━━━━━━━━\n\n`;
    }

    message += `<b>🔵 Active Investments: ${activeInvestments.length}</b>\n`;
    if (activeInvestments.length === 0) {
      message += "No active investments yet. Start investing now! 🚀\n";
    }

    if (maturedInvestments.length > 0) {
      message += `\n<b>🟢 Matured & Ready for Withdrawal: ${maturedInvestments.length}</b>\n`;
      for (const inv of maturedInvestments) {
        message += `  💰 ${inv.package.name} - ${formatCurrency(inv.amount + inv.totalProfit)} ready\n`;
      }
    }

    if (completedInvestments.length > 0) {
      message += `\n<b>✅ Completed Investments: ${completedInvestments.length}</b>\n`;
      for (const inv of completedInvestments) {
        message += `  ✓ ${inv.package.name} - Withdrawn: ${formatCurrency(inv.amount + inv.totalProfit)}\n`;
      }
    }

    await ctx.reply(message, {
      parse_mode: "HTML",
    });

    // Show investment buttons - ALL investments (active, matured, completed)
    const allInvestmentsWithButtons = [...activeInvestments, ...maturedInvestments, ...completedInvestments];
    if (allInvestmentsWithButtons.length > 0) {
      const { InlineKeyboard } = await import("grammy");
      const keyboard = new InlineKeyboard();

      // Active investments
      if (activeInvestments.length > 0) {
        keyboard.text("🔵 ACTIVE INVESTMENTS", "noop");
        keyboard.row();
        for (const inv of activeInvestments) {
          const statusEmoji = "🟢";
          keyboard.text(
            `${statusEmoji} ${inv.package.name} - ${formatCurrency(inv.amount)}`,
            `view_investment_${inv.id}`
          );
          keyboard.row();
        }
      }

      // Matured investments
      if (maturedInvestments.length > 0) {
        keyboard.text("🟢 MATURED (Ready to Withdraw)", "noop");
        keyboard.row();
        for (const inv of maturedInvestments) {
          keyboard.text(
            `✨ ${inv.package.name} - ${formatCurrency(inv.amount + inv.totalProfit)}`,
            `view_investment_${inv.id}`
          );
          keyboard.row();
        }
      }

      // Completed investments
      if (completedInvestments.length > 0) {
        keyboard.text("✅ COMPLETED", "noop");
        keyboard.row();
        for (const inv of completedInvestments) {
          keyboard.text(
            `✓ ${inv.package.name} - ${formatCurrency(inv.amount + inv.totalProfit)}`,
            `view_investment_${inv.id}`
          );
          keyboard.row();
        }
      }

      keyboard.text("🔙 Back", "back_to_menu");

      await ctx.reply("📊 All Your Investments:", {
        reply_markup: keyboard,
      });
    }
  } catch (error) {
    await ctx.reply(`❌ Failed to load portfolio: ${(error as Error).message}`);
  }
}

/**
 * Show investment details
 */
export async function handleShowInvestmentDetails(ctx: SessionContext, investmentId: string): Promise<void> {
  try {
    const trimmedId = investmentId.trim();
    logger.info(`[DETAILS] Loading investment: ${trimmedId}`);
    console.log(`[DETAILS-DEBUG] Received investmentId:`, {
      raw: investmentId,
      trimmed: trimmedId,
      length: trimmedId.length
    });
    
    const investment = await prisma.investment.findUnique({
      where: { id: trimmedId },
      include: { package: true, user: true }
    }) as any;

    if (!investment) {
      logger.error(`[DETAILS] Investment ${trimmedId} not found`);
      await ctx.reply("❌ Investment not found");
      return;
    }

    // Verify investment belongs to user
    if (investment.userId !== ctx.session.userId) {
      await ctx.reply("❌ You don't have access to this investment");
      return;
    }

    console.log(`[DETAILS-DEBUG] Found investment - creating button with ID:`, trimmedId);

    // Get tracking info for calculations
    const trackingInfo = await InvestmentService.getInvestmentWithTracking(trimmedId);

    let message = `<b>━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n`;
    message += `<b>${investment.package.icon} ${investment.package.name}</b>\n`;
    message += `<b>━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n\n`;

    message += `<b>💰 INVESTMENT DETAILS</b>\n`;
    message += `Principal Amount: ${formatCurrency(investment.amount)}\n`;
    message += `ROI Rate: ${investment.roiPercentage}%\n`;
    message += `Expected Return: ${formatCurrency(investment.expectedReturn)}\n`;
    message += `Total Profit: ${formatCurrency(investment.totalProfit)}\n`;
    message += `Duration: ${investment.package.duration} days\n\n`;

    message += `<b>📈 CURRENT STATUS</b>\n`;
    message += `Investment Status: <b>${investment.status}</b>\n`;
    if (trackingInfo) {
      message += `Current Value: ${formatCurrency(trackingInfo.currentValue)}\n`;
      message += `Accrued Profit: ${formatCurrency(trackingInfo.totalProfit || 0)}\n`;
      if (investment.status === "ACTIVE") {
        message += `Daily Profit: +${formatCurrency(trackingInfo.dailyProfit)}\n`;
        message += `Days Remaining: ${trackingInfo.daysRemaining} days\n`;
      }
    }
    message += `Created: ${new Date(investment.createdAt).toLocaleDateString()}\n`;
    message += `Maturity Date: ${new Date(investment.maturityDate).toLocaleDateString()}\n\n`;

    // Status-specific messages
    if (investment.status === "ACTIVE") {
      message += `<b>🔄 ACTIVE</b>\n`;
      message += `Investment is earning daily profit.\n`;
      message += `Full withdrawal available on maturity date.\n`;
    } else if (investment.status === "MATURED") {
      message += `<b>🟢 MATURED - READY FOR WITHDRAWAL</b>\n`;
      message += `Your investment has reached maturity!\n`;
      message += `Available to withdraw: ${formatCurrency(investment.amount + investment.totalAccruedProfit)}\n`;
      message += `(Principal + All Earned Profit)\n`;
    } else if (investment.status === "COMPLETED") {
      message += `<b>✅ COMPLETED</b>\n`;
      message += `This investment has been successfully withdrawn.\n`;
    } else {
      message += `<b>📋 ${investment.status}</b>\n`;
      message += `Investment is locked until maturity date.\n`;
      message += `Full withdrawal available on maturity.\n`;
    }

    await ctx.reply(message, {
      parse_mode: "HTML",
    });

    // Check for pending withdrawal
    const userId = ctx.session.userId;
    const hasPendingWithdrawal = await InvestmentService.hasPendingWithdrawal(userId);

    // Show withdrawal options
    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();

    // Withdraw investment button - only show for MATURED investments
    if (investment.status === "COMPLETED") {
      // Investment already fully withdrawn - no withdraw button
      keyboard.text("✅ Already Withdrawn", "noop");
      keyboard.row();
    } else if (investment.status === "MATURED") {
      if (hasPendingWithdrawal) {
        keyboard.text(
          `🔒 Withdraw (Pending Withdrawal Active)`,
          "has_pending_withdrawal"
        );
      } else {
        keyboard.text(
          `🏦 Withdraw Investment (${formatCurrency(investment.amount + investment.totalProfit)})`,
          `withdraw_investment_input_${trimmedId}`
        );
      }
      keyboard.row();
    } else {
      // Investment not yet matured
      keyboard.text(
        `⏱️ Withdraw Investment (Matures on ${new Date(investment.maturityDate).toLocaleDateString()})`,
        "investment_not_matured"
      );
      keyboard.row();
    }

    keyboard.text("🔙 Back to Portfolio", "view_portfolio");

    // Add live growth button for ACTIVE investments
    if (investment.status === "ACTIVE") {
      keyboard.row();
      keyboard.text("📈 View Live Growth", `view_live_growth_${trimmedId}`);
    }

    await ctx.reply("Choose action:", {
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error("Error showing investment details:", error);
    await ctx.reply(`❌ Failed to load investment details: ${(error as Error).message}`);
  }
}

/**
 * View live investment growth with real-time updates
 */
export async function handleViewLiveGrowth(ctx: SessionContext, investmentId: string): Promise<void> {
  try {
    const trimmedId = investmentId.trim();
    const userId = ctx.session.userId;
    const chatId = ctx.chat?.id;

    if (!chatId) {
      await ctx.reply("❌ Chat context not found");
      return;
    }

    const investment = await prisma.investment.findUnique({
      where: { id: trimmedId },
      include: { package: true, user: true }
    }) as any;

    if (!investment || investment.userId !== userId || investment.status !== "ACTIVE") {
      await ctx.reply("❌ Investment not found or not active");
      return;
    }

    // Get initial real-time values
    const initialRealTime = InvestmentService.calculateRealTimeValue(investment);
    
    // Store info for updating with fixed initial values
    const liveData = {
      investmentId: trimmedId,
      messageId: 0,
      updateCount: 0,
      displayValue: initialRealTime.currentValue,
      profitPerUpdate: initialRealTime.secondlyRate * 4,
      totalDailyRate: initialRealTime.dailyRate,
      chatId: chatId,
      startTime: Date.now(), // Track when live view started for update cycle progress
    };

    logger.info(`📈 Starting live growth view for investment: ${trimmedId}`);

    // Function to create the growth display message
    const createGrowthMessage = () => {
      const realTime = InvestmentService.calculateRealTimeValue(investment);
      
      // Increment the display value based on updates
      let currentDisplayValue = initialRealTime.currentValue + (liveData.updateCount * liveData.profitPerUpdate);

      // === MATURITY PROGRESS BAR ===
      const maturityProgress = Math.floor(realTime.percentComplete / 5); // 20 chars per 100%
      const maturityProgressBar = "█".repeat(maturityProgress) + "░".repeat(20 - maturityProgress);
      
      // === UPDATE CYCLE PROGRESS BAR ===
      // Calculate how far we are in the current 4-second cycle
      const timeSinceStart = Date.now() - liveData.startTime;
      const timeInCurrentCycle = (timeSinceStart % 4000) / 1000; // 0-4 seconds
      const cycleProgress = Math.floor((timeInCurrentCycle / 4) * 20); // 20 chars
      const cycleProgressBar = "█".repeat(cycleProgress) + "░".repeat(20 - cycleProgress);
      
      // Profit added this update (show with animation)
      const profitThisUpdate = liveData.profitPerUpdate;
      const updateIndicator = liveData.updateCount > 0 ? " ✨" : "";

      let msg = `<b>📈 INVESTMENT GROWTH (LIVE)</b>\n\n`;
      msg += `<b>💼 ${investment.package.name}</b>\n\n`;
      
      msg += `<b>💰 AMOUNTS</b>\n`;
      msg += `Principal: ${formatCurrency(investment.amount)}\n`;
      msg += `Accrued: ${formatCurrency(investment.totalAccruedProfit)}\n`;
      msg += `<b>Current Value: ${formatCurrency(currentDisplayValue)}</b>${updateIndicator}\n`;
      msg += `<i>${liveData.updateCount > 0 ? `(+${formatCurrency(profitThisUpdate)} this update)` : ""}</i>\n\n`;

      msg += `<b>📅 MATURITY PROGRESS</b>\n`;
      msg += `[${maturityProgressBar}] ${realTime.daysElapsed}/${realTime.totalDays} days\n`;
      msg += `Days Remaining: ${realTime.daysRemaining} day${realTime.daysRemaining !== 1 ? 's' : ''}\n\n`;

      msg += `<b>⚡ UPDATE CYCLE (Every 4 Seconds)</b>\n`;
      msg += `[${cycleProgressBar}] ${timeInCurrentCycle.toFixed(1)}/4 secs\n\n`;

      msg += `<b>📊 RATES</b>\n`;
      msg += `Daily Rate: +${formatCurrency(realTime.dailyRate)}/day\n`;
      msg += `Hourly Rate: +${formatCurrency(realTime.hourlyRate)}/hour\n`;
      msg += `Every 4 Seconds: +${formatCurrency(profitThisUpdate)}\n`;
      msg += `Today's Profit: +${formatCurrency(realTime.profitAccumulatedToday)}\n\n`;

      msg += `📍 <i>Updates every 4 seconds</i>`;

      return msg;
    };

    // Send initial message
    const initialMsg = await ctx.reply(createGrowthMessage(), { parse_mode: "HTML" });
    liveData.messageId = initialMsg.message_id;
    let lastMessageContent = createGrowthMessage(); // Track last message to avoid redundant edits
    let closeButtonMessageId = 0; // Will store close button message ID

    logger.info(`📈 Live growth message sent with ID: ${liveData.messageId}`);

    // Setup auto-update every 4 seconds
    let updateInterval: NodeJS.Timeout | null = null;
    const botApi = ctx.api; // Capture bot API reference

    const startUpdating = () => {
      updateInterval = setInterval(async () => {
        try {
          if (!liveData.messageId) {
            logger.warn("📈 Message ID missing, stopping updates");
            if (updateInterval) clearInterval(updateInterval);
            return;
          }

          // Increment update count
          liveData.updateCount++;
          const updatedMsg = createGrowthMessage();
          
          // Only edit if content actually changed
          if (updatedMsg === lastMessageContent) {
            logger.debug(`📈 Message content unchanged, skipping edit`);
            return;
          }
          
          lastMessageContent = updatedMsg;
          
          // Use captured bot API for reliability
          await botApi.editMessageText(
            liveData.chatId,
            liveData.messageId,
            updatedMsg,
            { parse_mode: "HTML" }
          );

          logger.info(`📈 Live growth updated (count: ${liveData.updateCount})`);
        } catch (error: any) {
          // Log full error details for debugging
          logger.error(`❌ Error updating live growth (attempt ${liveData.updateCount}):`, {
            message: error?.message,
            description: error?.description,
            code: error?.code,
            statusCode: error?.statusCode,
            fullError: JSON.stringify(error),
          });
          // Stop after first error to prevent spam
          if (updateInterval) {
            clearInterval(updateInterval);
            logger.info(`📈 Live growth updates stopped due to error`);
          }
        }
      }, 4000); // Update every 4 seconds
    };

    startUpdating();

    // Show close button after initial message
    setTimeout(() => {
      ctx.reply(`<b>📈 Live Growth View Active</b>\n\n✨ Watch your profit grow in real-time!\nThe value updates every 4 seconds.\n\nTap the button below to close.`, {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Close Live Growth", callback_data: `close_live_growth_${trimmedId}` }]],
        },
        parse_mode: "HTML",
      }).then((msg) => {
        closeButtonMessageId = msg.message_id;
        logger.info(`📈 Close button message sent with ID: ${closeButtonMessageId}`);
      }).catch((err) => logger.error("Error sending close button:", err));
    }, 100);

    // Store interval and message IDs for cleanup
    (ctx.session as any).liveGrowthInterval = updateInterval;
    (ctx.session as any).liveGrowthMessageIds = {
      growthMessageId: liveData.messageId,
      closeButtonMessageId: closeButtonMessageId,
      chatId: chatId,
    };
  } catch (error) {
    logger.error("Error starting live growth view:", error);
    await ctx.reply(`❌ Error starting live growth view: ${(error as Error).message}`);
  }
}

/**
 * Close live growth view
 */
export async function handleCloseLiveGrowth(ctx: SessionContext, investmentId: string): Promise<void> {
  try {
    // Stop the interval
    const updateInterval = (ctx.session as any).liveGrowthInterval;
    if (updateInterval) {
      clearInterval(updateInterval);
      (ctx.session as any).liveGrowthInterval = null;
    }

    // Get stored message IDs
    const messageIds = (ctx.session as any).liveGrowthMessageIds;
    
    // Delete the live growth message
    if (messageIds?.growthMessageId && messageIds?.chatId) {
      try {
        await ctx.api.deleteMessage(messageIds.chatId, messageIds.growthMessageId);
        logger.info(`📈 Deleted growth message ${messageIds.growthMessageId}`);
      } catch (error: any) {
        logger.warn(`Could not delete growth message:`, error?.description || error?.message);
      }
    }

    // Delete the close button message
    if (messageIds?.closeButtonMessageId && messageIds?.chatId) {
      try {
        await ctx.api.deleteMessage(messageIds.chatId, messageIds.closeButtonMessageId);
        logger.info(`📈 Deleted close button message ${messageIds.closeButtonMessageId}`);
      } catch (error: any) {
        logger.warn(`Could not delete close button message:`, error?.description || error?.message);
      }
    }

    // Clear session data
    ctx.session.liveGrowthData = null;
    (ctx.session as any).liveGrowthMessageIds = null;

    logger.info(`📈 Live growth view closed for investment: ${investmentId}`);
  } catch (error) {
    logger.error("Error closing live growth view:", error);
  }
}

/**
 * Withdraw daily profit
 */
export async function handleWithdrawDailyProfit(ctx: SessionContext, investmentId: string): Promise<void> {
  try {
    // MARKER: This proves the handler is executing
    logger.info(`🟢🟢🟢 [HANDLER-EXECUTING] handleWithdrawDailyProfit function started 🟢🟢🟢`);
    
    const id = investmentId.trim();
    const userId = ctx.session.userId;

    logger.info(`========== [WITHDRAW-DAILY] START ==========`);
    logger.info(`[WITHDRAW-DAILY] investmentId: "${id}"`);
    logger.info(`[WITHDRAW-DAILY] userId: "${userId}"`);

    // Fetch investment
    const investment = await prisma.investment.findUnique({
      where: { id },
      include: { package: true, user: true }
    });

    if (!investment) {
      logger.error(`❌ [WITHDRAW-DAILY] INVESTMENT NOT FOUND in DB with ID: "${id}"`);
      await ctx.reply("❌ Investment not found");
      return;
    }

    logger.info(`✅ [WITHDRAW-DAILY] Investment FOUND`);
    logger.info(`[WITHDRAW-DAILY] Investment ownerId: "${investment.userId}"`);
    logger.info(`[WITHDRAW-DAILY] Current userId: "${userId}"`);
    logger.info(`[WITHDRAW-DAILY] availableWithdrawable: ${investment.availableWithdrawable}`);

    // Verify ownership
    if (investment.userId !== userId) {
      logger.error(`❌ [WITHDRAW-DAILY] OWNERSHIP MISMATCH - owner: ${investment.userId}, user: ${userId}`);
      await ctx.reply("❌ You don't have access to this investment");
      return;
    }

    logger.info(`✅ [WITHDRAW-DAILY] Ownership verified`);

    // Check withdrawable amount
    if (!investment.availableWithdrawable || investment.availableWithdrawable <= 0) {
      logger.error(`❌ [WITHDRAW-DAILY] NO WITHDRAWABLE AMOUNT - available: ${investment.availableWithdrawable}`);
      await ctx.reply("❌ No daily profit available to withdraw");
      return;
    }

    logger.info(`✅ [WITHDRAW-DAILY] Has withdrawable amount: ${investment.availableWithdrawable}`);
    logger.info(`[WITHDRAW-DAILY] Creating withdrawal request...`);

    // Create withdrawal request
    const withdrawal = await InvestmentService.createWithdrawalRequest(
      id,
      investment.availableWithdrawable,
      userId
    );

    // Notify admin of new withdrawal request
    try {
      await TelegramNotificationService.notifyAdminNewWithdrawal(
        withdrawal.id,
        id,
        userId,
        investment.user?.firstName || "User",
        investment.availableWithdrawable,
        investment.user?.telegramId?.toString()
      );
    } catch (error) {
      logger.error("Error sending admin notification for new withdrawal:", error);
    }

    logger.info(`✅ [WITHDRAW-DAILY] Withdrawal request created: ${withdrawal.id}`);

    // Send success message to user
    let message = `<b>✅ Withdrawal Request Created</b>\n\n`;
    message += `💸 Amount: ${formatCurrency(investment.availableWithdrawable)}\n`;
    message += `📊 Package: ${investment.package.name}\n`;
    message += `⏳ Status: Pending Approval\n\n`;
    message += `Your withdrawal request has been submitted.`;

    await ctx.reply(message, { parse_mode: "HTML" });


    logger.info(`========== [WITHDRAW-DAILY] SUCCESS ==========`);
  } catch (error) {
    logger.error(`❌ [WITHDRAW-DAILY] EXCEPTION:`, error);
    await ctx.reply(`❌ Error processing withdrawal: ${(error as Error).message}`);
  }
}

/**
 * Withdraw full investment
 */
export async function handleWithdrawInvestment(ctx: SessionContext, investmentId: string): Promise<void> {
  try {
    const trimmedId = investmentId.trim();
    logger.info(`[WITHDRAW-FULL] Processing for: ${trimmedId}`);
    
    const investment = await prisma.investment.findUnique({
      where: { id: trimmedId },
      include: { package: true, user: true }
    });

    if (!investment) {
      logger.warn(`[WITHDRAW-FULL] Investment [${trimmedId}] not found`);
      await ctx.reply("❌ Investment not found");
      return;
    }

    // Verify investment belongs to user
    if (investment.userId !== ctx.session.userId) {
      logger.warn(`[WITHDRAW-FULL] Access denied`);
      await ctx.reply("❌ You don't have access to this investment");
      return;
    }

    // Verify package exists
    if (!investment.package) {
      logger.error(`[WITHDRAW-FULL] No package data`);
      await ctx.reply("❌ Investment package information not found");
      return;
    }

    // Check if investment is matured
    if (investment.status !== "MATURED") {
      await ctx.reply(`❌ Investment is not yet matured. Maturity date: ${new Date(investment.maturityDate).toLocaleDateString()}`);
      return;
    }

    // Calculate total amount (principal + profit)
    const totalAmount = investment.amount + investment.totalProfit;

    // Create withdrawal request
    const withdrawal = await InvestmentService.createWithdrawalRequest(
      trimmedId,
      totalAmount,
      investment.userId
    );

    // Notify admin of new withdrawal request
    try {
      await TelegramNotificationService.notifyAdminNewWithdrawal(
        withdrawal.id,
        trimmedId,
        investment.userId,
        investment.user?.firstName || "User",
        totalAmount,
        investment.user?.telegramId?.toString()
      );
    } catch (error) {
      logger.error("Error sending admin notification for new withdrawal:", error);
    }

    let message = `<b>✅ Investment Withdrawal Request Created</b>\n\n`;
    message += `💰 Principal: ${formatCurrency(investment.amount)}\n`;
    message += `📈 Total Profit: ${formatCurrency(investment.totalProfit)}\n`;
    message += `💸 Total Amount: ${formatCurrency(totalAmount)}\n`;
    message += `📊 Investment: ${investment.package.name}\n`;
    message += `⏳ Status: Pending Approval\n\n`;
    message += `Your investment withdrawal request has been submitted and is awaiting approval.\n`;
    message += `You'll be notified once it's processed.`;

    await ctx.reply(message, {
      parse_mode: "HTML",
    });

    // Create notification
    const { NotificationService } = await import("../services/notification.js");
    await NotificationService.createNotification(
      investment.userId,
      "🏦 Investment Withdrawal Request",
      `Your investment withdrawal of ${formatCurrency(totalAmount)} from ${investment.package.name} is pending approval.`,
      "INFO",
      investmentId
    );

    logger.info(`[WITHDRAW] User ${investment.userId} requested investment withdrawal of ${totalAmount} from investment ${investmentId}`);

    // Show portfolio again
    await handleViewPortfolio(ctx);
  } catch (error) {
    console.error("Error withdrawing investment:", error);
    await ctx.reply(`❌ Failed to process withdrawal: ${(error as Error).message}`);
  }
}

/**
 * Withdraw daily profit - Ask for amount
 */
export async function handleWithdrawDailyProfitInput(ctx: SessionContext, investmentId: string): Promise<void> {
  try {
    const trimmedId = investmentId.trim();
    const investment = await prisma.investment.findUnique({
      where: { id: trimmedId },
      include: { package: true }
    });

    if (!investment) {
      await ctx.reply("❌ Investment not found");
      return;
    }

    if (investment.userId !== ctx.session.userId) {
      await ctx.reply("❌ You don't have access to this investment");
      return;
    }

    if (!investment.availableWithdrawable || investment.availableWithdrawable <= 0) {
      await ctx.reply("❌ No daily profit available to withdraw");
      return;
    }

    ctx.session.withdrawalData = {
      investmentId: trimmedId,
      availableAmount: investment.availableWithdrawable,
      withdrawalType: "DAILY_PROFIT",
      packageName: investment.package.name,
    };

    await ctx.reply(
      `<b>💸 Withdraw Daily Profit</b>\n\n
Available to withdraw: ${formatCurrency(investment.availableWithdrawable)}\n\n
Enter the amount you want to withdraw (or type "max" for all):`,
      {
        parse_mode: "HTML",
      }
    );
  } catch (error) {
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Withdraw investment - First select wallet, then ask for amount
 */
export async function handleWithdrawInvestmentInput(ctx: SessionContext, investmentId: string): Promise<void> {
  try {
    const trimmedId = investmentId.trim();
    const investment = await prisma.investment.findUnique({
      where: { id: trimmedId },
      include: { package: true }
    });

    if (!investment) {
      await ctx.reply("❌ Investment not found");
      return;
    }

    if (investment.userId !== ctx.session.userId) {
      await ctx.reply("❌ You don't have access to this investment");
      return;
    }

    if (investment.status !== "MATURED") {
      await ctx.reply(`❌ Investment is not matured yet. Maturity date: ${new Date(investment.maturityDate).toLocaleDateString()}`);
      return;
    }

    // Get user's wallets
    const wallets = await (prisma as any).wallet.findMany({
      where: { userId: ctx.session.userId },
      orderBy: { isDefault: "desc" },
    });

    if (wallets.length === 0) {
      await ctx.reply("❌ <b>No Wallets Found</b>\n\nPlease add a wallet first to withdraw earnings.", {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "➕ Add Wallet", callback_data: "add_wallet" }],
            [{ text: "🔙 Back", callback_data: `invest_details_${trimmedId}` }],
          ],
        },
      });
      return;
    }

    // Store investment info in session for wallet selection
    const totalAmount = investment.amount + investment.totalProfit;
    ctx.session.withdrawalData = {
      investmentId: trimmedId,
      availableAmount: totalAmount,
      withdrawalType: "FULL_INVESTMENT",
      packageName: investment.package.name,
      principal: investment.amount,
      profit: investment.totalProfit,
    };

    // Show wallet selection
    let message = `<b>💳 Select Wallet for Withdrawal</b>\n\n`;
    message += `Available wallets:\n\n`;

    const keyboard = {
      inline_keyboard: wallets.map((wallet: any) => [
        {
          text: `${wallet.label || wallet.blockchain} ${wallet.isDefault ? "⭐" : ""}`,
          callback_data: `withdraw_select_wallet_input_${wallet.id}`,
        },
      ]),
    };

    keyboard.inline_keyboard.push([
      { text: "➕ Add New Wallet", callback_data: "add_wallet" },
      { text: "🔙 Back", callback_data: `invest_details_${trimmedId}` },
    ]);

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } catch (error) {
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Confirm wallet selection and ask for amount
 */
export async function handleConfirmWalletForWithdrawalInput(ctx: SessionContext, walletId: string): Promise<void> {
  try {
    const wallet = await (prisma as any).wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet || wallet.userId !== ctx.session.userId) {
      await ctx.reply("❌ Wallet not found.");
      return;
    }

    if (!ctx.session.withdrawalData) {
      await ctx.reply("❌ Invalid withdrawal request.");
      return;
    }

    // Store wallet info in session
    ctx.session.withdrawalData.walletId = walletId;
    ctx.session.withdrawalData.walletAddress = wallet.walletAddress;
    ctx.session.withdrawalData.blockchain = wallet.blockchain;
    ctx.session.withdrawalData.cryptocurrency = wallet.cryptocurrency;

    const message = `<b>💰 Enter Withdrawal Amount</b>\n\nWallet: <b>${wallet.label || wallet.blockchain}</b>\n\nAddress: <code>${wallet.walletAddress.substring(0, 20)}...</code>\n\nAvailable for Withdrawal: ${formatCurrency(ctx.session.withdrawalData.availableAmount)}\n\nEnter the amount you want to withdraw (or type "max" for all):`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "❌ Cancel", callback_data: `invest_details_${ctx.session.withdrawalData.investmentId}` }]],
      },
    });
  } catch (error) {
    logger.error("Error confirming wallet for withdrawal:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Process withdrawal amount input and send verification email
 */
export async function handleWithdrawalAmountInput(ctx: SessionContext): Promise<void> {
  const input = ctx.message?.text?.trim().toLowerCase() || "";

  if (!ctx.session.withdrawalData) {
    await ctx.reply("❌ No active withdrawal request");
    return;
  }

  try {
    let amount: number;

    if (input === "max") {
      amount = ctx.session.withdrawalData.availableAmount;
    } else {
      amount = parseFloat(input);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply("❌ Invalid amount. Please enter a valid number:");
        return;
      }
    }

    if (amount > ctx.session.withdrawalData.availableAmount) {
      await ctx.reply(
        `❌ Amount exceeds available balance (${formatCurrency(ctx.session.withdrawalData.availableAmount)})`
      );
      return;
    }

    if (amount < config.MIN_WITHDRAWAL_AMOUNT || amount > config.MAX_WITHDRAWAL_AMOUNT) {
      await ctx.reply(
        `❌ Invalid amount. Must be between ${formatCurrency(config.MIN_WITHDRAWAL_AMOUNT)} and ${formatCurrency(config.MAX_WITHDRAWAL_AMOUNT)}`
      );
      return;
    }

    ctx.session.withdrawalData.withdrawAmount = amount;

    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();
    keyboard.text("✅ Confirm", "confirm_withdrawal_amount").row();
    keyboard.text("❌ Cancel", "cancel_withdrawal").row();

    await ctx.reply(
      `<b>Confirm Withdrawal</b>\n\n
Package: ${ctx.session.withdrawalData.packageName}\n
Amount: ${formatCurrency(amount)}\n\n
Confirm this withdrawal request?`,
      {
        reply_markup: keyboard,
        parse_mode: "HTML",
      }
    );
  } catch (error) {
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Send verification email for withdrawal
 */
export async function handleConfirmWithdrawalAmount(ctx: SessionContext): Promise<void> {
  if (!ctx.session.withdrawalData) {
    await ctx.reply("❌ No active withdrawal request");
    return;
  }

  try {
    const { investmentId, withdrawAmount } = ctx.session.withdrawalData;
    const userId = ctx.session.userId;
    const user = await UserService.getUserById(userId);

    if (!user?.email) {
      await ctx.reply("❌ Email not found. Please update your email first.");
      return;
    }

    // Create withdrawal request with wallet details
    const withdrawalRequest = await InvestmentService.createWithdrawalRequest(
      investmentId,
      withdrawAmount,
      userId,
      "INVESTMENT",
      ctx.session.withdrawalData.walletId,
      ctx.session.withdrawalData.walletAddress,
      ctx.session.withdrawalData.blockchain,
      ctx.session.withdrawalData.cryptocurrency
    );

    // Notify admin of new withdrawal request
    try {
      await TelegramNotificationService.notifyAdminNewWithdrawal(
        withdrawalRequest.id,
        investmentId,
        userId,
        user.firstName || "User",
        withdrawAmount,
        user.telegramId?.toString()
      );
    } catch (error) {
      logger.error("Error sending admin notification for new withdrawal:", error);
    }

    const token = withdrawalRequest.emailVerificationToken;

    // Store request info in session for reference
    ctx.session.withdrawalVerificationToken = token;
    ctx.session.pendingWithdrawal = ctx.session.withdrawalData;

    // Send verification email
    const verificationUrl = `${process.env.BOT_WEBHOOK_URL || "http://localhost:3000"}/verify-withdrawal?token=${token}`;
    
    EmailService.sendWithdrawalVerificationEmail(
      user.email,
      user.firstName || "User",
      verificationUrl,
      token || ""
    ).catch((err: any) => {
      console.error("Failed to send withdrawal verification email:", err);
    });

    await ctx.reply(
      `📧 <b>Verification Email Sent!</b>\n\n
A verification link has been sent to: <code>${user.email}</code>\n\n
<b>Please click the link in your email to confirm your withdrawal request.</b>\n\n
⏱️ The link expires in ${config.WITHDRAWAL_VERIFICATION_TOKEN_EXPIRY_MINUTES} minutes.`,
      {
        parse_mode: "HTML",
      }
    );

    // Clear the withdrawal data from session
    delete ctx.session.withdrawalData;
  } catch (error) {
    logger.error("Error confirming withdrawal amount:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * View Your Wallets
 */
export async function handleViewWallets(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Your Wallets`);
  const user = await UserService.getUserById(ctx.session.userId);

  if (!user) {
    await ctx.reply("❌ User not found", { reply_markup: settingsKeyboard });
    return;
  }

  // Check email verification
  if (!user.emailVerified) {
    await ctx.reply(
      `🔐 <b>Email Verification Required</b>\n\n
Please verify your email before managing wallets.`,
      {
        reply_markup: settingsKeyboard,
        parse_mode: "HTML",
      }
    );
    return;
  }

  try {
    const wallets = await (prisma as any).wallet.findMany({
      where: { userId: ctx.session.userId },
      orderBy: { createdAt: "desc" },
    });

    let message = `<b>💳 Your Wallets</b>\n\n`;

    if (wallets.length === 0) {
      message += `❌ <b>No wallets added yet</b>\n\n`;
      message += `Add your crypto wallet addresses to enable withdrawals.\n\n`;
      message += `Tap "➕ Add Wallet" to get started.`;

      const buttons = {
        inline_keyboard: [
          [{ text: "➕ Add Wallet", callback_data: "add_wallet" }],
          [{ text: "🔙 Back", callback_data: "back_from_wallets" }],
        ],
      };

      await ctx.reply(message, {
        reply_markup: buttons,
        parse_mode: "HTML",
      });
    } else {
      message += `✅ <b>Your Saved Wallets:</b>\n\n`;
      wallets.forEach((wallet: any, index: number) => {
        const defaultBadge = wallet.isDefault ? " 🌟" : "";
        message += `${index + 1}. <b>USDT (${wallet.blockchain})${defaultBadge}</b>\n`;
        if (wallet.label) {
          message += `   Label: ${wallet.label}\n`;
        }
        message += `   Address: <code>${wallet.walletAddress.substring(0, 20)}...</code>`;
        message += `\n\n`;
      });

      const buttons: any = {
        inline_keyboard: wallets.map((wallet: any) => [
          { text: `✏️ ${wallet.blockchain}`, callback_data: `edit_wallet_${wallet.id}` },
          { text: "❌", callback_data: `delete_wallet_${wallet.id}` },
        ]),
      };

      buttons.inline_keyboard.push([{ text: "➕ Add Wallet", callback_data: "add_wallet" }]);
      buttons.inline_keyboard.push([{ text: "🔙 Back", callback_data: "back_from_wallets" }]);

      await ctx.reply(message, {
        reply_markup: buttons,
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    logger.error("Error viewing wallets:", error);
    await ctx.reply("❌ Error loading wallets. Please try again.");
  }
}

/**
 * Add wallet - Select cryptocurrency
 */
export async function handleAddWalletStart(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Add Wallet - Select Blockchain`);

  const supportedBlockchains = [
    { name: "ERC-20 (Ethereum)", value: "ERC-20" },
    { name: "TRC-20 (Tron)", value: "TRC-20" },
    { name: "BEP-20 (BSC)", value: "BEP-20" },
    { name: "Polygon (MATIC)", value: "Polygon" },
  ];
  
  const message = `<b>➕ Add New Wallet</b>\n\n
Step 1 of 2: <b>Select Blockchain for USDT</b>\n\n
Which blockchain do you want to use?`;

  const keyboard = {
    inline_keyboard: supportedBlockchains.map((blockchain) => [
      {
        text: blockchain.name,
        callback_data: `add_wallet_blockchain_${blockchain.value}`,
      },
    ]),
  };
  keyboard.inline_keyboard.push([{ text: "🔙 Cancel", callback_data: "view_wallets" }]);

  await ctx.reply(message, {
    reply_markup: keyboard,
    parse_mode: "HTML",
  });
}

/**
 * Add wallet - Enter address
 */
export async function handleAddWalletAddress(ctx: SessionContext, blockchain: string): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Add Wallet - Enter Address for ${blockchain}`);
  
  ctx.session.pendingWallet = { 
    cryptocurrency: "usdt",
    blockchain: blockchain.toLowerCase()
  };

  const message = `<b>➕ Add New Wallet</b>\n\n
Step 2 of 2: <b>Enter your ${blockchain} USDT Address</b>\n\n
Send me your USDT wallet address on ${blockchain}:`;

  await ctx.reply(message, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "❌ Cancel", callback_data: "view_wallets" }]],
    },
  });
}

/**
 * Save new wallet
 */
export async function handleSaveWallet(ctx: SessionContext, walletAddress: string): Promise<void> {
  const { cryptocurrency, blockchain } = ctx.session.pendingWallet || {};

  if (!cryptocurrency || !blockchain || !walletAddress) {
    await ctx.reply("❌ Invalid wallet data. Please try again.");
    return;
  }

  try {
    // Check if wallet already exists
    const existingWallet = await (prisma as any).wallet.findUnique({
      where: {
        userId_walletAddress_cryptocurrency_blockchain: {
          userId: ctx.session.userId,
          walletAddress,
          cryptocurrency,
          blockchain,
        },
      },
    });

    if (existingWallet) {
      await ctx.reply("❌ This wallet address already exists.\n\nTap \"View Wallets\" to manage.", {
        reply_markup: { inline_keyboard: [[{ text: "👁️ View Wallets", callback_data: "view_wallets" }]] },
      });
      return;
    }

    // Create wallet
    const wallet = await (prisma as any).wallet.create({
      data: {
        userId: ctx.session.userId,
        cryptocurrency,
        blockchain,
        walletAddress,
        label: `USDT (${blockchain})`,
      },
    });

    delete ctx.session.pendingWallet;

    let message = `✅ <b>Wallet Added Successfully!</b>\n\n`;
    message += `Cryptocurrency: <b>${cryptocurrency.toUpperCase()}</b>\n`;
    message += `Blockchain: <b>${blockchain.toUpperCase()}</b>\n`;
    message += `Address: <code>${walletAddress.substring(0, 40)}</code>\n\n`;
    message += `You can now withdraw earnings to this wallet.`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "👁️ View Wallets", callback_data: "view_wallets" }],
          [{ text: "⚙️ Settings", callback_data: "settings" }],
        ],
      },
    });

    logger.info(`[WALLET] New wallet added for user ${ctx.session.userId}:`, {
      cryptocurrency,
      blockchain,
      walletAddress: walletAddress.substring(0, 20) + "...",
    });
  } catch (error) {
    logger.error("Error saving wallet:", error);
    await ctx.reply("❌ Error saving wallet. Please try again.");
  }
}

/**
 * Delete wallet
 */
export async function handleDeleteWallet(ctx: SessionContext, walletId: string): Promise<void> {
  try {
    const wallet = await (prisma as any).wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet || wallet.userId !== ctx.session.userId) {
      await ctx.reply("❌ Wallet not found.");
      return;
    }

    await (prisma as any).wallet.delete({
      where: { id: walletId },
    });

    await ctx.editMessageText(
      `✅ <b>Wallet Deleted</b>\n\n${wallet.cryptocurrency.toUpperCase()} wallet has been removed.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "👁️ View Wallets", callback_data: "view_wallets" }]],
        },
      }
    );

    logger.info(`[WALLET] Wallet deleted for user ${ctx.session.userId}:`, { walletId });
  } catch (error) {
    logger.error("Error deleting wallet:", error);
    await ctx.reply("❌ Error deleting wallet. Please try again.");
  }
}

/**
 * Settings menu
 */
export async function handleSettings(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Settings`);
  const user = await UserService.getUserById(ctx.session.userId);

  if (!user) {
    await ctx.reply("❌ User not found");
    return;
  }

  // Check if user has any wallets
  const wallets = await (prisma as any).wallet.findMany({
    where: { userId: ctx.session.userId },
  });

  const message = `<b>⚙️ Settings</b>\n\n
📋 <b>Account Info:</b>
• Name: ${user.firstName} ${user.lastName}
• Email: ${user.email || "Not set"}
• Email Status: ${user.emailVerified ? "✅ Verified" : "⏳ Pending"}
• Phone: ${user.phoneNumber || "Not set"}
• Status: <b>${user.status}</b>

💳 <b>Wallet Address:</b> ${wallets.length > 0 ? `✅ Added (${wallets.length})` : "❌ Not added"}

🎁 <b>Referral Program:</b>
• Your Code: <code>${user.referralCode}</code>
• Active Referrals: <b>${user.referralCount}</b>
• Earnings: ${formatCurrency((user as any).referralEarnings || 0)}

Choose an option:`;

  await ctx.reply(message, {
    reply_markup: settingsKeyboard,
    parse_mode: "HTML",
  });
}

/**
 * Handle security settings
 */
export async function handleSecurity(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Security Settings`);
  const user = await UserService.getUserById(ctx.session.userId);
  
  // Check if user has any wallets
  const wallets = await (prisma as any).wallet.findMany({
    where: { userId: ctx.session.userId },
  });
  
  const message = `<b>🔐 Security Settings</b>\n\n
<b>Account Security:</b>
🔒 Your account is protected with secure authentication
📧 Email verification: ${user?.emailVerified ? "✅ Enabled" : "⏳ Pending"}
💳 Wallet address: ${wallets.length > 0 ? "✅ Saved" : "❌ Not added"}

<b>Data Management:</b>
You can export your account data or create a backup for security purposes.

Choose an option:`;
  
  await ctx.reply(message, {
    reply_markup: securityKeyboard,
    parse_mode: "HTML",
  });
}

/**
 * Export user data
 */
export async function handleExportData(ctx: SessionContext): Promise<void> {
  try {
    const userId = ctx.session.userId;
    await ctx.reply("📥 <b>Exporting your data...</b>\n\nPlease wait while we prepare your account data.", {
      parse_mode: "HTML",
    });

    // Get user profile
    const user = await UserService.getUserById(userId);
    if (!user) {
      await ctx.reply("❌ User data not found");
      return;
    }

    // Get investments
    const investments = await (prisma as any).investment.findMany({
      where: { userId },
      include: { package: true },
    });

    // Get withdrawal requests
    const withdrawals = await (prisma as any).withdrawalRequest.findMany({
      where: { userId },
    });

    // Get wallets
    const wallets = await (prisma as any).wallet.findMany({
      where: { userId },
    });

    // Get referral data
    const referrals = await (prisma as any).user.findMany({
      where: { referredBy: user.referralCode },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
      },
    });

    // Create a readable document format instead of JSON
    let documentContent = `╔════════════════════════════════════════════════╗
║       ACCOUNT DATA EXPORT DOCUMENT            ║
║  ${new Date().toLocaleDateString()} - ${new Date().toLocaleTimeString()}           ║
╚════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ACCOUNT PROFILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: ${user.firstName} ${user.lastName}
Email: ${user.email}
Phone: ${user.phoneNumber || "Not provided"}
Username: ${user.username || "Not set"}
Email Status: ${user.emailVerified ? "✅ Verified" : "⏳ Pending"}
Account Status: ${user.status}
Member Since: ${new Date(user.createdAt).toLocaleDateString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 REFERRAL PROGRAM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Referral Code: ${user.referralCode}
Active Referrals: ${user.referralCount}
Total Earnings: ${formatCurrency((user as any).referralEarnings || 0)}

${referrals.length > 0 ? `
Referred Users:
${referrals.map((r: any) => `  • ${r.firstName} ${r.lastName} (${r.email}) - Joined ${new Date(r.createdAt).toLocaleDateString()}`).join('\n')}
` : "No referrals yet."}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 INVESTMENTS (${investments.length} Total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${investments.length === 0 ? "No investments yet." : investments.map((inv: any, idx: number) => `
Investment #${idx + 1}:
  Package: ${inv.package.name}
  Principal: ${formatCurrency(inv.amount)}
  ROI: ${inv.roiPercentage}%
  Expected Return: ${formatCurrency(inv.expectedReturn)}
  Status: ${inv.status}
  Start Date: ${new Date(inv.createdAt).toLocaleDateString()}
  Maturity Date: ${new Date(inv.maturityDate).toLocaleDateString()}
  Total Profit: ${formatCurrency(inv.totalProfit)}
  Accrued Profit: ${formatCurrency(inv.totalAccruedProfit)}
`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💸 WITHDRAWALS (${withdrawals.length} Total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${withdrawals.length === 0 ? "No withdrawals yet." : withdrawals.map((w: any, idx: number) => `
Withdrawal #${idx + 1}:
  Amount: ${formatCurrency(w.amount)}
  Cryptocurrency: ${w.cryptocurrency}
  Status: ${w.status}
  Date: ${new Date(w.createdAt).toLocaleDateString()}
  Wallet: ${w.walletAddress.substring(0, 15)}...
`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 SAVED WALLETS (${wallets.length} Total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${wallets.length === 0 ? "No wallets saved." : wallets.map((w: any, idx: number) => `
Wallet #${idx + 1}:
  Label: ${w.label || "Unlabeled"}
  Blockchain: ${w.blockchain}
  Address: ${w.walletAddress.substring(0, 15)}...
  Default: ${w.isDefault ? "✅ Yes" : "❌ No"}
`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 SUMMARY STATISTICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Investments: ${investments.length}
Total Withdrawals: ${withdrawals.length}
Saved Wallets: ${wallets.length}
Active Referrals: ${referrals.length}
Export Generated: ${new Date().toISOString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is your personal account data export.
Please keep it safe and do not share with anyone.
`;

    // Remove any control characters and truncate if needed
    const displayContent = documentContent.substring(0, 3500);
    
    
    // Send readable document format
    const summaryMessage = `📋 <b>Account Data Export</b>\n\n<code>${documentContent}</code>`;
    
    try {
      if (documentContent.length > 4000) {
        // Send truncated version first
        const truncated = `📋 <b>Account Data Export (Preview)</b>\n\n<code>${documentContent.substring(0, 3500)}\n\n... (Document truncated for display)</code>\n\n📧 For complete export, contact support for email delivery.`;
        
        await ctx.reply(truncated, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Back to Security", callback_data: "view_security" }],
            ],
          },
        });
      } else {
        await ctx.reply(summaryMessage, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Back to Security", callback_data: "view_security" }],
            ],
          },
        });
      }
    } catch (error) {
      logger.error("Error exporting user data:", error);
      await ctx.reply(`❌ Error exporting data: ${(error as Error).message}`, {
        parse_mode: "HTML",
      });
    }

    logger.info(`📥 User ${userId} exported their account data`);
  } catch (error) {
    logger.error("Error exporting user data:", error);
    await ctx.reply(`❌ Error exporting data: ${(error as Error).message}`, {
      parse_mode: "HTML",
    });
  }
}

/**
 * View profile
 */
export async function handleViewProfile(ctx: SessionContext): Promise<void> {
  const user = await UserService.getUserById(ctx.session.userId);

  if (!user) {
    await ctx.reply("❌ User not found");
    return;
  }

  const message = `<b>👤 My Profile</b>\n\n
👤 Name: ${getUserDisplayName(user)}
📱 Username: ${user.username || "Not set"}
🆔 Telegram ID: <code>${user.telegramId}</code>
📧 Email: ${user.email || "Not set"}
🔐 Email Status: ${user.emailVerified ? "✅ Verified" : "⏳ Pending Verification"}
📞 Phone: ${user.phoneNumber || "Not set"}
✅ KYC: ${user.kycVerified ? "Verified" : "Not verified"}
📅 Joined: ${formatDate(user.createdAt)}

<b>💰 Earnings Summary:</b>
• Total Invested: ${formatCurrency(user.totalInvested)}
• Total Earned: ${formatCurrency(user.totalEarned)}
• Total Withdrawn: ${formatCurrency(user.totalWithdrawn)}
• Referral Earnings: 🎁 ${formatCurrency((user as any).referralEarnings || 0)}

<b>🔗 Referral Program:</b>
• Your Code: <code>${user.referralCode}</code>
• Active Referrals: ${user.referralCount}
• Referral Earnings: ${formatCurrency((user as any).referralEarnings || 0)}

Tap below to view or manage your referrals:`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎁 My Referral Stats", callback_data: "view_my_referrals" }],
        [{ text: "🏠 Back to Menu", callback_data: "back_to_menu" }]
      ]
    },
    parse_mode: "HTML",
  });
}

/**
 * Help command
 */
export async function handleHelp(ctx: SessionContext): Promise<void> {
  const message = `<b>❓ Help & FAQ</b>\n\n
<b>Common Questions:</b>

1️⃣ <b>How do I invest?</b>
   Tap "💼 Invest", select a package, choose amount, confirm.

2️⃣ <b>What's the minimum investment?</b>
   ${formatCurrency(100)}

3️⃣ <b>When do I get my returns?</b>
   After the investment duration ends, usually within 48 hours.

4️⃣ <b>Can I withdraw early?</b>
   Contact support for early withdrawal options.

5️⃣ <b>Is this safe?</b>
   Yes! All investments are secured and verified.

📞 <b>Support:</b>
Contact @support for assistance.`;

  await ctx.reply(message, {
    reply_markup: mainMenuKeyboard,
    parse_mode: "HTML",
  });
}

/**
 * View bank details
 */
export async function handleViewBankDetails(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Bank Details`);
  const user = await UserService.getUserById(ctx.session.userId);

  if (!user) {
    await ctx.reply("❌ User not found");
    return;
  }

  // Check email verification
  if (!user.emailVerified) {
    await ctx.reply(
      `🔐 <b>Email Verification Required</b>\n\n
Please verify your email first before managing bank details.

Current Status: ⏳ Pending Verification`,
      {
        reply_markup: settingsKeyboard,
        parse_mode: "HTML",
      }
    );
    return;
  }

  let message = `<b>🏦 Bank Details</b>\n\n`;

  if (user.bankDetails) {
    message += `✅ <b>Current Bank Details:</b>\n`;
    message += `${user.bankDetails}\n\n`;
    message += `<b>Options:</b>
• Tap "Edit Bank Details" to update
• Tap "Back" to return to settings`;
  } else {
    message += `❌ <b>No bank details added yet</b>\n\n`;
    message += `Add your bank account information to enable withdrawals.\n\n`;
    message += `Tap "Edit Bank Details" to get started.`;
  }

  const buttons = {
    inline_keyboard: [
      [{ text: "✏️ Edit Bank Details", callback_data: "edit_bank_details" }],
      [{ text: "🔙 Back", callback_data: "back_from_bank_settings" }],
    ],
  };

  await ctx.reply(message, {
    reply_markup: buttons,
    parse_mode: "HTML",
  });
}

/**
 * Edit bank details - Ask for input
 */
export async function handleEditBankDetails(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Edit Bank Details`);
  const user = await UserService.getUserById(ctx.session.userId);

  if (!user) {
    await ctx.reply("❌ User not found", { reply_markup: settingsKeyboard });
    return;
  }

  // Check email verification
  if (!user.emailVerified) {
    await ctx.reply(
      `🔐 <b>Email Verification Required</b>\n\n
Please verify your email before updating bank details.`,
      {
        reply_markup: settingsKeyboard,
        parse_mode: "HTML",
      }
    );
    return;
  }

  ctx.session.editingField = "bankDetails";

  const prompt = `🏦 <b>Add/Update Bank Details</b>\n\n
Please enter your bank account information in the following format:\n\n
<b>Bank Name:</b> [Your Bank]
<b>Account Holder:</b> [Full Name]
<b>Account Number:</b> [Account #]
<b>SWIFT/IBAN:</b> [Code]

Example:
Bank Name: First National
Account Holder: John Doe
Account Number: 1234567890
SWIFT/IBAN: FNBAUS33XXX

Type or paste your bank details:`;

  await ctx.reply(prompt, {
    parse_mode: "HTML",
  });
}

/**
 * Process bank details input
 */
export async function handleProcessBankDetails(ctx: SessionContext): Promise<void> {
  const bankDetails = ctx.update.message?.text?.trim();

  if (!bankDetails || bankDetails.length < 10) {
    await ctx.reply(
      "❌ Bank details must be at least 10 characters. Please try again:",
      { parse_mode: "HTML" }
    );
    return;
  }

  if (bankDetails.length > 500) {
    await ctx.reply(
      "❌ Bank details exceeds maximum length. Please keep it under 500 characters.",
      { parse_mode: "HTML" }
    );
    return;
  }

  ctx.session.pendingFieldEdit = {
    field: "bankDetails",
    value: bankDetails,
  };

  await ctx.reply(
    `<b>Confirm Bank Details</b>\n\n
<code>${bankDetails}</code>\n\n
Is this correct?`,
    {
      reply_markup: confirmationKeyboard,
      parse_mode: "HTML",
    }
  );
}

/**
 * Confirm bank details update
 */
export async function handleConfirmBankDetails(
  ctx: SessionContext,
  confirm: boolean
): Promise<void> {
  if (!ctx.session.pendingFieldEdit) {
    await ctx.reply("❌ No pending changes", { reply_markup: settingsKeyboard });
    return;
  }

  if (!confirm) {
    delete ctx.session.pendingFieldEdit;
    ctx.session.editingField = undefined;
    await ctx.reply("❌ Update cancelled", {
      reply_markup: settingsKeyboard,
    });
    return;
  }

  try {
    const { value } = ctx.session.pendingFieldEdit;
    const user = await UserService.getUserById(ctx.session.userId);

    if (!user || !user.email) {
      await ctx.reply(
        `❌ Email not found. Please update your email first.`,
        {
          reply_markup: settingsKeyboard,
          parse_mode: "HTML",
        }
      );
      return;
    }

    // Generate verification token for bank details
    const token = await UserService.setBankDetailsVerificationToken(
      ctx.session.userId,
      value
    );

    // Store in session for reference
    ctx.session.pendingBankDetailsToken = token;

    // Send verification email
    const verificationUrl = `${process.env.BOT_WEBHOOK_URL || "http://localhost:3000"}/verify-bank-details?token=${token}`;
    
    EmailService.sendBankDetailsVerificationEmail(
      user.email,
      user.firstName || "User",
      verificationUrl,
      token
    ).catch((err: any) => {
      console.error("Failed to send bank details verification email:", err);
    });

    await ctx.reply(
      `✅ <b>Verification Email Sent!</b>\n\n
🔐 A verification link has been sent to: <code>${user.email}</code>\n\n
📧 <b>Please click the link in your email to confirm your bank details update.</b>\n\n
⏱️ The link expires in ${process.env.EMAIL_VERIFICATION_TOKEN_EXPIRY_MINUTES || 24} minutes.`,
      {
        reply_markup: settingsKeyboard,
        parse_mode: "HTML",
      }
    );

    delete ctx.session.pendingFieldEdit;
    ctx.session.editingField = undefined;
  } catch (error) {
    await ctx.reply(`❌ Error: ${(error as Error).message}`, {
      reply_markup: settingsKeyboard,
    });
  }
}

/**
 * View investment details and withdrawal options
 */
export async function handleViewInvestmentDetails(
  ctx: SessionContext,
  investmentId: string
): Promise<void> {
  try {
    const investment = await InvestmentService.getInvestmentWithTracking(investmentId);

    if (!investment) {
      await ctx.reply("❌ Investment not found");
      return;
    }

    const user = await UserService.getUserById(ctx.session.userId);
    if (user?.id !== investment.userId) {
      await ctx.reply("❌ You don't have access to this investment");
      return;
    }

    let message = `<b>${investment.package.icon} ${investment.package.name}</b>\n\n`;
    message += `<b>Investment Details:</b>\n`;
    message += `💰 Principal (Locked): ${formatCurrency(investment.amount)} 🔒\n`;
    message += `📈 Current Value: ${formatCurrency(investment.currentValue)}\n`;
    message += `💵 Total Profit: ${formatCurrency(investment.totalProfit || 0)}\n`;
    message += `📊 ROI Rate: ${investment.roiPercentage}%\n\n`;

    message += `<b>Daily Progress:</b>\n`;
    message += `📅 Days Remaining: ${investment.daysRemaining}\n`;
    message += `⬆️ Daily Growth: +${formatCurrency(investment.dailyProfit)}\n`;
    message += `🔒 Daily Reinvested: ${formatCurrency(investment.dailyReinvest)}\n`;
    message += `💸 Daily Withdrawable: ${formatCurrency(investment.dailyWithdrawable)}\n\n`;

    message += `<b>Withdrawal Status:</b>\n`;
    message += `💰 Available to Withdraw: ${formatCurrency(investment.availableWithdrawable)}\n`;
    message += `🏦 Already Withdrawn: ${formatCurrency(investment.totalWithdrawn)}\n`;
    message += `📅 Maturity Date: ${formatDate(investment.maturityDate)}\n`;
    message += `Status: <b>${investment.status}</b>\n`;

    const buttons = {
      inline_keyboard: [
        [
          {
            text:
              investment.availableWithdrawable > 0
                ? `💸 Withdraw (${formatCurrency(investment.availableWithdrawable)})`
                : "💸 Withdraw (0)",
            callback_data:
              investment.availableWithdrawable > 0
                ? `withdraw_${investmentId}`
                : "insufficient_funds",
          },
        ],
        [{ text: "🔙 Back", callback_data: "back_from_investment" }],
      ],
    };

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: buttons,
    });
  } catch (error) {
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Process withdrawal request
 */

/**
 * Process withdrawal request with email verification
 */
export async function handleProcessWithdrawal(
  ctx: SessionContext,
  investmentId: string
): Promise<void> {
  try {
    const investment = await InvestmentService.getInvestmentWithTracking(investmentId);

    if (!investment) {
      await ctx.reply("❌ Investment not found");
      return;
    }

    if (investment.userId !== ctx.from?.id?.toString()) {
      await ctx.reply("❌ Unauthorized access");
      return;
    }

    if (investment.availableWithdrawable <= 0) {
      await ctx.reply("❌ No funds available to withdraw");
      return;
    }

    ctx.session.withdrawalData = {
      investmentId,
      availableAmount: investment.availableWithdrawable,
    };

    await ctx.reply(
      `<b>💸 Withdrawal Request</b>\n\n
Available to withdraw: <code>${formatCurrency(investment.availableWithdrawable)}</code>\n\n
Enter the amount you want to withdraw (or type "max" for all):`,
      {
        parse_mode: "HTML",
      }
    );
  } catch (error) {
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Complete withdrawal (create withdrawal request with email verification)
 */
export async function handleCompleteWithdrawal(
  ctx: SessionContext,
  confirm: boolean
): Promise<void> {
  if (!ctx.session.withdrawalData) {
    await ctx.reply("❌ No active withdrawal request");
    return;
  }

  if (!confirm) {
    delete ctx.session.withdrawalData;
    await ctx.reply("❌ Withdrawal cancelled");
    return;
  }

  try {
    const { investmentId, withdrawAmount } = ctx.session.withdrawalData;
    const userId = ctx.from?.id?.toString() || "";

    // Create withdrawal request (requires email verification)
    const withdrawalRequest = await InvestmentService.createWithdrawalRequest(
      investmentId,
      withdrawAmount,
      userId
    );

    // Notify admin of new withdrawal request
    const user = await UserService.getUserById(userId);
    if (user) {
      try {
        await TelegramNotificationService.notifyAdminNewWithdrawal(
          withdrawalRequest.id,
          investmentId,
          userId,
          user.firstName || "User",
          withdrawAmount,
          user.telegramId?.toString()
        );
      } catch (error) {
        logger.error("Error sending admin notification for new withdrawal:", error);
      }
    }

    // Send verification email
    if (user?.email && config.WITHDRAWAL_EMAIL_VERIFICATION_REQUIRED) {
      const verificationLink = `${config.BOT_WEBHOOK_URL}/verify-withdrawal?token=${withdrawalRequest.emailVerificationToken}`;
      
      await EmailService.sendWithdrawalVerificationEmail(
        user.email,
        user.firstName || "User",
        verificationLink,
        withdrawalRequest.emailVerificationToken || ""
      );

      await ctx.reply(
        `✅ <b>Withdrawal Request Created!</b>\n\n
Amount: ${formatCurrency(withdrawAmount)}\n\n
<b>📧 Email Verification Required</b>
A verification link has been sent to <code>${user.email}</code>\n\n
Please click the link in the email to verify and complete your withdrawal request.`,
        {
          reply_markup: mainMenuKeyboard,
          parse_mode: "HTML",
        }
      );

      logger.info(`Withdrawal verification email sent to ${user.email} for request ${withdrawalRequest.id}`);
    } else {
      // If email verification is disabled, mark as email verified automatically
      await InvestmentService.verifyWithdrawalToken(withdrawalRequest.emailVerificationToken || "");
      
      await ctx.reply(
        `✅ <b>Withdrawal Request Created!</b>\n\n
Amount: ${formatCurrency(withdrawAmount)}\n
Status: ⏳ Pending Admin Approval\n\n
Your request has been sent to our administration team for processing.\n
You will be notified once payment is initiated.`,
        {
          reply_markup: mainMenuKeyboard,
          parse_mode: "HTML",
        }
      );
    }

    delete ctx.session.withdrawalData;
  } catch (error) {
    logger.error("Error in handleCompleteWithdrawal:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * View notifications
 */
export async function handleNotifications(ctx: SessionContext): Promise<void> {
  try {
    const { NotificationService } = await import("../services/notification.js");
    const { InlineKeyboard } = await import("grammy");

    const userId = ctx.session.userId;
    const page = ctx.session.notificationPage || 0;
    const limit = 5;
    const offset = page * limit;

    const { notifications, total } = await NotificationService.getUserNotifications(
      userId,
      limit,
      offset
    );

    const unreadCount = await NotificationService.countUnreadNotifications(userId);

    if (notifications.length === 0) {
      await ctx.reply(
        `📬 <b>Your Notifications</b>\n\n
You have no notifications at the moment.

Check back soon! 🔔`,
        {
          reply_markup: mainMenuKeyboard,
          parse_mode: "HTML",
        }
      );
      return;
    }

    const message = `📬 <b>Your Notifications</b>\n\n📊 <b>Unread: ${unreadCount}</b>\n\n<i>Page ${page + 1} of ${Math.ceil(total / limit)}</i>\n\nClick on any notification to view the full message:`;

    // Create inline keyboard with notification buttons
    const keyboard = new InlineKeyboard();
    
    // Add each notification as a button
    notifications.forEach((notification) => {
      const readIcon = notification.isRead ? "✅" : "🆕";
      const typeEmoji = getNotificationTypeEmoji(notification.type);
      const buttonText = `${readIcon} ${typeEmoji} ${notification.title.substring(0, 40)}${notification.title.length > 40 ? "..." : ""}`;
      keyboard.text(buttonText, `view_notification:${notification.id}`).row();
    });

    // Add pagination buttons
    const paginationRow: any[] = [];
    if (page > 0) {
      paginationRow.push({ text: "⬅️ Prev", callback_data: `notification_page:${page - 1}` });
    }
    if (page < Math.ceil(total / limit) - 1) {
      paginationRow.push({ text: "Next ➡️", callback_data: `notification_page:${page + 1}` });
    }
    
    if (paginationRow.length > 0) {
      keyboard.row(...paginationRow);
    }

    // Add action buttons
    keyboard.row(
      { text: "🔴 Mark All as Read", callback_data: "mark_all_notifications_read" }
    );
    keyboard.row(
      { text: "🏠 Back to Menu", callback_data: "back_to_menu" }
    );

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

    ctx.session.notificationPage = page;
  } catch (error) {
    logger.error("Error in handleNotifications:", error);
    await ctx.reply(
      `❌ Error loading notifications: ${(error as Error).message}`,
      {
        reply_markup: mainMenuKeyboard,
      }
    );
  }
}

/**
 * View notification details
 */
export async function handleNotificationDetail(
  ctx: SessionContext,
  notificationId: string
): Promise<void> {
  try {
    const { NotificationService } = await import("../services/notification.js");
    const { InlineKeyboard } = await import("grammy");

    const userId = ctx.session.userId;
    const notification = await NotificationService.getNotificationById(
      notificationId,
      userId
    );

    if (!notification) {
      await ctx.reply("❌ Notification not found", {
        reply_markup: mainMenuKeyboard,
      });
      return;
    }

    // Mark as read
    if (!notification.isRead) {
      await NotificationService.markAsRead(notificationId, userId);
    }

    const typeEmoji = getNotificationTypeEmoji(notification.type);
    const readStatus = notification.isRead ? "✅ Read" : "🆕 Unread";

    const message = `${typeEmoji} <b>${notification.title}</b>\n\n
${notification.message}\n\n
<b>Status:</b> ${readStatus}
<b>Time:</b> ${formatDate(notification.createdAt)}
<code>ID: ${notification.id}</code>`;

    const keyboard = new InlineKeyboard()
      .text("🗑️ Delete", `delete_notification:${notificationId}`)
      .row()
      .text("👈 Back to Notifications", "back_to_notifications")
      .row()
      .text("🏠 Back to Menu", "back_to_menu");

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error("Error in handleNotificationDetail:", error);
    await ctx.reply(
      `❌ Error loading notification: ${(error as Error).message}`,
      {
        reply_markup: mainMenuKeyboard,
      }
    );
  }
}

/**
 * Helper function to get emoji for notification type
 */
function getNotificationTypeEmoji(
  type: string
): "📢" | "✅" | "⚠️" | "❌" | "💼" | "💸" | "📣" {
  const emojiMap: {
    [key: string]: "📢" | "✅" | "⚠️" | "❌" | "💼" | "💸" | "📣";
  } = {
    INFO: "📢",
    SUCCESS: "✅",
    WARNING: "⚠️",
    ERROR: "❌",
    INVESTMENT: "💼",
    WITHDRAWAL: "💸",
    ANNOUNCEMENT: "📣",
  };
  return emojiMap[type] || "📢";
}

/**
 * View user referral stats
 */
export async function handleViewMyReferrals(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: My Referrals`);

  try {
    const stats = await ReferralService.getUserReferralStats(ctx.session.userId);
    const referredUsers = await ReferralService.getUsersReferredByCode(stats.referralCode!);

    let message = `<b>🎁 My Referral Stats</b>\n\n
<b>Your Referral Code:</b>
<code>${stats.referralCode}</code>

<b>Summary:</b>
• Active Referrals: ${stats.referralCount}
• Total Referral Earnings: ${formatCurrency(stats.referralEarnings)}

<b>Bonus Details:</b>
• Total Bonuses Earned: ${stats.bonusesList.length}
• Average Bonus: ${stats.bonusesList.length > 0 ? formatCurrency(stats.referralEarnings / stats.bonusesList.length) : formatCurrency(0)}`;

    if (referredUsers.length > 0) {
      message += `\n\n<b>Your Referrals:</b>\n`;
      referredUsers.slice(0, 10).forEach((user, index) => {
        const totalInvested = user.investments.reduce((sum, inv) => sum + inv.amount, 0);
        message += `\n${index + 1}. ${user.firstName || user.lastName || user.username || "Anonymous"}
   • Joined: ${formatDate(user.createdAt)}
   • Total Invested: ${formatCurrency(totalInvested)}`;
      });

      if (referredUsers.length > 10) {
        message += `\n\n... and ${referredUsers.length - 10} more referrals`;
      }
    } else {
      message += `\n\n<b>No referrals yet!</b>
Share your referral code with friends to earn bonuses when they invest.`;
    }

    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();

    if (stats.referralEarnings > 0) {
      keyboard.text("💸 Withdraw Bonus", "withdraw_referral_bonus").row();
    }

    keyboard.text("📋 Share Code", "share_referral_code").row();
    keyboard.text("👤 Back to Profile", "view_profile").row();
    keyboard.text("🏠 Back to Menu", "back_to_menu");

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: keyboard
    });
  } catch (error) {
    logger.error("Error viewing referral stats:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`, {
      reply_markup: mainMenuKeyboard,
    });
  }
}

/**
 * Withdraw referral bonus - Ask for amount
 */
export async function handleWithdrawReferralBonus(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Withdraw Referral Bonus`);

  try {
    const user = await UserService.getUserById(ctx.session.userId);

    if (!user || !user.referralEarnings || user.referralEarnings <= 0) {
      await ctx.reply("❌ No referral earnings available to withdraw", {
        reply_markup: mainMenuKeyboard,
      });
      return;
    }

    ctx.session.withdrawalData = {
      withdrawalType: "REFERRAL_BONUS",
      availableAmount: user.referralEarnings,
    };

    await ctx.reply(
      `<b>💸 Withdraw Referral Bonus</b>\n\n
💰 Total Referral Earnings: ${formatCurrency(user.referralEarnings)}\n\n
Enter the amount you want to withdraw (or type "max" for all):`,
      {
        parse_mode: "HTML",
        reply_markup: { remove_keyboard: true },
      }
    );
  } catch (error) {
    logger.error("Error initiating referral bonus withdrawal:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Process referral bonus withdrawal amount
 */
export async function handleReferralBonusAmountInput(ctx: SessionContext): Promise<void> {
  const input = ctx.message?.text?.trim().toLowerCase() || "";

  if (!ctx.session.withdrawalData || ctx.session.withdrawalData.withdrawalType !== "REFERRAL_BONUS") {
    await ctx.reply("❌ No active referral bonus withdrawal request");
    return;
  }

  try {
    let amount: number;

    if (input === "max") {
      amount = ctx.session.withdrawalData.availableAmount;
    } else {
      amount = parseFloat(input);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply("❌ Invalid amount. Please enter a valid number:");
        return;
      }
    }

    if (amount > ctx.session.withdrawalData.availableAmount) {
      await ctx.reply(
        `❌ Amount exceeds available balance (${formatCurrency(ctx.session.withdrawalData.availableAmount)})`
      );
      return;
    }

    if (amount < config.MIN_WITHDRAWAL_AMOUNT) {
      await ctx.reply(
        `❌ Minimum withdrawal is ${formatCurrency(config.MIN_WITHDRAWAL_AMOUNT)}`
      );
      return;
    }

    ctx.session.withdrawalData.withdrawAmount = amount;

    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();
    keyboard.text("✅ Confirm", "confirm_referral_withdrawal").row();
    keyboard.text("❌ Cancel", "cancel_withdrawal").row();

    await ctx.reply(
      `<b>Confirm Referral Bonus Withdrawal</b>\n\n
Amount: ${formatCurrency(amount)}\n\n
Confirm this withdrawal request?`,
      {
        reply_markup: keyboard,
        parse_mode: "HTML",
      }
    );
  } catch (error) {
    logger.error("Error processing referral bonus withdrawal amount:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Confirm and process referral bonus withdrawal
 */
export async function handleConfirmReferralWithdrawal(ctx: SessionContext): Promise<void> {
  if (!ctx.session.withdrawalData || ctx.session.withdrawalData.withdrawalType !== "REFERRAL_BONUS") {
    await ctx.reply("❌ No active referral bonus withdrawal request");
    return;
  }

  try {
    const { withdrawAmount } = ctx.session.withdrawalData;
    const userId = ctx.session.userId;
    const user = await UserService.getUserById(userId);

    if (!user) {
      await ctx.reply("❌ User not found");
      return;
    }

    if (!user.email) {
      await ctx.reply("❌ Email not found. Please update your email first.");
      return;
    }

    if (!user.bankDetails) {
      await ctx.reply(
        `❌ Bank details not found. Please add your bank details first before withdrawing.\n\nTap "⚙️ Settings" → "🏦 Bank Details" to add them.`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Verify user has enough referral earnings
    if (!user.referralEarnings || user.referralEarnings < withdrawAmount) {
      await ctx.reply(`❌ Insufficient referral earnings. Available: ${formatCurrency(user.referralEarnings || 0)}`);
      return;
    }

    // Create withdrawal request for referral bonus
    const withdrawal = await InvestmentService.createWithdrawalRequest(
      `REF_BONUS_${userId}`, // Special ID for referral bonus
      withdrawAmount,
      userId,
      "REFERRAL_BONUS" // Mark as referral bonus withdrawal
    );

    // Deduct from user's referral earnings
    await prisma.user.update({
      where: { id: userId },
      data: {
        referralEarnings: {
          decrement: withdrawAmount,
        },
      },
    });

    // Send verification email
    const token = withdrawal.emailVerificationToken;
    ctx.session.withdrawalVerificationToken = token;

    const verificationUrl = `${process.env.BOT_WEBHOOK_URL || "http://localhost:3000"}/verify-withdrawal?token=${token}`;

    EmailService.sendWithdrawalVerificationEmail(
      user.email,
      user.firstName || "User",
      verificationUrl,
      token || ""
    ).catch((err: any) => {
      console.error("Failed to send referral withdrawal verification email:", err);
    });

    await ctx.reply(
      `✅ <b>Referral Bonus Withdrawal Initiated!</b>\n\n
💰 Amount: ${formatCurrency(withdrawAmount)}\n
📧 Verification email sent to: <code>${user.email}</code>\n\n
<b>Please click the verification link in your email to confirm your withdrawal.</b>\n\n
⏱️ The link expires in ${config.WITHDRAWAL_VERIFICATION_TOKEN_EXPIRY_MINUTES} minutes.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎁 Back to Referrals", callback_data: "view_my_referrals" }],
            [{ text: "🏠 Home", callback_data: "back_to_menu" }]
          ]
        }
      }
    );

    logger.info(`✅ Referral bonus withdrawal initiated: ${userId} requesting ${withdrawAmount}`);

    // Notify admin
    try {
      const adminIds = await import("../lib/helpers.js").then(m => m.getAdminIds());
      const notificationMessage = `💸 <b>New Referral Bonus Withdrawal Request</b>\n\n
User: ${getUserDisplayName(user)}\n
Amount: ${formatCurrency(withdrawAmount)}\n
Status: Pending Email Verification\n\n
Awaiting user email verification...`;

      for (const adminId of adminIds) {
        ctx.api.sendMessage(Number(adminId), notificationMessage, { parse_mode: "HTML" }).catch(() => {});
      }
    } catch (error) {
      logger.error("Error notifying admin of referral withdrawal:", error);
    }

    // Clear withdrawal data
    delete ctx.session.withdrawalData;
  } catch (error) {
    logger.error("Error confirming referral bonus withdrawal:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

