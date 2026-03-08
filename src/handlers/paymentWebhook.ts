import logger from "../config/logger.js";
import prisma from "../db/client.js";
import bot from "../index.js";
import nowpaymentsService from "../services/cryptoPayment.js";
import { config } from "../config/env.js";
import TelegramNotificationService from "../services/telegramNotification.js";

/**
 * Handle Nowpayments webhook for payment status updates
 */
export async function handlePaymentWebhook(
  req: any,
  res: any
): Promise<void> {
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const signature = req.headers["x-nowpayments-sig"];

    logger.info("[WEBHOOK] Received Nowpayments webhook", {
      paymentId: req.body?.payment_id,
      status: req.body?.payment_status,
    });

    // Verify signature
    if (!nowpaymentsService.verifyIpnSignature(rawBody, signature)) {
      logger.warn("[WEBHOOK] Invalid IPN signature");
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid signature" }));
      return;
    }

    const { payment_id, payment_status, order_id } = req.body;
    const investmentId = order_id || null;

    // Map Nowpayments status to our status
    let paymentStatus = "PENDING";
    if (
      payment_status === "finished" ||
      payment_status === "confirmed" ||
      payment_status === "sending"
    ) {
      paymentStatus = "CONFIRMED";
    } else if (
      payment_status === "failed" ||
      payment_status === "expired"
    ) {
      paymentStatus = "FAILED";
    } else if (payment_status === "cancelled") {
      paymentStatus = "CANCELLED";
    }

    // Update payment in database
    const payment = await prisma.cryptoPayment.findUnique({
      where: { investmentId },
    });

    if (!payment) {
      logger.error(`[WEBHOOK] Payment not found for investment: ${investmentId}`);
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Payment not found" }));
      return;
    }

    // Update payment in database - pass order_id as fallback
    const updatedPayment =
      await nowpaymentsService.updatePaymentStatus(
        payment_id.toString(),
        paymentStatus,
        payment_status,
        order_id // Pass investmentId as fallback
      );

    if (!updatedPayment) {
      logger.error(`[WEBHOOK] Payment not found: ${payment_id}`);
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Payment not found" }));
      return;
    }

    // Get the investment
    const investment = await prisma.investment.findUnique({
      where: { id: investmentId },
      include: { user: true, package: true },
    });

    if (!investment) {
      logger.error(`[WEBHOOK] Investment not found: ${investmentId}`);
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Investment not found" }));
      return;
    }

    // Handle payment confirmation
    if (paymentStatus === "CONFIRMED") {
      logger.info(
        `[WEBHOOK] Payment confirmed for investment ${order_id}. Auto-activating investment.`,
        { paymentId: payment_id }
      );

      // Update investment status to ACTIVE
      await prisma.investment.update({
        where: { id: investmentId },
        data: {
          status: "ACTIVE",
          paymentProofStatus: "VERIFIED",
          paymentVerifiedAt: new Date(),
        },
      });

      // Notify user of payment confirmation
      await notifyPaymentConfirmed(investment.user.telegramId, investment);

      // Notify admin of new investment (only when payment is confirmed)
      try {
        await TelegramNotificationService.notifyAdminNewInvestment(
          investment.id,
          investment.userId,
          investment.user?.firstName || "User",
          investment.amount,
          investment.package?.name || "Unknown",
          investment.package?.icon || "💰",
          investment.user?.telegramId?.toString()
        );
      } catch (error) {
        logger.error("Error sending admin notification for payment-confirmed investment:", error);
      }

      // Notify admin
      await notifyAdminPaymentConfirmed(investment);

      logger.info(
        `[WEBHOOK] Investment activated automatically: ${order_id}`
      );
    } else if (paymentStatus === "FAILED" || paymentStatus === "EXPIRED") {
      logger.info(
        `[WEBHOOK] Payment failed/expired for investment ${order_id}. Status: ${paymentStatus}`,
        { paymentId: payment_id }
      );

      // Notify user of payment failure
      await notifyPaymentFailed(
        investment.user.telegramId,
        investment,
        paymentStatus
      );
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
  } catch (error) {
    logger.error(`[WEBHOOK] Error processing payment webhook:`, error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
}

/**
 * Notify user that payment was confirmed
 */
async function notifyPaymentConfirmed(
  telegramId: bigint,
  investment: any
): Promise<void> {
  try {
    const message = `
✅ <b>Payment Confirmed!</b>

Your crypto payment has been received and verified.

📊 <b>Investment Details:</b>
📦 Package: ${investment.package?.name || "Unknown"}
💰 Amount: $${investment.amount.toFixed(2)}
💵 Expected Return: $${investment.expectedReturn.toFixed(2)}
📅 Maturity Date: ${investment.maturityDate.toLocaleDateString()}

✨ Your investment is now <b>ACTIVE</b> and earning returns!

Use <b>/portfolio</b> to view your investments.
    `.trim();

    await bot.api.sendMessage(telegramId.toString(), message, {
      parse_mode: "HTML",
    });

    logger.info(`[NOTIFICATION] Payment confirmed notification sent to user ${telegramId}`);
  } catch (error) {
    logger.error(
      `[NOTIFICATION] Failed to send payment confirmed notification:`,
      error
    );
  }
}

/**
 * Notify user that payment failed
 */
async function notifyPaymentFailed(
  telegramId: bigint,
  investment: any,
  failureReason: string
): Promise<void> {
  try {
    const message = `
❌ <b>Payment Failed</b>

Your crypto payment was not received within the time limit.

📊 <b>Investment Details:</b>
📦 Package: ${investment.package?.name || "Unknown"}
💰 Amount: $${investment.amount.toFixed(2)}
Reason: ${failureReason === "EXPIRED" ? "Payment window expired" : "Payment processing failed"}

🔄 <b>What happens next:</b>
Your investment has been cancelled. You can:
• <b>Try Again</b> - Start a new investment with the same amount
• <b>Modify Amount</b> - Choose a different investment amount
• <b>Cancel</b> - Discard this investment

Do you want to retry?
    `.trim();

    await bot.api.sendMessage(telegramId.toString(), message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔄 Retry Investment", callback_data: `retry_invest_${investment.packageId}_${investment.amount}` },
            { text: "❌ Cancel", callback_data: "cancel_investment" },
          ],
        ],
      },
    });

    logger.info(`[NOTIFICATION] Payment failed notification sent to user ${telegramId}`);
  } catch (error) {
    logger.error(
      `[NOTIFICATION] Failed to send payment failed notification:`,
      error
    );
  }
}

/**
 * Notify admin of payment confirmation
 */
async function notifyAdminPaymentConfirmed(investment: any): Promise<void> {
  try {
    if (!config.ADMIN_CHAT_ID) {
      logger.warn("ADMIN_CHAT_ID not configured. Skipping admin notification.");
      return;
    }

    const message = `
✅ <b>Crypto Payment Confirmed</b>

Investment has been auto-activated.

<b>User:</b> ${investment.user?.firstName || "Unknown"} (ID: ${investment.user?.telegramId})
<b>Investment ID:</b> <code>${investment.id}</code>
<b>Amount:</b> $${investment.amount.toFixed(2)}
<b>Package:</b> ${investment.package?.name || "Unknown"}
<b>Status:</b> ACTIVE
    `.trim();

    await bot.api.sendMessage(config.ADMIN_CHAT_ID.toString(), message, {
      parse_mode: "HTML",
    });

    logger.info(`[NOTIFICATION] Admin notified of payment confirmation for investment ${investment.id}`);
  } catch (error) {
    logger.error(
      `[NOTIFICATION] Failed to send admin payment confirmation:`,
      error
    );
  }
}

export default handlePaymentWebhook;

/**
 * Handle NOWPayments payout (withdrawal) webhook
 */
export async function handleWithdrawalWebhook(
  req: any,
  res: any
): Promise<void> {
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const signature = req.headers["x-nowpayments-sig"];

    logger.info("[WITHDRAWAL WEBHOOK] Received payout status webhook", {
      paymentId: req.body?.payment_id,
      status: req.body?.payment_status,
    });

    // Verify signature
    if (nowpaymentsService && typeof (nowpaymentsService as any).verifyIpnSignature === 'function') {
      if (!(nowpaymentsService as any).verifyIpnSignature(rawBody, signature)) {
        logger.warn("[WITHDRAWAL WEBHOOK] Invalid IPN signature");
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid signature" }));
        return;
      }
    }

    const { payment_id, payment_status, order_id } = req.body;
    const withdrawalId = order_id || payment_id; // use order_id as withdrawal id

    if (!withdrawalId) {
      logger.warn("[WITHDRAWAL WEBHOOK] No invoice/ID in webhook data");
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invoice is required" }));
      return;
    }

    // Find withdrawal request
    const withdrawal = await (prisma as any).withdrawalRequest.findUnique({
      where: { id: withdrawalId },
      include: { user: true, investment: true },
    });

    if (!withdrawal) {
      logger.warn("[WITHDRAWAL WEBHOOK] Withdrawal not found for ID:", withdrawalId);
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Withdrawal not found" }));
      return;
    }

    // Map NOWPayments status to our status (use string statuses)
    let newStatus = "PROCESSING";
    let completed = false;

    if (payment_status === "finished" || payment_status === "confirmed" || payment_status === "sending") {
      newStatus = "COMPLETED";
      completed = true;
    } else if (payment_status === "failed" || payment_status === "expired" || payment_status === "cancelled") {
      newStatus = "REJECTED";
    } else {
      newStatus = "PROCESSING";
    }

    // Update withdrawal request
    await (prisma as any).withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: newStatus,
        paymentStatus: payment_status?.toString() || payment_id?.toString(),
        nowpaymentsPaymentId: payment_id || withdrawal.nowpaymentsPaymentId,
        completedAt: completed ? new Date() : undefined,
      },
    });

    // If completed, deduct amount from investment available balance
    if (completed && withdrawal.investmentId) {
      await (prisma as any).investment.update({
        where: { id: withdrawal.investmentId },
        data: {
          availableWithdrawable: {
            decrement: withdrawal.amount,
          },
          totalWithdrawn: {
            increment: withdrawal.amount,
          },
        },
      });

      // Update user total withdrawn
      await (prisma as any).user.update({
        where: { id: withdrawal.userId },
        data: {
          totalWithdrawn: {
            increment: withdrawal.amount,
          },
        },
      });

      logger.info("[WITHDRAWAL WEBHOOK] Withdrawal completed and balance updated:", {
        withdrawalId: order_id,
        amount: withdrawal.amount,
      });

      // Notify user of successful withdrawal
      try {
        const message = `
✅ <b>Withdrawal Successful!</b>

Your withdrawal has been processed and sent to your wallet.

<b>Withdrawal Details:</b>
💰 Amount: ${withdrawal.amount} USD
🪙 Cryptocurrency: ${withdrawal.cryptocurrency?.toUpperCase()}
⛓️ Blockchain: ${withdrawal.blockchain}
          📝 Transaction ID: <code>${payment_id}</code>

Your funds should arrive in your wallet within a few minutes.

Use <b>/portfolio</b> to view your updated balance.
        `.trim();

        await bot.api.sendMessage(Number(withdrawal.user?.telegramId), message, {
          parse_mode: "HTML",
        });

        logger.info(`[WITHDRAWAL WEBHOOK] User notified of successful withdrawal: ${withdrawal.userId}`);
      } catch (error) {
        logger.error("[WITHDRAWAL WEBHOOK] Error notifying user of successful withdrawal:", error);
      }
    } else if (newStatus === "REJECTED") {
      // Notify user of failed withdrawal
      try {
        const message = `
❌ <b>Withdrawal Failed</b>

Your withdrawal request could not be processed.

<b>Withdrawal Details:</b>
💰 Amount: ${withdrawal.amount} USD
⛓️ Blockchain: ${withdrawal.blockchain}
Status: Failed

❓ <b>What happens next:</b>
Your available balance will remain unchanged. The amount is back to your available withdrawal balance. You can try again or contact support for assistance.
        `.trim();

        await bot.api.sendMessage(Number(withdrawal.user?.telegramId), message, {
          parse_mode: "HTML",
        });

        logger.info(`[WITHDRAWAL WEBHOOK] User notified of failed withdrawal: ${withdrawal.userId}`);
      } catch (error) {
        logger.error("[WITHDRAWAL WEBHOOK] Error notifying user of failed withdrawal:", error);
      }

      // Reset available balance if this was deducted as pending
      // (In case the system deducted it as "pending" before failure)
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, message: "Webhook processed" }));
  } catch (error) {
    logger.error("[WITHDRAWAL WEBHOOK] Error processing withdrawal webhook:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
}
