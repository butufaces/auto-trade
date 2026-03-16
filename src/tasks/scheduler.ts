import cron from "node-cron";
import InvestmentService from "../services/investment.js";
import logger from "../config/logger.js";
import { config } from "../config/env.js";
import prisma from "../db/client.js";
import bot from "../index.js";

/**
 * Start all scheduled tasks
 */
export function startScheduledTasks(bot: any): void {
  logger.info("Starting scheduled tasks...");

  // Check and mature investments every N hours
  const checkMaturityInterval = config.AUTO_MATURITY_CHECK_INTERVAL_HOURS;
  const maturityPattern = `0 */${checkMaturityInterval} * * *`; // Every N hours

  cron.schedule(maturityPattern, async () => {
    try {
      logger.info("Running investment maturity check...");
      await InvestmentService.checkAndMatureInvestments();
    } catch (error) {
      logger.error("Error checking investment maturity:", error);
    }
  });

  // Daily accrual calculation
  if (config.AUTO_DAILY_ACCRUAL_ENABLED) {
    try {
      const [hours, minutes] = config.AUTO_DAILY_ACCRUAL_TIME.split(":").map(Number);
      const accrualPattern = `${minutes} ${hours} * * *`; // Every day at specified time

      cron.schedule(accrualPattern, async () => {
        try {
          logger.info("Running daily accrual calculation...");
          await InvestmentService.applyDailyAccrual();
        } catch (error) {
          logger.error("Error applying daily accrual:", error);
        }
      });

      logger.info(
        `✅ Daily accrual scheduled for ${config.AUTO_DAILY_ACCRUAL_TIME} UTC`
      );
    } catch (error) {
      logger.error("Error setting up daily accrual schedule:", error);
    }
  }

  // ROI distribution (monthly)
  if (config.ENABLE_AUTO_ROI_DISTRIBUTION) {
    const roiDay = config.ROI_DISTRIBUTION_DAY_OF_MONTH;
    const roiPattern = `0 0 ${roiDay} * *`; // Every month on specified day

    cron.schedule(roiPattern, async () => {
      try {
        logger.info("Running ROI distribution...");
        // Implementation: Find matured investments and complete them
        // await distributeROI();
      } catch (error) {
        logger.error("Error distributing ROI:", error);
      }
    });
  }

  // Payment expiry check (every minute to catch expired payments)
  cron.schedule("* * * * *", async () => {
    try {
      await checkExpiredPayments(bot);
    } catch (error) {
      logger.error("Error checking expired payments:", error);
    }
  });

  // Cleanup old PENDING trades (every hour)
  cron.schedule("0 * * * *", async () => {
    try {
      logger.info("Running cleanup for old PENDING trades...");
      await cleanupOldPendingTrades();
    } catch (error) {
      logger.error("Error cleaning up old PENDING trades:", error);
    }
  });

  logger.info("✅ Scheduled tasks started");
}

/**
 * Check for expired crypto payments and cancel them
 */
async function checkExpiredPayments(bot: any): Promise<void> {
  try {
    const now = new Date();

    // Find all pending payments that have expired
    const expiredPayments = await prisma.cryptoPayment.findMany({
      where: {
        status: "PENDING",
        expiresAt: {
          lt: now, // Expired (expiresAt is in the past)
        },
      },
      include: {
        user: true,
        investment: true,
      },
    });

    if (expiredPayments.length === 0) {
      return; // No expired payments
    }

    logger.info(
      `[SCHEDULER] Found ${expiredPayments.length} expired crypto payments`
    );

    for (const payment of expiredPayments) {
      try {
        // Update payment status to EXPIRED
        await prisma.cryptoPayment.update({
          where: { id: payment.id },
          data: {
            status: "EXPIRED",
            failedAt: now,
          },
        });

        // Check if investment is already ACTIVE (admin manually approved)
        const investment = await prisma.investment.findUnique({
          where: { id: payment.investmentId },
        });

        // Only cancel if still PENDING - don't cancel if admin already approved (ACTIVE)
        if (investment?.status === "PENDING") {
          // Update investment status to REJECTED
          await prisma.investment.update({
            where: { id: payment.investmentId },
            data: {
              status: "REJECTED",
            },
          });
        } else if (investment?.status === "ACTIVE") {
          // Payment already manually confirmed - just update crypto payment status
          logger.info(
            `[SCHEDULER] Investment ${payment.investmentId} already ACTIVE, skipping cancellation`
          );
          continue;
        }

        // Notify user of expiration
        try {
          const packageName = (payment.investment as any)?.package?.name || "Unknown";
          const message = `
⏰ <b>Payment Window Expired</b>

Your crypto payment window has closed. Your investment has been cancelled.

📊 <b>Investment Details:</b>
📦 Package: ${packageName}
💰 Amount: $${payment.amountUsd.toFixed(2)}

🔄 <b>What to do next:</b>
You can start a new investment anytime. Click button below to retry.
          `.trim();

          await bot.api.sendMessage(payment.user.telegramId.toString(), message, {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "💼 Try Again", callback_data: "invest" },
                  { text: "📊 Portfolio", callback_data: "portfolio" },
                ],
              ],
            },
          });

          logger.info(
            `[SCHEDULER] User ${payment.user.telegramId} notified of payment expiration`
          );
        } catch (notificationError) {
          logger.warn(
            `[SCHEDULER] Failed to notify user of payment expiration:`,
            notificationError
          );
        }

        logger.info(
          `[SCHEDULER] Payment expired and investment cancelled: ${payment.investmentId}`
        );
      } catch (error) {
        logger.error(
          `[SCHEDULER] Error processing expired payment ${payment.id}:`,
          error
        );
      }
    }
  } catch (error) {
    logger.error(`[SCHEDULER] Error in checkExpiredPayments:`, error);
  }
}

/**
 * Cleanup old PENDING trades (delete trades older than 24 hours)
 */
async function cleanupOldPendingTrades(): Promise<void> {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Find all PENDING trades older than 24 hours
    const oldPendingTrades = await prisma.investment.findMany({
      where: {
        status: "PENDING",
        createdAt: {
          lt: twentyFourHoursAgo, // Created more than 24 hours ago
        },
      },
    });

    if (oldPendingTrades.length === 0) {
      return; // No old pending trades to cleanup
    }

    logger.info(
      `[SCHEDULER] Found ${oldPendingTrades.length} old PENDING trades to cleanup`
    );

    // Delete the old pending trades
    const result = await prisma.investment.deleteMany({
      where: {
        status: "PENDING",
        createdAt: {
          lt: twentyFourHoursAgo,
        },
      },
    });

    logger.info(
      `[SCHEDULER] ✅ Deleted ${result.count} old PENDING trades (older than 24 hours)`
    );
  } catch (error) {
    logger.error(`[SCHEDULER] Error in cleanupOldPendingTrades:`, error);
  }
}

/**
 * Distribute ROI to completed investments
 */
export async function distributeROI(): Promise<void> {
  const maturedInvestments = await InvestmentService.getPendingInvestments();

  // Filter investments with status MATURED
  const completedInvestments: any[] = maturedInvestments.filter(
    (inv: any): boolean => inv.status === "MATURED"
  );

  for (const investment of completedInvestments) {
    try {
      await InvestmentService.completeInvestment(investment.id);
      logger.info(`ROI distributed for investment ${investment.id}`);
    } catch (error) {
      logger.error(`Failed to distribute ROI for ${investment.id}:`, error);
    }
  }
}

export default startScheduledTasks;
