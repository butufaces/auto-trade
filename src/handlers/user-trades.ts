import { Context } from "grammy";
import prisma from "../db/client.js";
import UserService from "../services/user.js";
import InvestmentService from "../services/investment.js";
import { formatCurrency } from "../lib/helpers.js";
import logger from "../config/logger.js";

type SessionContext = Context & { session: any };

const TRADES_PER_PAGE = 5;

/**
 * My Trades Category Menu - Show category selection
 */
export async function handleViewMyTrades(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: My Trades Menu by user ${ctx.session.userId}`);

  try {
    const userId = ctx.session.userId;
    if (!userId) {
      await ctx.reply("❌ User ID not found in session");
      return;
    }

    // Get counts for each category
    const activeCount = await prisma.investment.count({
      where: { userId, status: "ACTIVE" },
    });

    const readyToWithdrawCount = await prisma.investment.count({
      where: { userId, status: "MATURED" },
    });

    const completedCount = await prisma.investment.count({
      where: { userId, status: "COMPLETED" },
    });

    const pendingCount = await prisma.investment.count({
      where: { userId, status: "PENDING" },
    });

    const totalCount = activeCount + readyToWithdrawCount + completedCount + pendingCount;

    logger.info(
      `📊 My Trades Menu: Active=${activeCount} ReadyToWithdraw=${readyToWithdrawCount} Completed=${completedCount} Pending=${pendingCount} for user ${userId}`
    );

    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();

    // Category buttons with counts
    if (activeCount > 0) {
      keyboard.text(`🔵 Active Trades (${activeCount})`, "view_trades_active");
    } else {
      keyboard.text(`🔵 Active Trades`, "view_trades_active");
    }
    keyboard.row();

    if (readyToWithdrawCount > 0) {
      keyboard.text(`🟢 Ready to Withdraw Trades (${readyToWithdrawCount})`, "view_trades_ready_to_withdraw");
    } else {
      keyboard.text(`🟢 Ready to Withdraw Trades`, "view_trades_ready_to_withdraw");
    }
    keyboard.row();

    if (completedCount > 0) {
      keyboard.text(`✅ Completed Trades (${completedCount})`, "view_trades_completed");
    } else {
      keyboard.text(`✅ Completed Trades`, "view_trades_completed");
    }
    keyboard.row();

    if (pendingCount > 0) {
      keyboard.text(`⏳ Pending Trades (${pendingCount})`, "view_trades_pending");
    } else {
      keyboard.text(`⏳ Pending Trades`, "view_trades_pending");
    }
    keyboard.row();

    keyboard.text("🔙 Back to Menu", "back_to_menu");

    let message = `<b>💼 My Trades</b>\n\n`;
    message += `Total Trades: ${totalCount}\n\n`;
    message += `Select a category to view your trades:`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error("Error viewing my trades menu:", error);
    await ctx.reply(
      `❌ Failed to load trades menu: ${(error as Error).message}`
    );
  }
}

/**
 * View Active Trades
 */
export async function handleViewActiveTrades(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Active Trades by user ${ctx.session.userId}`);

  try {
    const userId = ctx.session.userId;
    if (!userId) {
      await ctx.reply("❌ User ID not found in session");
      return;
    }

    const pageNum = ctx.session.tradesActivePage || 1;

    const activeTrades = await prisma.investment.findMany({
      where: { userId, status: "ACTIVE" },
      include: { package: true },
      orderBy: { activatedAt: "desc" },
    });

    logger.info(`📊 Active Trades: Found ${activeTrades.length} for user ${userId}`);

    if (activeTrades.length === 0) {
      const { InlineKeyboard } = await import("grammy");
      const keyboard = new InlineKeyboard();
      keyboard.text("🚀 Start Trading", "start_new_investment");
      keyboard.row();
      keyboard.text("🔙 Back", "trades_back_to_menu");

      await ctx.reply(
        `<b>🔵 Active Trades</b>\n\n` +
        `You have no active trades.\n\n` +
        `Start a new investment to begin earning! 🎯`,
        {
          parse_mode: "HTML",
          reply_markup: keyboard,
        }
      );
      return;
    }

    // Pagination
    const totalPages = Math.ceil(activeTrades.length / TRADES_PER_PAGE);
    const validPage = Math.min(Math.max(pageNum, 1), totalPages);
    ctx.session.tradesActivePage = validPage;

    const pageStart = (validPage - 1) * TRADES_PER_PAGE;
    const pageEnd = pageStart + TRADES_PER_PAGE;
    const pageInvestments = activeTrades.slice(pageStart, pageEnd);

    // Build keyboard only (no message text)
    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();

    // Trade buttons
    pageInvestments.forEach((inv) => {
      keyboard.text(
        `${inv.package.name} - ${formatCurrency(inv.amount)}`,
        `view_trade_${inv.id}`
      );
      keyboard.row();
    });

    // Pagination buttons
    if (totalPages > 1) {
      if (validPage > 1) {
        keyboard.text("⬅️ Previous", "trades_active_prev");
      }
      if (validPage < totalPages) {
        keyboard.text("Next ➡️", "trades_active_next");
      }
      keyboard.row();
    }

    keyboard.text("🔙 Back to Categories", "trades_back_to_menu");

    await ctx.reply("🔵 Active Trades", {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error("Error viewing active trades:", error);
    await ctx.reply(
      `❌ Failed to load active trades: ${(error as Error).message}`
    );
  }
}

/**
 * View Completed Trades
 */
export async function handleViewCompletedTrades(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Completed Trades by user ${ctx.session.userId}`);

  try {
    const userId = ctx.session.userId;
    if (!userId) {
      await ctx.reply("❌ User ID not found in session");
      return;
    }

    const pageNum = ctx.session.tradesCompletedPage || 1;

    const completedTrades = await prisma.investment.findMany({
      where: { userId, status: "COMPLETED" },
      include: { package: true },
      orderBy: { completedAt: "desc" },
    });

    logger.info(`📊 Completed Trades: Found ${completedTrades.length} for user ${userId}`);

    if (completedTrades.length === 0) {
      const { InlineKeyboard } = await import("grammy");
      const keyboard = new InlineKeyboard();
      keyboard.text("🚀 Start Trading", "start_new_investment");
      keyboard.row();
      keyboard.text("🔙 Back", "trades_back_to_menu");

      await ctx.reply(
        `<b>✅ Completed Trades</b>\n\n` +
        `You have no completed trades yet.\n\n` +
        `Complete your first investment to see it here! 🎯`,
        {
          parse_mode: "HTML",
          reply_markup: keyboard,
        }
      );
      return;
    }

    // Pagination
    const totalPages = Math.ceil(completedTrades.length / TRADES_PER_PAGE);
    const validPage = Math.min(Math.max(pageNum, 1), totalPages);
    ctx.session.tradesCompletedPage = validPage;

    const pageStart = (validPage - 1) * TRADES_PER_PAGE;
    const pageEnd = pageStart + TRADES_PER_PAGE;
    const pageInvestments = completedTrades.slice(pageStart, pageEnd);

    // Build keyboard only (no message text)
    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();

    // Trade buttons
    pageInvestments.forEach((inv) => {
      keyboard.text(
        `${inv.package.name} - ${formatCurrency(inv.amount)}`,
        `view_trade_${inv.id}`
      );
      keyboard.row();
    });

    // Pagination buttons
    if (totalPages > 1) {
      if (validPage > 1) {
        keyboard.text("⬅️ Previous", "trades_completed_prev");
      }
      if (validPage < totalPages) {
        keyboard.text("Next ➡️", "trades_completed_next");
      }
      keyboard.row();
    }

    keyboard.text("🔙 Back to Categories", "trades_back_to_menu");

    await ctx.reply("✅ Completed Trades", {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error("Error viewing completed trades:", error);
    await ctx.reply(
      `❌ Failed to load completed trades: ${(error as Error).message}`
    );
  }
}

/**
 * View Pending Trades
 */
export async function handleViewPendingTrades(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Pending Trades by user ${ctx.session.userId}`);

  try {
    const userId = ctx.session.userId;
    if (!userId) {
      await ctx.reply("❌ User ID not found in session");
      return;
    }

    const pageNum = ctx.session.tradesPendingPage || 1;

    const pendingTrades = await prisma.investment.findMany({
      where: { userId, status: "PENDING" },
      include: { package: true },
      orderBy: { createdAt: "desc" },
    });

    logger.info(`📊 Pending Trades: Found ${pendingTrades.length} for user ${userId}`);

    if (pendingTrades.length === 0) {
      const { InlineKeyboard } = await import("grammy");
      const keyboard = new InlineKeyboard();
      keyboard.text("🚀 Start Trading", "start_new_investment");
      keyboard.row();
      keyboard.text("🔙 Back", "trades_back_to_menu");

      await ctx.reply(
        `<b>⏳ Pending Trades</b>\n\n` +
        `You have no pending trades.\n\n` +
        `All your trades have been processed! ✅\n\n` +
        `⏰ <b>Note:</b> Pending trades are automatically cleared after 24 hours if no payment is confirmed.`,
        {
          parse_mode: "HTML",
          reply_markup: keyboard,
        }
      );
      return;
    }

    // Pagination
    const totalPages = Math.ceil(pendingTrades.length / TRADES_PER_PAGE);
    const validPage = Math.min(Math.max(pageNum, 1), totalPages);
    ctx.session.tradesPendingPage = validPage;

    const pageStart = (validPage - 1) * TRADES_PER_PAGE;
    const pageEnd = pageStart + TRADES_PER_PAGE;
    const pageInvestments = pendingTrades.slice(pageStart, pageEnd);

    // Build keyboard only (no message text)
    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();

    // Trade buttons
    pageInvestments.forEach((inv) => {
      keyboard.text(
        `${inv.package.name} - ${formatCurrency(inv.amount)}`,
        `view_trade_${inv.id}`
      );
      keyboard.row();
    });

    // Pagination buttons
    if (totalPages > 1) {
      if (validPage > 1) {
        keyboard.text("⬅️ Previous", "trades_pending_prev");
      }
      if (validPage < totalPages) {
        keyboard.text("Next ➡️", "trades_pending_next");
      }
      keyboard.row();
    }

    keyboard.text("🔙 Back to Categories", "trades_back_to_menu");

    await ctx.reply(
      `<b>⏳ Pending Trades (${pendingTrades.length})</b>\n\n` +
      `⏰ <b>Auto-Clear:</b> Trades are automatically cleared after 24 hours if no payment is confirmed.\n\n` +
      `<i>Daily cleanup runs automatically.</i>`,
      {
        parse_mode: "HTML",
        reply_markup: keyboard,
      }
    );
  } catch (error) {
    logger.error("Error viewing pending trades:", error);
    await ctx.reply(
      `❌ Failed to load pending trades: ${(error as Error).message}`
    );
  }
}

/**
 * View Ready to Withdraw Trades (MATURED status)
 */
export async function handleViewReadyToWithdrawTrades(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Ready to Withdraw Trades by user ${ctx.session.userId}`);

  try {
    const userId = ctx.session.userId;
    if (!userId) {
      await ctx.reply("❌ User ID not found in session");
      return;
    }

    const pageNum = ctx.session.tradesReadyToWithdrawPage || 1;

    const readyToWithdrawTrades = await prisma.investment.findMany({
      where: { userId, status: "MATURED" },
      include: { package: true },
      orderBy: { maturityDate: "asc" },
    });

    logger.info(`📊 Ready to Withdraw Trades: Found ${readyToWithdrawTrades.length} for user ${userId}`);

    if (readyToWithdrawTrades.length === 0) {
      const { InlineKeyboard } = await import("grammy");
      const keyboard = new InlineKeyboard();
      keyboard.text("🚀 Start Trading", "start_new_investment");
      keyboard.row();
      keyboard.text("🔙 Back", "trades_back_to_menu");

      await ctx.reply(
        `<b>🟢 Ready to Withdraw Trades</b>\n\n` +
        `You have no trades ready for withdrawal.\n\n` +
        `Complete your first investment to have trades mature! 🎯`,
        {
          parse_mode: "HTML",
          reply_markup: keyboard,
        }
      );
      return;
    }

    // Pagination
    const totalPages = Math.ceil(readyToWithdrawTrades.length / TRADES_PER_PAGE);
    const validPage = Math.min(Math.max(pageNum, 1), totalPages);
    ctx.session.tradesReadyToWithdrawPage = validPage;

    const pageStart = (validPage - 1) * TRADES_PER_PAGE;
    const pageEnd = pageStart + TRADES_PER_PAGE;
    const pageInvestments = readyToWithdrawTrades.slice(pageStart, pageEnd);

    // Build keyboard only (no message text)
    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();

    // Trade buttons
    pageInvestments.forEach((inv) => {
      keyboard.text(
        `${inv.package.name} - ${formatCurrency(inv.amount)}`,
        `view_trade_${inv.id}`
      );
      keyboard.row();
    });

    // Pagination buttons
    if (totalPages > 1) {
      if (validPage > 1) {
        keyboard.text("⬅️ Previous", "trades_ready_to_withdraw_prev");
      }
      if (validPage < totalPages) {
        keyboard.text("Next ➡️", "trades_ready_to_withdraw_next");
      }
      keyboard.row();
    }

    keyboard.text("🔙 Back to Categories", "trades_back_to_menu");

    await ctx.reply("🟢 Ready to Withdraw Trades", {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error("Error viewing ready to withdraw trades:", error);
    await ctx.reply(
      `❌ Failed to load ready to withdraw trades: ${(error as Error).message}`
    );
  }
}

/**
 * View Trade Details - Show full details of a specific investment
 */
export async function handleViewTradeDetails(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Trade Details by user ${ctx.session.userId}`);

  try {
    const userId = ctx.session.userId;
    const tradeId = ctx.session.selectedTradeId;

    if (!userId || !tradeId) {
      await ctx.reply("❌ Invalid trade selection");
      return;
    }

    // Get the investment with all details
    const investment = await prisma.investment.findUnique({
      where: { id: tradeId },
      include: { package: true },
    });

    if (!investment) {
      await ctx.reply("❌ Trade not found");
      return;
    }

    // Verify ownership
    if (investment.userId !== userId) {
      await ctx.reply("❌ Unauthorized access");
      return;
    }

    logger.info(`📊 Trade Details: ${investment.id} (${investment.package.name}) for user ${userId}`);

    // Build detailed message
    let message = `<b>💼 Trade Details</b>\n\n`;

    message += `<b>📦 Package:</b> ${investment.package.name}\n`;
    message += `<b>💰 Amount:</b> ${formatCurrency(investment.amount)}\n`;
    message += `<b>📈 ROI:</b> ${investment.roiPercentage}%\n`;
    message += `<b>Expected Return:</b> ${formatCurrency(investment.expectedReturn)}\n`;
    message += `\n`;

    // Status info
    let statusEmoji = "❓";
    if (investment.status === "ACTIVE") {
      statusEmoji = "🔵";
    } else if (investment.status === "COMPLETED") {
      statusEmoji = "✅";
    } else if (investment.status === "PENDING") {
      statusEmoji = "⏳";
    }

    message += `<b>Status:</b> ${statusEmoji} ${investment.status}\n`;

    // Dates
    message += `<b>Created:</b> ${new Date(investment.createdAt).toLocaleDateString()}\n`;

    if (investment.activatedAt) {
      message += `<b>Activated:</b> ${new Date(investment.activatedAt).toLocaleDateString()}\n`;
    }

    if (investment.completedAt) {
      message += `<b>Completed:</b> ${new Date(investment.completedAt).toLocaleDateString()}\n`;
    }

    message += `<b>Maturity Date:</b> ${new Date(investment.maturityDate).toLocaleDateString()}\n`;
    message += `\n`;

    // Progress and current value for active trades
    if (investment.status === "ACTIVE" || investment.status === "MATURED") {
      try {
        const daysElapsed = Math.floor(
          (Date.now() - new Date(investment.activatedAt || investment.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
        );
        const totalDays = investment.package.duration;
        const daysRemaining = Math.max(0, totalDays - daysElapsed);

        message += `<b>Progress:</b> ${daysElapsed}/${totalDays} days\n`;
        if (daysRemaining > 0) {
          message += `<b>Days Remaining:</b> ${daysRemaining}\n`;
        }
        message += `\n`;

        const realTime = InvestmentService.calculateRealTimeValue(investment as any);
        message += `<b>💵 Current Value:</b> ${formatCurrency(realTime.currentValue)}\n`;
        message += `<b>Accrued Profit:</b> ${formatCurrency(investment.totalAccruedProfit)}\n`;
      } catch (error) {
        logger.warn(`Error calculating real-time value for investment ${investment.id}:`, error);
        message += `<b>💵 Current Value:</b> ${formatCurrency(investment.amount + investment.totalAccruedProfit)}\n`;
        message += `<b>Accrued Profit:</b> ${formatCurrency(investment.totalAccruedProfit)}\n`;
      }
    }

    // Earnings info for completed trades
    if (investment.status === "COMPLETED") {
      message += `<b>Total Profit:</b> ${formatCurrency(investment.totalProfit)}\n`;
      message += `<b>Withdrawn:</b> ${formatCurrency(investment.availableWithdrawable || investment.totalProfit)}\n`;
    }

    // Pending trade info
    if (investment.status === "PENDING") {
      const createdAt = new Date(investment.createdAt);
      const hoursAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60));
      message += `<b>🕐 Pending for:</b> ${hoursAgo}h\n`;
      message += `<b>⚠️ Note:</b> Will be auto-removed if pending for more than 24 hours\n`;
    }

    // Build keyboard
    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();

    // Show withdrawal button with appropriate state based on trade status
    if (investment.status === "COMPLETED") {
      // Trade already fully withdrawn - disabled button
      keyboard.text("✅ Already Closed", "noop");
      keyboard.row();
    } else if (investment.status === "MATURED") {
      // Trade matured and ready to withdraw - active button
      const totalAmount = investment.amount + investment.totalProfit;
      keyboard.text(
        `🏦 Withdraw Trade (${formatCurrency(totalAmount)})`,
        `withdraw_investment_input_${investment.id}`
      );
      keyboard.row();
    } else if (investment.status === "PENDING") {
      // Pending payment - cannot withdraw
      keyboard.text(
        "⏳ Awaiting Payment Confirmation",
        "investment_pending_payment"
      );
      keyboard.row();
    } else {
      // Trade not yet matured - disabled button showing when it will mature
      keyboard.text(
        `⏱️ Withdraw (Opens on ${new Date(investment.maturityDate).toLocaleDateString()})`,
        "investment_not_matured"
      );
      keyboard.row();
    }

    keyboard.text("🔙 Back to Trades", "trades_back_to_category");

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error("Error viewing trade details:", error);
    await ctx.reply(
      `❌ Failed to load trade details: ${(error as Error).message}`
    );
  }
}
