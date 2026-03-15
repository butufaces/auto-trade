import { Context } from "grammy";
import prisma from "../db/client.js";
import UserService from "../services/user.js";
import InvestmentService from "../services/investment.js";
import { formatCurrency } from "../lib/helpers.js";
import logger from "../config/logger.js";

type SessionContext = Context & { session: any };

/**
 * My Trades Handler - View all investments with pagination
 */
export async function handleViewMyTrades(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: My Trades by user ${ctx.session.userId}`);

  try {
    const userId = ctx.session.userId;
    if (!userId) {
      await ctx.reply("❌ User ID not found in session");
      return;
    }

    const page = ctx.session.tradesPage || 1;
    const perPage = 5; // Show 5 trades per page

    // Get user profile
    const user = await UserService.getUserById(userId);
    if (!user) {
      await ctx.reply("❌ User not found");
      return;
    }

    // Get all investments
    const allInvestments = await prisma.investment.findMany({
      where: { userId },
      include: { package: true },
      orderBy: [
        { status: "asc" }, // Show active first
        { createdAt: "desc" }, // Then by date
      ],
    });

    logger.info(`📊 My Trades: Found ${allInvestments.length} investments for user ${userId}`);

    if (allInvestments.length === 0) {
      const { InlineKeyboard } = await import("grammy");
      const keyboard = new InlineKeyboard();
      keyboard.text("🚀 Start Trading", "select_package_0");
      keyboard.row();
      keyboard.text("🔙 Back", "back_to_menu");

      await ctx.reply(
        `<b>📊 My Trades</b>\n\n` +
        `You haven't started trading yet!\n\n` +
        `Tap below to explore our packages and start earning today! 🎯`,
        {
          parse_mode: "HTML",
          reply_markup: keyboard,
        }
      );
      return;
    }

    // Pagination
    const totalPages = Math.ceil(allInvestments.length / perPage);
    const validPage = Math.min(Math.max(page, 1), totalPages);
    ctx.session.tradesPage = validPage;

    const start = (validPage - 1) * perPage;
    const end = start + perPage;
    const pageInvestments = allInvestments.slice(start, end);

    // Build message
    let message = `<b>📊 My Trades</b>\n`;
    message += `<i>Page ${validPage}/${totalPages} (${allInvestments.length} total)</i>\n\n`;

    // Summary stats
    const activeCount = allInvestments.filter((i) => i.status === "ACTIVE").length;
    const maturedCount = allInvestments.filter((i) => i.status === "MATURED").length;
    const completedCount = allInvestments.filter(
      (i) => i.status === "COMPLETED"
    ).length;
    const rejectedCount = allInvestments.filter((i) => i.status === "REJECTED").length;

    message += `<b>Status Summary:</b>\n`;
    if (activeCount > 0) message += `🔵 Active: ${activeCount}\n`;
    if (maturedCount > 0) message += `🟢 Matured: ${maturedCount}\n`;
    if (completedCount > 0) message += `✅ Completed: ${completedCount}\n`;
    if (rejectedCount > 0) message += `❌ Rejected: ${rejectedCount}\n`;
    message += `\n━━━━━━━━━━━━━━━━━━━\n\n`;

    // Trades on this page
    for (let i = 0; i < pageInvestments.length; i++) {
      const inv = pageInvestments[i];
      const tradeNum = start + i + 1;

      // Status emoji and text
      let statusEmoji: string = "❓";
      let statusText: string = inv.status;

      if (inv.status === "ACTIVE") {
        statusEmoji = "🔵";
        statusText = "ACTIVE";
      } else if (inv.status === "MATURED") {
        statusEmoji = "🟢";
        statusText = "MATURED";
      } else if (inv.status === "COMPLETED") {
        statusEmoji = "✅";
        statusText = "COMPLETED";
      } else if (inv.status === "PENDING") {
        statusEmoji = "⏳";
        statusText = "AWAITING";
      } else if (inv.status === "AWAITING_PAYMENT") {
        statusEmoji = "💳";
        statusText = "AWAITING";
      } else if (inv.status === "REJECTED") {
        statusEmoji = "❌";
        statusText = "REJECTED";
      } else if (inv.status === "PAYMENT_REJECTED") {
        statusEmoji = "❌";
        statusText = "PAYMENT REJECTED";
      } else if (inv.status === "PAYOUT_REQUESTED") {
        statusEmoji = "⏳";
        statusText = "PAYOUT PENDING";
      }

      message += `<b>${tradeNum}. ${statusEmoji} ${inv.package.name}</b>\n`;
      message += `Amount: ${formatCurrency(inv.amount)}\n`;
      message += `ROI: ${inv.roiPercentage}%\n`;

      // Days info
      if (inv.status === "ACTIVE" || inv.status === "MATURED") {
        try {
          const daysElapsed = Math.floor(
            (Date.now() - new Date(inv.activatedAt || inv.createdAt).getTime()) /
            (1000 * 60 * 60 * 24)
          );
          const totalDays = inv.package.duration;
          const daysRemaining = Math.max(0, totalDays - daysElapsed);
          message += `Progress: ${daysElapsed}/${totalDays} days`;
          if (daysRemaining > 0) {
            message += ` (${daysRemaining} remaining)`;
          }
          message += `\n`;

          // Current value
          const realTime = InvestmentService.calculateRealTimeValue(inv as any);
          message += `Current Value: ${formatCurrency(realTime.currentValue)}\n`;
        } catch (error) {
          logger.warn(`Error calculating real-time value for investment ${inv.id}:`, error);
          message += `Current Value: ${formatCurrency(inv.amount + inv.totalAccruedProfit)}\n`;
        }
      } else if (inv.status === "COMPLETED") {
        message += `Total Earned: ${formatCurrency(inv.totalProfit)}\n`;
        message += `Withdrawn: ${formatCurrency(inv.availableWithdrawable || inv.totalProfit)}\n`;
      } else if (inv.status === "PENDING" || inv.status === "AWAITING_PAYMENT") {
        message += `Expected Return: ${formatCurrency(inv.expectedReturn)}\n`;
      }

      message += `Status: ${statusEmoji} ${statusText}\n`;
      message += `\n`;
    }

    // Build keyboard
    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();

    // Trade buttons
    for (const inv of pageInvestments) {
      keyboard.text(
        `${inv.package.name} - ${formatCurrency(inv.amount)}`,
        `view_investment_${inv.id}`
      );
      keyboard.row();
    }

    // Pagination buttons
    if (totalPages > 1) {
      if (validPage > 1) {
        keyboard.text("⬅️ Previous", "my_trades_prev_page");
      }
      if (validPage < totalPages) {
        keyboard.text("Next ➡️", "my_trades_next_page");
      }
      keyboard.row();
    }

    keyboard.text("🔙 Back", "back_to_menu");

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error("Error viewing my trades:", error);
    await ctx.reply(
      `❌ Failed to load trades: ${(error as Error).message}`
    );
  }
}
