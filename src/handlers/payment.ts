import prisma from "../db/client.js";
import logger from "../config/logger.js";
import PaymentAccountService from "../services/paymentAccount.js";
import TelegramNotificationService from "../services/telegramNotification.js";
import {
  formatPaymentDetails,
  formatCurrency,
  formatPaymentProofStatus,
  generatePaymentReceiptSummary,
} from "../lib/helpers.js";
import {
  createPaymentConfirmationKeyboard,
  createPaymentProofOptionsKeyboard,
  createPaymentProofActionKeyboard,
  createPendingPaymentsKeyboard,
  backButtonKeyboard,
} from "../utils/keyboard.js";

/**
 * Show payment details page after investment confirmation
 */
export async function handleShowPaymentDetails(ctx: any): Promise<void> {
  try {
    const data = ctx.session?.currentInvestment;
    if (!data) {
      await ctx.reply("❌ Investment data not found. Please try again.");
      return;
    }

    // Get payment account
    const paymentAccount =
      await PaymentAccountService.getDefaultPaymentAccount();
    if (!paymentAccount) {
      await ctx.reply(
        "❌ Payment account not configured. Please contact support."
      );
      return;
    }

    // Display payment details
    let message = `<b>💰 Payment Details</b>\n\n`;
    message += `<b>Investment Summary:</b>\n`;
    message += `📦 Package: ${data.packageName}\n`;
    message += `💵 Amount: ${formatCurrency(data.amount)}\n`;
    message += `📅 Duration: ${data.packageDuration} days\n`;
    message += `📈 Expected Return: ${formatCurrency(data.expectedReturn)}\n\n`;

    message += formatPaymentDetails(paymentAccount);
    message += `\n\n<b>⚠️ Important:</b>\n`;
    message += `• Transfer exactly ${formatCurrency(data.amount)} to complete your investment\n`;
    message += `• Include your User ID or Name in the transfer reference\n`;
    message += `• Take a screenshot of the payment receipt\n`;
    message += `• Upload the proof after completing the transfer`;

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: createPaymentConfirmationKeyboard(data.investmentId),
    });

    logger.info(
      `[PAYMENT] User ${ctx.from?.id} viewed payment details for investment ${data.investmentId}`
    );
  } catch (error) {
    logger.error("Error displaying payment details:", error);
    await ctx.reply("❌ Error loading payment details. Please try again.");
  }
}

/**
 * Initiate payment proof upload
 */
export async function handleInitiateProofUpload(ctx: any): Promise<void> {
  try {
    const investmentId = ctx.session?.uploadingProofFor;
    if (!investmentId) {
      await ctx.reply("❌ Invalid investment ID.");
      return;
    }

    let message = `<b>📤 Upload Payment Proof</b>\n\n`;
    message += `Please upload a clear screenshot or photo of your payment receipt.\n\n`;
    message += `Make sure the proof shows:\n`;
    message += `✓ Transaction/Reference Number\n`;
    message += `✓ Amount transferred\n`;
    message += `✓ Date and Time\n`;
    message += `✓ Bank name or payment platform\n`;
    message += `✓ Last 4 digits of recipient account`;

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: createPaymentProofOptionsKeyboard(investmentId),
    });

    logger.info(
      `[PAYMENT] User ${ctx.from?.id} initiated payment proof upload for investment ${investmentId}`
    );
  } catch (error) {
    logger.error("Error initiating proof upload:", error);
    await ctx.reply("❌ Error preparing upload. Please try again.");
  }
}

/**
 * Handle payment proof photo/document upload
 */
export async function handleUploadPaymentProof(ctx: any): Promise<void> {
  try {
    const investmentId = ctx.session?.uploadingProofFor;
    if (!investmentId) {
      await ctx.reply("❌ Upload session expired. Please try again.");
      return;
    }

    // Get photo or document
    const photo = ctx.message?.photo?.[ctx.message.photo.length - 1];
    const document = ctx.message?.document;
    const fileId = photo?.file_id || document?.file_id;
    const fileName = document?.file_name || "payment_proof.jpg";

    if (!fileId) {
      await ctx.reply("❌ Please upload a image or document file.");
      return;
    }

    // Get investment with all payment details
    const investment = (await prisma.investment.findUnique({
      where: { id: investmentId },
      include: {
        user: true,
      },
    })) as any;

    if (!investment) {
      await ctx.reply("❌ Investment not found.");
      return;
    }

    // Update investment with proof and change status to AWAITING_PAYMENT
    await (prisma as any).investment.update({
      where: { id: investmentId },
      data: {
        paymentProofFileId: fileId,
        status: "AWAITING_PAYMENT",
      },
    });

    // Send Telegram notification to admin
    await TelegramNotificationService.notifyAdminPaymentProof(
      investment.userId,
      investment.user.firstName || "User",
      investment.amount,
      investmentId,
      investment.user.telegramId?.toString()
    );

    let message = `<b>✅ Proof Received</b>\n\n`;
    message += `Your payment proof has been received and is pending verification.\n\n`;
    message += `<b>📊 Your Investment:</b>\n`;
    message += `💵 Amount: ${formatCurrency(investment.amount)}\n`;
    message += `Status: ⏳ Awaiting Admin Verification\n\n`;
    message += `<b>📸 Proof Saved:</b>\n`;
    message += `File: ${fileName}\n`;
    message += `Storage: Telegram Servers (Secure)\n\n`;
    message += `<b>⏳ What's Next?</b>\n`;
    message += `Our team will review your proof and verify the payment.\n`;
    message += `You'll receive a notification once the verification is complete.`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: createPaymentProofActionKeyboard(investmentId),
    });

    // Clean up session
    if (ctx.session) {
      delete ctx.session.uploadingProofFor;
    }

    logger.info(
      `[PAYMENT] User ${ctx.from?.id} uploaded payment proof for investment ${investmentId}. FileId: ${fileId}`
    );
  } catch (error) {
    logger.error("Error uploading payment proof:", error);
    await ctx.reply("❌ Error uploading proof. Please try again.");
  }
}

/**
 * Show payment proof status
 */
export async function handleShowProofStatus(ctx: any): Promise<void> {
  try {
    const investmentId = ctx.session?.viewingProofStatusFor;
    if (!investmentId) {
      await ctx.reply("❌ Invalid investment ID.");
      return;
    }

    const investment = await prisma.investment.findUnique({
      where: { id: investmentId },
    });

    if (!investment) {
      await ctx.reply("❌ Investment not found.");
      return;
    }

    let message = `<b>📊 Payment Verification Status</b>\n\n`;
    message += `💰 Amount: ${formatCurrency(investment.amount)}\n`;
    message += `Status: Awaiting Admin Verification\n`;
    message += `Submitted: ${new Date(investment.createdAt).toLocaleDateString()}`;

    if (investment.notes) {
      message += `\n\n📝 <b>Notes:</b>\n${investment.notes}`;
    }

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: createPendingPaymentsKeyboard(investmentId),
    });

    logger.info(
      `[PAYMENT] User ${ctx.from?.id} checked payment status for investment ${investmentId}`
    );
  } catch (error) {
    logger.error("Error showing proof status:", error);
    await ctx.reply("❌ Error loading status. Please try again.");
  }
}

/**
 * Show user's pending payments
 */
export async function handleShowPendingPayments(ctx: any): Promise<void> {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply("❌ User not found.");
      return;
    }

    const pendingInvestments = await prisma.investment.findMany({
      where: {
        userId: userId.toString(),
        status: "AWAITING_PAYMENT" as any,
      },
      orderBy: { createdAt: "desc" },
    });

    if (pendingInvestments.length === 0) {
      await ctx.reply("✅ You have no pending payments.", {
        reply_markup: backButtonKeyboard,
      });
      return;
    }

    let message = `<b>⏳ Pending Payments</b>\n\n`;
    message += `You have <b>${pendingInvestments.length}</b> pending payment verification:\n\n`;

    pendingInvestments.forEach((inv: any, index: number) => {
      message += `${index + 1}. 💵 ${formatCurrency(inv.amount)}\n`;
      message += `   📅 ${new Date(inv.createdAt).toLocaleDateString()}\n`;
      message += `   Status: Awaiting Verification\n\n`;
    });

    await ctx.reply(message, {
      parse_mode: "HTML",
    });

    logger.info(`[PAYMENT] User ${userId} viewed pending payments`);
  } catch (error) {
    logger.error("Error showing pending payments:", error);
    await ctx.reply("❌ Error loading pending payments. Please try again.");
  }
}

/**
 * Show payment proof notes (rejection reason)
 */
export async function handleShowProofNotes(ctx: any): Promise<void> {
  try {
    const investmentId = ctx.session?.viewingProofNotesFor;
    if (!investmentId) {
      await ctx.reply("❌ Invalid investment ID.");
      return;
    }

    const investment = await prisma.investment.findUnique({
      where: { id: investmentId },
    });

    if (!investment) {
      await ctx.reply("❌ Investment not found.");
      return;
    }

    if (!investment.notes) {
      await ctx.reply("📝 No notes available for this payment.", {
        reply_markup: backButtonKeyboard,
      });
      return;
    }

    let message = `<b>📝 Verification Notes</b>\n\n`;
    message += `Status: Awaiting Admin Review\n\n`;
    message += `${investment.notes}`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: createPaymentProofActionKeyboard(investmentId),
    });

    logger.info(
      `[PAYMENT] User ${ctx.from?.id} viewed proof notes for investment ${investmentId}`
    );
  } catch (error) {
    logger.error("Error showing proof notes:", error);
    await ctx.reply("❌ Error loading notes. Please try again.");
  }
}

/**
 * Handle cancelled investment
 */
export async function handleCancelInvestment(ctx: any): Promise<void> {
  try {
    const investmentId = ctx.session?.cancelingInvestment;
    if (!investmentId) {
      await ctx.reply("❌ Invalid investment ID.");
      return;
    }

    // Update investment status to REJECTED (cancel/decline)
    await prisma.investment.update({
      where: { id: investmentId },
      data: {
        status: "REJECTED",
      },
    });

    await ctx.reply(
      "✅ Investment cancelled. You can start a new investment from the main menu."
    );
    logger.info(
      `[PAYMENT] User ${ctx.from?.id} cancelled investment ${investmentId}`
    );

    // Clear session
    if (ctx.session) {
      delete ctx.session.currentInvestment;
    }
  } catch (error) {
    logger.error("Error cancelling investment:", error);
    await ctx.reply("❌ Error cancelling investment. Please try again.");
  }
}

