import { Context } from "grammy";
import prisma from "../db/client.js";
import logger from "../config/logger.js";
import EmailService from "../services/email.js";
import UserService from "../services/user.js";
import InvestmentService from "../services/investment.js";
import TelegramNotificationService from "../services/telegramNotification.js";
import { config } from "../config/env.js";

type SessionContext = Context & { session: any };

/**
 * User requests withdrawal - show available wallets
 */
export async function handleSelectWalletForWithdrawal(
  ctx: SessionContext,
  investmentId: string
): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Select Wallet for Withdrawal`);

  try {
    const investment = await (prisma as any).investment.findUnique({
      where: { id: investmentId },
    });

    if (!investment) {
      await ctx.reply("❌ Investment not found.");
      return;
    }

    if (investment.userId !== ctx.session.userId) {
      await ctx.reply("❌ Unauthorized access.");
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
            [{ text: "🔙 Back", callback_data: `invest_details_${investmentId}` }],
          ],
        },
      });
      return;
    }

    // Store investment id in session for later
    ctx.session.withdrawalData = ctx.session.withdrawalData || {};
    ctx.session.withdrawalData.investmentId = investmentId;

    let message = `<b>💳 Select Wallet for Withdrawal</b>\n\n`;
    message += `Available USDT Wallets:\n\n`;

    const keyboard = {
      inline_keyboard: wallets.map((wallet: any) => [
        {
          text: `${wallet.label || wallet.blockchain} ${wallet.isDefault ? "⭐" : ""}`,
          callback_data: `withdraw_select_wallet_${wallet.id}`,
        },
      ]),
    };

    keyboard.inline_keyboard.push([
      { text: "➕ Add New Wallet", callback_data: "add_wallet" },
      { text: "🔙 Back", callback_data: `invest_details_${investmentId}` },
    ]);

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } catch (error) {
    logger.error("Error selecting wallet for withdrawal:", error);
    await ctx.reply("❌ Error loading wallets. Please try again.");
  }
}

/**
 * User confirmed wallet selection - now request withdrawal amount
 */
export async function handleConfirmWalletForWithdrawal(
  ctx: SessionContext,
  walletId: string
): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Enter Withdrawal Amount`);

  try {
    const wallet = await (prisma as any).wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet || wallet.userId !== ctx.session.userId) {
      await ctx.reply("❌ Wallet not found.");
      return;
    }

    if (!ctx.session.withdrawalData?.investmentId) {
      await ctx.reply("❌ Invalid withdrawal request.");
      return;
    }

    const investment = await (prisma as any).investment.findUnique({
      where: { id: ctx.session.withdrawalData.investmentId },
    });

    if (!investment) {
      await ctx.reply("❌ Investment not found.");
      return;
    }

    // Store wallet info in session
    ctx.session.withdrawalData.walletId = walletId;
    ctx.session.withdrawalData.walletAddress = wallet.walletAddress;
    ctx.session.withdrawalData.blockchain = wallet.blockchain;
    ctx.session.withdrawalData.cryptocurrency = wallet.cryptocurrency;

    const message = `<b>💰 Enter Withdrawal Amount</b>\n\n
Investment: ${investment.amount} USD\n
Available for Withdrawal: ${investment.availableWithdrawable} USD\n\n
Enter the amount you want to withdraw:\n\n
<code>Available: ${investment.availableWithdrawable} USD</code>`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "❌ Cancel", callback_data: `invest_details_${investment.id}` }]],
      },
    });
  } catch (error) {
    logger.error("Error confirming wallet for withdrawal:", error);
    await ctx.reply("❌ Error processing wallet selection. Please try again.");
  }
}

/**
 * User requesting withdrawal - process amount and create withdrawal request
 */
export async function handleProcessCryptoWithdrawal(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Confirm Withdrawal Request`);

  if (!ctx.session.withdrawalData) {
    await ctx.reply("❌ No active withdrawal request");
    return;
  }

  try {
    const {
      investmentId,
      walletId,
      walletAddress,
      blockchain,
      cryptocurrency,
    } = ctx.session.withdrawalData;

    const withdrawAmount = parseFloat(ctx.message?.text || "0");

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      await ctx.reply("❌ Please enter a valid amount.");
      return;
    }

    const investment = await (prisma as any).investment.findUnique({
      where: { id: investmentId },
    });

    if (!investment || investment.userId !== ctx.session.userId) {
      await ctx.reply("❌ Investment not found.");
      return;
    }

    if (withdrawAmount > investment.availableWithdrawable) {
      await ctx.reply(
        `❌ <b>Invalid Amount</b>\n\nAvailable: ${investment.availableWithdrawable} USD\n\nPlease enter a valid amount.`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Store final withdrawal amount
    ctx.session.withdrawalData.withdrawAmount = withdrawAmount;

    const message = `<b>✅ Confirm Withdrawal</b>\n\n
Amount: <b>${withdrawAmount} USD</b>\n
Wallet Address: <code>${walletAddress.substring(0, 20)}...</code>\n
Blockchain: <b>${blockchain}</b>\n
Cryptocurrency: <b>${cryptocurrency.toUpperCase()}</b>\n\n
Is this correct?`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Confirm", callback_data: "confirm_crypto_withdrawal" },
            { text: "❌ Cancel", callback_data: `invest_details_${investmentId}` },
          ],
        ],
      },
    });
  } catch (error) {
    logger.error("Error processing crypto withdrawal:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * User confirms withdrawal - create withdrawal request
 */
export async function handleConfirmCryptoWithdrawal(ctx: SessionContext): Promise<void> {
  if (!ctx.session.withdrawalData) {
    await ctx.reply("❌ No active withdrawal request");
    return;
  }

  try {
    const {
      investmentId,
      walletId,
      walletAddress,
      blockchain,
      cryptocurrency,
      withdrawAmount,
    } = ctx.session.withdrawalData;

    const userId = ctx.session.userId;
    const user = await UserService.getUserById(userId);

    if (!user?.email) {
      await ctx.reply("❌ Email not found. Please update your email first.");
      return;
    }

    // Create withdrawal request with wallet details
    const withdrawalRequest = await (prisma as any).withdrawalRequest.create({
      data: {
        userId,
        investmentId,
        amount: withdrawAmount,
        walletId,
        walletAddress,
        blockchain,
        cryptocurrency,
        status: "UNVERIFIED",
        emailVerificationToken: require("crypto").randomBytes(32).toString("hex"),
        emailVerificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

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

    // Store in session for reference
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

    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();
    keyboard.text("📧 Resend Verification", "resend_withdrawal_verification");
    keyboard.row();
    keyboard.text("🔙 Back to My Trades", "view_my_trades");

    await ctx.reply(
      `📧 <b>Withdrawal Request Created!</b>\n\n
📝 <b>Withdrawal Details:</b>\n
Amount: ${withdrawAmount} USD\n
Blockchain: ${blockchain}\n\n
✅ A verification link has been sent to: <code>${user.email}</code>\n\n
<b>Please click the link in your email to confirm your withdrawal request.</b>\n\n
⏱️ The link expires in ${config.WITHDRAWAL_VERIFICATION_TOKEN_EXPIRY_MINUTES} minutes.`,
      {
        parse_mode: "HTML",
        reply_markup: keyboard,
      }
    );

    logger.info(`[WITHDRAWAL] New crypto withdrawal request created for user ${userId}:`, {
      withdrawalId: withdrawalRequest.id,
      amount: withdrawAmount,
      blockchain,
    });

    // Clear the withdrawal data from session
    delete ctx.session.withdrawalData;
  } catch (error) {
    logger.error("Error confirming crypto withdrawal:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Resend withdrawal verification email
 */
export async function handleResendWithdrawalVerification(ctx: SessionContext): Promise<void> {
  logger.info(`📧 Resending withdrawal verification email for user ${ctx.session.userId}`);

  try {
    const userId = ctx.session.userId;
    const user = await UserService.getUserById(userId);

    if (!user || !user.email) {
      await ctx.reply("❌ User email not found");
      return;
    }

    // Find the most recent unverified withdrawal request
    const withdrawalRequest = await (prisma as any).withdrawalRequest.findFirst({
      where: {
        userId,
        emailVerified: false,
        status: "UNVERIFIED",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!withdrawalRequest) {
      await ctx.reply(
        `❌ No pending withdrawal verification found.\n\nAll withdrawal requests have been verified or processed.`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back", callback_data: "view_my_trades" }]],
          },
        }
      );
      return;
    }

    // Generate new verification token
    const { token, expiry } = UserService.generateVerificationToken();

    // Update withdrawal request with new token
    await (prisma as any).withdrawalRequest.update({
      where: { id: withdrawalRequest.id },
      data: {
        emailVerificationToken: token,
        emailVerificationExpiry: expiry,
      },
    });

    // Send verification email
    const verificationUrl = `${process.env.BOT_WEBHOOK_URL || "http://localhost:3000"}/verify-withdrawal?token=${token}`;
    EmailService.sendWithdrawalVerificationEmail(
      user.email,
      user.firstName || "User",
      verificationUrl,
      token
    ).catch((err: any) => {
      logger.error("Failed to resend withdrawal verification email:", err);
    });

    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();
    keyboard.text("📧 Resend Again", "resend_withdrawal_verification");
    keyboard.row();
    keyboard.text("🔙 Back to My Trades", "view_my_trades");

    await ctx.reply(
      `✅ <b>Verification Email Resent!</b>\n\n
📧 A new verification link has been sent to: <code>${user.email}</code>\n\n
<b>Please check your inbox and click the verification link.</b>\n\n
⏱️ The link expires in ${config.WITHDRAWAL_VERIFICATION_TOKEN_EXPIRY_MINUTES} minutes.`,
      {
        parse_mode: "HTML",
        reply_markup: keyboard,
      }
    );

    logger.info(`Withdrawal verification email resent for request ${withdrawalRequest.id}`);
  } catch (error) {
    logger.error("Error resending withdrawal verification:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}
