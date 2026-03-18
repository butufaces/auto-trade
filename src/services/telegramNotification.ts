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
            [{ text: "💰 View Trade", callback_data: `view_investment_${investmentId}` }],
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

      // Fetch withdrawal details to include wallet info
      const prisma = (await import("../db/client.js")).default;
      const withdrawal = await prisma.withdrawalRequest.findUnique({
        where: { id: withdrawalId },
      });

      let message = `<b>💸 New Withdrawal Request</b>\n\n`;
      message += `<b>User Details:</b>\n`;
      message += `👤 Name: ${userName}\n`;
      message += `🆔 User ID: ${userId}\n`;
      if (userTelegramId) {
        message += `📱 Telegram ID: <code>${userTelegramId}</code>\n`;
      }
      message += `\n<b>💰 Withdrawal Details:</b>\n`;
      message += `💵 Amount: ${formatCurrency(amount)}\n`;
      message += `🪙 Cryptocurrency: ${withdrawal?.cryptocurrency?.toUpperCase() || "USDT"}\n`;
      message += `⛓️ Blockchain: ${withdrawal?.blockchain?.toUpperCase() || "PENDING"}\n`;
      if (withdrawal?.walletAddress) {
        message += `💳 Wallet Address:\n<code>${withdrawal.walletAddress}</code>\n`;
      } else {
        message += `⚠️ Wallet: PENDING\n`;
      }
      message += `📋 Withdrawal ID: <code>${withdrawalId}</code>\n`;
      message += `📊 Investment ID: <code>${investmentId}</code>\n`;
      message += `📅 Requested: ${new Date().toLocaleString()}\n\n`;
      message += `<b>⚠️ Status:</b>\n`;
      message += `Email verification required before processing.\n`;
      if (!withdrawal?.walletAddress) {
        message += `⚠️ Wallet details will be shown when verified.\n`;
      }
      message += `\n<b>Action Required:</b>\n`;
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

  /**
   * Notify admin when user opens new trade
   */
  static async notifyAdminNewTrade(
    investmentId: string,
    userId: string,
    userName: string,
    amount: number,
    packageName: string,
    cryptocurrency: string,
    blockchain: string,
    userTelegramId?: string
  ): Promise<void> {
    try {
      if (!config.ADMIN_CHAT_ID) {
        logger.warn("ADMIN_CHAT_ID not configured. Skipping admin trade notification.");
        return;
      }

      let message = `🚀 <b>New Trade Opened</b>\n\n`;
      message += `<b>User Details:</b>\n`;
      message += `👤 Name: ${userName}\n`;
      if (userTelegramId) {
        message += `📱 Telegram ID: <code>${userTelegramId}</code>\n`;
      }
      message += `\n<b>📊 Trade Details:</b>\n`;
      message += `💰 Amount: ${formatCurrency(amount)}\n`;
      message += `📦 Package: ${packageName}\n`;
      message += `🪙 Cryptocurrency: ${cryptocurrency.toUpperCase()}\n`;
      message += `⛓️ Blockchain: ${blockchain}\n`;
      message += `📋 Investment ID: <code>${investmentId}</code>\n`;
      message += `\n<b>⏳ Status:</b>\n`;
      message += `Awaiting payment confirmation`;

      await bot.api.sendMessage(config.ADMIN_CHAT_ID.toString(), message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "💼 View Trade", callback_data: `admin_view_investment_${investmentId}` }],
            [{ text: "🏠 Back", callback_data: "back_to_menu" }]
          ]
        }
      });

      logger.info(
        `[TELEGRAM] Admin notified of new trade for investment ${investmentId}`
      );
    } catch (error: any) {
      logger.error(
        `[TELEGRAM] Failed to send admin new trade notification:`,
        error
      );
    }
  }

  /**
   * Notify referrer that they got a new referral
   */
  static async notifyReferrerNewReferral(
    referrerName: string,
    referrerTelegramId: string | number,
    referredUserName: string,
    referralCount: number
  ): Promise<void> {
    try {
      let message = `🎁 <b>New Referral Registered!</b>\n\n`;
      message += `Great news! <b>${referredUserName}</b> just signed up using your referral code.\n\n`;
      message += `<b>📊 Your Referral Stats:</b>\n`;
      message += `👥 Total Referrals: <b>${referralCount}</b>\n`;
      message += `\n💡 <b>Tip:</b> You earn 10% commission when your referrals make deposits!\n`;
      message += `\n📈 Share your referral code to earn more bonuses.`;

      await bot.api.sendMessage(referrerTelegramId.toString(), message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎁 My Referrals", callback_data: "view_my_referrals" }],
            [{ text: "📤 Share Code", callback_data: "share_referral_code" }]
          ]
        }
      });

      logger.info(
        `[TELEGRAM] Referrer ${referrerTelegramId} notified of new referral ${referredUserName}`
      );
    } catch (error: any) {
      logger.error(
        `[TELEGRAM] Failed to send referrer notification:`,
        error
      );
    }
  }

  /**
   * Broadcast payout proof notification to all bot visitors
   */
  static async broadcastPayoutProof(
    walletAddress: string,
    blockchain: string,
    amount?: string,
    transactionLink?: string
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
  }> {
    const BotVisitorService = (await import("./botVisitor.js")).default;
    
    try {
      // Get all visitor chat IDs
      const chatIds = await BotVisitorService.getAllVisitorChatIds();

      if (chatIds.length === 0) {
        logger.info("[TELEGRAM] No visitors to broadcast payout proof to");
        return { total: 0, successful: 0, failed: 0 };
      }

      logger.info(
        `[TELEGRAM] Broadcasting payout proof to ${chatIds.length} visitors`
      );

      let successful = 0;
      let failed = 0;

      // Build message
      const displayWallet = `${walletAddress.substring(0, 10)}...${walletAddress.substring(
        walletAddress.length - 8
      )}`;

      const message = `💸 <b>New Payout Proof!</b>

✅ <b>Withdrawal Confirmed</b>

🏦 Blockchain: <code>${blockchain}</code>
💰 Amount: ${amount ? `<b>$${amount}</b>` : "Withdrawn"}
👛 Wallet: <code>${displayWallet}</code>

This is proof that we're processing real withdrawals to our users! 🚀

View all proofs on our Payout Proofs page.`;

      // Send to each visitor
      for (const chatId of chatIds) {
        try {
          let keyboard: any = undefined;
          if (transactionLink) {
            keyboard = {
              inline_keyboard: [
                [
                  {
                    text: "🔗 View Transaction",
                    url: transactionLink,
                  },
                ],
                [
                  {
                    text: "📊 View All Proofs",
                    callback_data: "view_payout_proofs",
                  },
                ],
              ],
            };
          } else {
            keyboard = {
              inline_keyboard: [
                [
                  {
                    text: "📊 View All Proofs",
                    callback_data: "view_payout_proofs",
                  },
                ],
              ],
            };
          }

          await bot.api.sendMessage(chatId, message, {
            parse_mode: "HTML",
            reply_markup: keyboard,
          });

          successful++;
        } catch (error: any) {
          logger.warn(`[TELEGRAM] Failed to send to chat ${chatId}:`, error.message);
          failed++;
        }
      }

      logger.info(
        `[TELEGRAM] Payout proof broadcast complete: ${successful}/${chatIds.length} successful, ${failed} failed`
      );

      return { total: chatIds.length, successful, failed };
    } catch (error: any) {
      logger.error("[TELEGRAM] Failed to broadcast payout proof:", error);
      throw error;
    }
  }
}

export default TelegramNotificationService;
