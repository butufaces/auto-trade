import { Context } from "grammy";
import prisma from "../db/client.js";
import logger from "../config/logger.js";
import { formatCurrency } from "../lib/helpers.js";
import bot from "../index.js";

type SessionContext = Context & { session: any };

/**
 * Admin views all pending withdrawal requests
 */
export async function handleAdminViewWithdrawals(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Admin Withdrawal Requests`);

  try {
    const withdrawals = await (prisma as any).withdrawalRequest.findMany({
      where: {
        status: "PENDING",
      },
      include: {
        user: true,
        investment: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    if (withdrawals.length === 0) {
      await ctx.reply("✅ <b>No Pending Withdrawals</b>\n\nAll withdrawal requests have been processed.", {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back to Admin", callback_data: "admin_panel" }]],
        },
      });
      return;
    }

    let message = `<b>📋 Pending Withdrawal Requests</b>\n\n`;
    message += `Total Pending: <b>${withdrawals.length}</b>\n\n`;

    withdrawals.forEach((withdrawal: any, index: number) => {
      message += `${index + 1}. <b>@${withdrawal.user?.username || "Unknown"}</b>\n`;
      message += `   💰 Amount: ${formatCurrency(withdrawal.amount)}\n`;
      message += `   ⛓️ Blockchain: ${withdrawal.blockchain}\n`;
      message += `   ✅ Status: ${withdrawal.emailVerified ? "Email Verified" : "⏳ Awaiting Verification"}\n`;
      message += `   📅 Requested: ${new Date(withdrawal.createdAt).toLocaleDateString()}\n\n`;
    });

    message += `Select a withdrawal to review and approve:`;

    const keyboard = {
      inline_keyboard: withdrawals.map((withdrawal: any) => [
        {
          text: `@${withdrawal.user?.username || "User"} - ${formatCurrency(withdrawal.amount)}`,
          callback_data: `admin_view_withdrawal_${withdrawal.id}`,
        },
      ]),
    };

    keyboard.inline_keyboard.push([{ text: "🔙 Back", callback_data: "admin_panel" }]);

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } catch (error) {
    logger.error("Error viewing withdrawals:", error);
    await ctx.reply("❌ Error loading withdrawals. Please try again.");
  }
}

/**
 * Admin views detailed withdrawal info and can approve
 */
export async function handleAdminViewWithdrawalDetails(
  ctx: SessionContext,
  withdrawalId: string
): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Admin Withdrawal Details`);

  try {
    const withdrawal = await (prisma as any).withdrawalRequest.findUnique({
      where: { id: withdrawalId },
      include: {
        user: true,
        investment: true,
      },
    });

    if (!withdrawal) {
      await ctx.reply("❌ Withdrawal not found.");
      return;
    }

    let message = `<b>📊 Withdrawal Details</b>\n\n`;
    message += `<b>👤 User Information:</b>\n`;
    message += `Name: ${withdrawal.user?.firstName} ${withdrawal.user?.lastName || ""}\n`;
    message += `Username: @${withdrawal.user?.username}\n`;
    message += `Email: ${withdrawal.user?.email}\n\n`;

    message += `<b>💰 Crypto Withdrawal Form:</b>\n`;
    message += `Amount: <b>${formatCurrency(withdrawal.amount)}</b>\n`;
    message += `Cryptocurrency: <b>${withdrawal.cryptocurrency?.toUpperCase() || "USDT"}</b>\n`;
    message += `Blockchain: <b>${withdrawal.blockchain}</b>\n`;
    message += `Wallet Address: <code>${withdrawal.walletAddress}</code>\n\n`;

    message += `<b>✅ Verification Status:</b>\n`;
    message += `Email Verified: ${withdrawal.emailVerified ? "✅ Yes" : "❌ No (Pending)"}\n`;
    message += `Payment Status: ${withdrawal.paymentStatus || "Not Started"}\n`;
    message += `Withdrawal Status: <b>${withdrawal.status}</b>\n\n`;

    message += `📅 Requested: ${new Date(withdrawal.createdAt).toLocaleDateString()} ${new Date(withdrawal.createdAt).toLocaleTimeString()}\n`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "💰 Mark as Paid",
            callback_data: `admin_mark_withdrawal_paid_${withdrawalId}`,
          },
          { text: "❌ Reject", callback_data: `admin_reject_withdrawal_${withdrawalId}` },
        ],
        [{ text: "🔙 Back", callback_data: "admin_view_withdrawals" }],
      ],
    };

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } catch (error) {
    logger.error("Error viewing withdrawal details:", error);
    await ctx.reply("❌ Error loading withdrawal details. Please try again.");
  }
}

/**
 * Admin marks withdrawal as paid (manual payment)
 */
export async function handleAdminMarkWithdrawalPaid(
  ctx: SessionContext,
  withdrawalId: string
): Promise<void> {
  logger.info(`Admin marking withdrawal as paid: ${withdrawalId}`);

  try {
    const withdrawal = await (prisma as any).withdrawalRequest.findUnique({
      where: { id: withdrawalId },
      include: { user: true, investment: true },
    });

    if (!withdrawal) {
      await ctx.reply("❌ Withdrawal not found.");
      return;
    }

    // Check if withdrawal is already completed
    if (withdrawal.status === "COMPLETED") {
      await ctx.reply("⚠️ This withdrawal has already been marked as paid.");
      return;
    }

    // Update investment: deduct amount and change status to COMPLETED
    if (withdrawal.investmentId && withdrawal.status !== "COMPLETED") {
      await (prisma as any).investment.update({
        where: { id: withdrawal.investmentId },
        data: {
          totalWithdrawn: {
            increment: withdrawal.amount,
          },
          availableWithdrawable: {
            decrement: withdrawal.amount,
          },
          status: "COMPLETED",
        },
      });
    }

    // Update withdrawal status to COMPLETED
    await (prisma as any).withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: "COMPLETED",
        approvedAt: new Date(),
        approvedBy: ctx.session.userId,
        completedAt: new Date(),
        paymentStatus: "COMPLETED",
      },
    });

    // Update user stats to reflect the withdrawal
    const { UserService } = await import("../services/user.js");
    await UserService.updateUserStats(withdrawal.userId);

    // Notify user of payment
    try {
      const TelegramNotificationService = (await import("../services/telegramNotification.js")).default;
      
      // Only send crypto wallet notification if wallet details exist
      if (withdrawal.walletAddress && withdrawal.blockchain) {
        await TelegramNotificationService.notifyUserWithdrawalPaid(
          withdrawal.user.telegramId?.toString() || "",
          withdrawal.amount,
          withdrawal.blockchain,
          withdrawal.cryptocurrency || "USDT",
          withdrawal.walletAddress
        );
      } else {
        // Fallback: Send generic approval notification if wallet missing
        const { formatCurrency } = await import("../lib/helpers.js");
        const fallbackMessage = `✅ <b>Withdrawal Approved!</b>\n\nYour withdrawal request of <b>${formatCurrency(withdrawal.amount)}</b> has been approved.\\n\\nIt will be processed and sent to your registered payment account shortly.\n\nWithdrawal ID: <code>${withdrawal.id}</code>`;
        if (withdrawal.user?.telegramId) {
          await bot.api.sendMessage(withdrawal.user.telegramId.toString(), fallbackMessage, { parse_mode: "HTML" });
        }
      }
    } catch (notifyErr) {
      logger.warn("Failed to send withdrawal notification to user:", notifyErr);
    }

    const { formatCurrency } = await import("../lib/helpers.js");
    const message = `✅ <b>Withdrawal Marked as Paid!</b>\n\n
Withdrawal ID: <code>${withdrawalId}</code>\n
Amount: ${formatCurrency(withdrawal.amount)}\n
Blockchain: ${withdrawal.blockchain || "N/A"}\n
User: @${withdrawal.user?.username || "Unknown"}\n\n
📧 User notification sent!\n
Investment amount has been deducted.\n
They will see the payment in their wallet shortly.`;

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_view_withdrawals" }]],
      },
    });

    logger.info(`[WITHDRAWAL] Withdrawal marked as paid by admin ${ctx.session.userId}:`, {
      withdrawalId,
      amount: withdrawal.amount,
      userId: withdrawal.userId,
    });
  } catch (error) {
    logger.error("Error marking withdrawal as paid:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Admin approves withdrawal - triggers NOWPayments payment
 */
export async function handleAdminApproveWithdrawal(
  ctx: SessionContext,
  withdrawalId: string
): Promise<void> {
  // This is now handled by handleAdminMarkWithdrawalPaid
  return handleAdminMarkWithdrawalPaid(ctx, withdrawalId);
}

/**
 * Admin rejects withdrawal
 */
export async function handleAdminRejectWithdrawal(
  ctx: SessionContext,
  withdrawalId: string
): Promise<void> {
  logger.info(`Admin rejecting withdrawal: ${withdrawalId}`);

  try {
    const withdrawal = await (prisma as any).withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      await ctx.reply("❌ Withdrawal not found.");
      return;
    }

    ctx.session.rejectingWithdrawalId = withdrawalId;

    await ctx.reply("❌ <b>Reject Withdrawal</b>\n\nEnter rejection reason:", {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 Cancel", callback_data: `admin_view_withdrawal_${withdrawalId}` }]],
      },
    });
  } catch (error) {
    logger.error("Error rejecting withdrawal:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Admin submits rejection reason
 */
export async function handleAdminRejectWithdrawalReason(ctx: SessionContext): Promise<void> {
  try {
    const withdrawalId = ctx.session.rejectingWithdrawalId;

    if (!withdrawalId) {
      await ctx.reply("❌ Invalid rejection request.");
      return;
    }

    const rejectionReason = ctx.message?.text || "No reason provided";

    const withdrawal = await (prisma as any).withdrawalRequest.findUnique({
      where: { id: withdrawalId },
      include: { user: true, investment: true },
    });

    // Reset investment status back to MATURED so user can withdraw again
    if (withdrawal.investmentId) {
      await (prisma as any).investment.update({
        where: { id: withdrawal.investmentId },
        data: { status: "MATURED" },
      });
    }

    await (prisma as any).withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: "REJECTED",
        rejectionReason,
        updatedAt: new Date(),
      },
    });

    // Notify user of rejection
    try {
      await ctx.api.sendMessage(
        Number(withdrawal.user?.telegramId),
        `❌ <b>Withdrawal Rejected</b>\n\nYour ${formatCurrency(withdrawal.amount)} withdrawal request to ${withdrawal.blockchain} has been rejected.\n\nReason: ${rejectionReason}`,
        { parse_mode: "HTML" }
      );
    } catch (error) {
      logger.error("Error notifying user of rejection:", error);
    }

    await ctx.reply(
      `✅ <b>Withdrawal Rejected</b>\n\n💰 Amount: ${formatCurrency(withdrawal.amount)}\n⛓️ Blockchain: ${withdrawal.blockchain}\n❌ Status: Rejected\n\nReason: ${rejectionReason}\n\nUser has been notified.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_view_withdrawals" }]],
        },
      }
    );

    logger.info(`[WITHDRAWAL] Withdrawal rejected by admin ${ctx.session.userId}:`, {
      withdrawalId,
      reason: rejectionReason,
    });

    delete ctx.session.rejectingWithdrawalId;
  } catch (error) {
    logger.error("Error processing rejection reason:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}
