import bot from "../index.js";
import logger from "../config/logger.js";
import { config } from "../config/env.js";
import { formatCurrency } from "../lib/helpers.js";

export class TelegramNotificationService {
  /**
   * Send notification to admin via Telegram
   */
  static async notifyAdminPaymentProof(
    userId: string,
    userName: string,
    amount: number,
    investmentId: string,
    userTelegramId?: string
  ): Promise<void> {
    try {
      if (!config.ADMIN_CHAT_ID) {
        logger.warn("ADMIN_CHAT_ID not configured. Skipping Telegram notification.");
        return;
      }

      let message = `<b>💬 New Payment Proof Received</b>\n\n`;
      message += `<b>User Details:</b>\n`;
      message += `👤 Name: ${userName}\n`;
      message += `🆔 User ID: ${userId}\n`;
      if (userTelegramId) {
        message += `📱 Telegram ID: <code>${userTelegramId}</code>\n`;
      }
      message += `\n<b>Investment Details:</b>\n`;
      message += `💵 Amount: $${Number(amount).toLocaleString()}\n`;
      message += `📋 Investment ID: <code>${investmentId}</code>\n`;
      message += `📅 Timestamp: ${new Date().toLocaleString()}\n\n`;
      message += `<b>Action Required:</b>\n`;
      message += `Please review the payment proof in the admin panel.\n`;
      message += `Use: <b>/admin</b> → <b>✅ Payment Verification</b>`;

      await bot.api.sendMessage(config.ADMIN_CHAT_ID.toString(), message, {
        parse_mode: "HTML",
      });

      logger.info(
        `[TELEGRAM] Payment proof notification sent to admin for investment ${investmentId}`
      );
    } catch (error) {
      logger.error(
        `[TELEGRAM] Failed to send payment proof notification to admin:`,
        error
      );
      // Don't throw - we don't want Telegram issues to break the payment flow
    }
  }

  /**
   * Send notification to admin when payment is approved
   */
  static async notifyAdminPaymentApproved(
    investmentId: string,
    userId: string,
    amount: number,
    userName: string
  ): Promise<void> {
    try {
      if (!config.ADMIN_CHAT_ID) {
        logger.warn("ADMIN_CHAT_ID not configured. Skipping Telegram notification.");
        return;
      }

      let message = `<b>✅ Payment Approved</b>\n\n`;
      message += `<b>User:</b> ${userName} (ID: ${userId})\n`;
      message += `<b>Amount:</b> ${formatCurrency(amount)}\n`;
      message += `<b>Investment ID:</b> <code>${investmentId}</code>\n`;
      message += `<b>Status:</b> Investment activated`;

      await bot.api.sendMessage(config.ADMIN_CHAT_ID.toString(), message, {
        parse_mode: "HTML",
      });

      logger.info(
        `[TELEGRAM] Payment approved notification sent to admin for investment ${investmentId}`
      );
    } catch (error) {
      logger.error(
        `[TELEGRAM] Failed to send payment approved notification:`,
        error
      );
    }
  }

  /**
   * Send notification to admin when payment is rejected
   */
  static async notifyAdminPaymentRejected(
    investmentId: string,
    userId: string,
    amount: number,
    userName: string,
    reason: string
  ): Promise<void> {
    try {
      if (!config.ADMIN_CHAT_ID) {
        logger.warn("ADMIN_CHAT_ID not configured. Skipping Telegram notification.");
        return;
      }

      let message = `<b>❌ Payment Rejected</b>\n\n`;
      message += `<b>User:</b> ${userName} (ID: ${userId})\n`;
      message += `<b>Amount:</b> ${formatCurrency(amount)}\n`;
      message += `<b>Investment ID:</b> <code>${investmentId}</code>\n`;
      message += `<b>Reason:</b> ${reason}`;

      await bot.api.sendMessage(config.ADMIN_CHAT_ID.toString(), message, {
        parse_mode: "HTML",
      });

      logger.info(
        `[TELEGRAM] Payment rejected notification sent to admin for investment ${investmentId}`
      );
    } catch (error) {
      logger.error(
        `[TELEGRAM] Failed to send payment rejected notification:`,
        error
      );
    }
  }

  /**
   * Send notification to admin when new investment is created
   */
  static async notifyAdminNewInvestment(
    investmentId: string,
    userId: string,
    userName: string,
    amount: number,
    packageName: string,
    packageIcon: string,
    userTelegramId?: string
  ): Promise<void> {
    try {
      if (!config.ADMIN_CHAT_ID) {
        logger.warn("ADMIN_CHAT_ID not configured. Skipping Telegram notification.");
        return;
      }

      let message = `<b>${packageIcon} New Investment Request</b>\n\n`;
      message += `<b>User Details:</b>\n`;
      message += `👤 Name: ${userName}\n`;
      message += `🆔 User ID: ${userId}\n`;
      if (userTelegramId) {
        message += `📱 Telegram ID: <code>${userTelegramId}</code>\n`;
      }
      message += `\n<b>Investment Details:</b>\n`;
      message += `📦 Package: ${packageName}\n`;
      message += `💵 Amount: ${formatCurrency(amount)}\n`;
      message += `📋 Investment ID: <code>${investmentId}</code>\n`;
      message += `📅 Timestamp: ${new Date().toLocaleString()}\n\n`;
      message += `<b>Action Required:</b>\n`;
      message += `Awaiting payment proof from user.\n`;
      message += `Use: <b>/admin</b> → <b>📊 Manage Investments</b>`;

      await bot.api.sendMessage(config.ADMIN_CHAT_ID.toString(), message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "💰 View Investment", callback_data: `view_investment_${investmentId}` }],
            [{ text: "🏠 Back", callback_data: "back_to_menu" }]
          ]
        }
      });

      logger.info(
        `[TELEGRAM] New investment notification sent to admin for investment ${investmentId}`
      );
    } catch (error: any) {
      if (error?.message?.includes("chat not found") || error?.message?.includes("400")) {
        logger.error(
          `[TELEGRAM] Invalid ADMIN_CHAT_ID: ${config.ADMIN_CHAT_ID}. Chat not found. Please verify your ADMIN_CHAT_ID in .env file.`
        );
      } else {
        logger.error(
          `[TELEGRAM] Failed to send new investment notification to admin:`,
          error
        );
      }
    }
  }

  /**
   * Send notification to admin when new withdrawal request is created
   */
  static async notifyAdminNewWithdrawal(
    withdrawalId: string,
    investmentId: string,
    userId: string,
    userName: string,
    amount: number,
    userTelegramId?: string
  ): Promise<void> {
    try {
      if (!config.ADMIN_CHAT_ID) {
        logger.warn("ADMIN_CHAT_ID not configured. Skipping Telegram notification.");
        return;
      }

      let message = `<b>💸 New Withdrawal Request</b>\n\n`;
      message += `<b>User Details:</b>\n`;
      message += `👤 Name: ${userName}\n`;
      message += `🆔 User ID: ${userId}\n`;
      if (userTelegramId) {
        message += `📱 Telegram ID: <code>${userTelegramId}</code>\n`;
      }
      message += `\n<b>💰 Crypto Withdrawal Details:</b>\n`;
      message += `💵 Amount: ${formatCurrency(amount)}\n`;
      message += `🪙 Cryptocurrency: USDT\n`;
      message += `⛓️ Blockchain: TBD (Wallet Required)\n`;
      message += `📋 Withdrawal ID: <code>${withdrawalId}</code>\n`;
      message += `📊 Investment ID: <code>${investmentId}</code>\n`;
      message += `📅 Requested: ${new Date().toLocaleString()}\n\n`;
      message += `<b>⚠️ Status:</b>\n`;
      message += `Email verification required before processing.\n`;
      message += `Wallet address will be shown when viewing details.\n\n`;
      message += `<b>Action Required:</b>\n`;
      message += `Use: <b>/admin</b> → <b>💱 Manage Withdrawals</b>`;

      await bot.api.sendMessage(config.ADMIN_CHAT_ID.toString(), message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "💸 View Withdrawal Details", callback_data: `admin_view_withdrawal_${withdrawalId}` }],
            [{ text: "🏠 Back", callback_data: "back_to_menu" }]
          ]
        }
      });

      logger.info(
        `[TELEGRAM] New withdrawal notification sent to admin for withdrawal ${withdrawalId}`
      );
    } catch (error: any) {
      if (error?.message?.includes("chat not found") || error?.message?.includes("400")) {
        logger.error(
          `[TELEGRAM] Invalid ADMIN_CHAT_ID: ${config.ADMIN_CHAT_ID}. Chat not found. Please verify your ADMIN_CHAT_ID in .env file.`
        );
      } else {
        logger.error(
          `[TELEGRAM] Failed to send new withdrawal notification to admin:`,
          error
        );
      }
    }
  }

  /**
   * Notify user that their withdrawal has been paid
   */
  static async notifyUserWithdrawalPaid(
    userTelegramId: string,
    amount: number,
    blockchain: string,
    cryptocurrency: string,
    walletAddress: string
  ): Promise<void> {
    try {
      if (!userTelegramId) {
        logger.warn("User Telegram ID not available for withdrawal payment notification");
        return;
      }

      const message = `✅ <b>Withdrawal Payment Received!</b>\n\nYour withdrawal has been paid to your wallet.\n\n💰 <b>Details:</b>\n\nAmount: ${formatCurrency(amount)}\n\nBlockchain: ${blockchain}\n\nCryptocurrency: ${cryptocurrency.toUpperCase()}\n\nWallet: <code>${walletAddress.substring(0, 20)}...</code>\n\n⏱️ Please allow 5-30 minutes for the transaction to appear in your wallet.`;

      await bot.api.sendMessage(userTelegramId, message, {
        parse_mode: "HTML",
      });

      logger.info(
        `[TELEGRAM] Withdrawal payment notification sent to user ${userTelegramId}`
      );
    } catch (error: any) {
      logger.error(
        `[TELEGRAM] Failed to send withdrawal payment notification to user:`,
        error
      );
    }
  }
}

export default TelegramNotificationService;
