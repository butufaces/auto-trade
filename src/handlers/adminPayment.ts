import prisma from "../db/client.js";
import logger from "../config/logger.js";
import PaymentAccountService from "../services/paymentAccount.js";
import { NotificationService } from "../services/notification.js";
import TelegramNotificationService from "../services/telegramNotification.js";
import { InlineKeyboard } from "grammy";
import {
  formatPaymentDetails,
  formatCurrency,
  formatPaymentProofStatus,
} from "../lib/helpers.js";
import {
  createAdminPaymentAccountKeyboard,
  createPaymentAccountManageKeyboard,
  createAdminPaymentVerificationKeyboard,
  createPaymentProofReviewKeyboard,
  yesNoKeyboard,
} from "../utils/keyboard.js";

/**
 * Show payment account management panel
 */
export async function handleAdminPaymentAccounts(ctx: any): Promise<void> {
  try {
    let message = `<b>💳 Payment Account Management</b>\n\n`;
    message += `Manage the bank details that users see when making payments.\n\n`;
    message += `Options:\n`;
    message += `• ➕ Add a new payment account\n`;
    message += `• 📋 View and manage existing accounts`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: createAdminPaymentAccountKeyboard(),
    });

    logger.info(`[ADMIN] Admin ${ctx.from?.id} accessed payment accounts`);
  } catch (error) {
    logger.error("Error showing payment accounts:", error);
    await ctx.reply("❌ Error loading payment accounts.");
  }
}

/**
 * Show form to add new payment account
 */
export async function handleAddPaymentAccount(ctx: any): Promise<void> {
  try {
    if (!ctx.session) ctx.session = {};
    ctx.session.addingPaymentAccount = true;
    ctx.session.paymentAccountData = {};

    let message = `<b>➕ Add New Payment Account</b>\n\n`;
    message += `Please provide the following details:\n\n`;
    message += `<b>Step 1 of 4:</b> Bank Name\n`;
    message += `(e.g., GTBank, Access Bank, First Bank)`;

    await ctx.reply(message, {
      parse_mode: "HTML",
    });

    logger.info(`[ADMIN] Admin ${ctx.from?.id} started adding payment account`);
  } catch (error) {
    logger.error("Error handling add payment account:", error);
    await ctx.reply("❌ Error starting payment account creation.");
  }
}

/**
 * Process payment account form inputs
 */
export async function handlePaymentAccountInput(
  ctx: any,
  step: number
): Promise<void> {
  try {
    if (!ctx.session?.addingPaymentAccount) return;

    const input = ctx.message?.text;
    if (!input) {
      await ctx.reply("❌ Invalid input. Please try again.");
      return;
    }

    if (!ctx.session.paymentAccountData) {
      ctx.session.paymentAccountData = {};
    }

    if (step === 1) {
      ctx.session.paymentAccountData.bankName = input;
      await ctx.reply(
        `<b>Step 2 of 4:</b> Account Name\n(Full name on the bank account)`,
        { parse_mode: "HTML" }
      );
    } else if (step === 2) {
      ctx.session.paymentAccountData.accountName = input;
      await ctx.reply(
        `<b>Step 3 of 4:</b> Account Number\n(The 10-digit account number)`,
        { parse_mode: "HTML" }
      );
    } else if (step === 3) {
      ctx.session.paymentAccountData.accountNumber = input;
      await ctx.reply(
        `<b>Step 4 of 4:</b> Instructions (Optional)\n(e.g., "Please include your reference number in transfer")`,
        { parse_mode: "HTML" }
      );
    } else if (step === 4) {
      ctx.session.paymentAccountData.instructions = input;

      const account = await PaymentAccountService.createPaymentAccount(
        ctx.session.paymentAccountData
      );

      let message = `<b>✅ Payment Account Created</b>\n\n`;
      message += formatPaymentDetails(account);

      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: createAdminPaymentAccountKeyboard(),
      });

      if (ctx.session) {
        delete ctx.session.addingPaymentAccount;
        delete ctx.session.paymentAccountData;
      }

      logger.info(
        `[ADMIN] Admin ${ctx.from?.id} created payment account: ${account.id}`
      );
    }
  } catch (error) {
    logger.error("Error processing payment account input:", error);
    await ctx.reply("❌ Error processing input. Please try again.");
  }
}

/**
 * Show all payment accounts
 */
export async function handleViewPaymentAccounts(ctx: any): Promise<void> {
  try {
    const accounts = await PaymentAccountService.getAllPaymentAccounts();

    if (accounts.length === 0) {
      await ctx.reply(
        "No payment accounts configured yet.\n\nUse ➕ Add Account to create one.",
        {
          parse_mode: "HTML",
          reply_markup: createAdminPaymentAccountKeyboard(),
        }
      );
      return;
    }

    let message = `<b>📋 Payment Accounts (${accounts.length})</b>\n\n`;

    accounts.forEach((account: any, index: number) => {
      message += `${index + 1}. <b>${account.bankName}</b>\n`;
      message += `   ${account.accountName}\n`;
      message += `   <code>${account.accountNumber}</code>\n`;
      message += `   Status: ${account.isActive ? "✅ Active" : "❌ Inactive"}\n\n`;
    });

    await ctx.reply(message, {
      parse_mode: "HTML",
    });

    const keyboard = new InlineKeyboard();
    accounts.forEach((account: any) => {
      keyboard.text(
        `${account.bankName} ${account.accountName}`,
        `admin_manage_account_${account.id}`
      );
      keyboard.row();
    });
    keyboard.text("🔙 Back", "admin_payment_accounts");

    await ctx.reply("Select account to manage:", {
      reply_markup: keyboard,
    });

    logger.info(
      `[ADMIN] Admin ${ctx.from?.id} viewed ${accounts.length} payment accounts`
    );
  } catch (error) {
    logger.error("Error viewing payment accounts:", error);
    await ctx.reply("❌ Error loading payment accounts.");
  }
}

/**
 * Show payment account management options
 */
export async function handleManagePaymentAccount(ctx: any): Promise<void> {
  try {
    const accountId = ctx.session?.accountToManage;
    if (!accountId) {
      await ctx.reply("❌ Invalid account ID.");
      return;
    }

    const account = await PaymentAccountService.getPaymentAccountById(accountId);

    if (!account) {
      await ctx.reply("❌ Account not found.");
      return;
    }

    let message = `<b>💳 Payment Account Details</b>\n\n`;
    message += formatPaymentDetails(account);
    message += `\n\n📊 Status: ${account.isActive ? "✅ Active (available to users)" : "⭕ Inactive (hidden from users)"}`;
    message += `\n\n⚙️ Choose an action:`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: createPaymentAccountManageKeyboard(accountId, account.isActive),
    });

    logger.info(
      `[ADMIN] Admin ${ctx.from?.id} accessed account ${accountId} management`
    );
  } catch (error) {
    logger.error("Error managing payment account:", error);
    await ctx.reply("❌ Error loading account details.");
  }
}

/**
 * Delete payment account
 */
export async function handleDeletePaymentAccount(ctx: any): Promise<void> {
  try {
    const accountId = ctx.session?.accountToDelete;
    if (!accountId) {
      await ctx.reply("❌ Invalid account ID.");
      return;
    }

    if (!ctx.session) ctx.session = {};
    ctx.session.accountToDelete = accountId;

    await ctx.reply(
      "⚠️ Are you sure you want to deactivate this payment account?",
      {
        reply_markup: yesNoKeyboard,
      }
    );

    logger.info(
      `[ADMIN] Admin ${ctx.from?.id} initiated deletion of account ${accountId}`
    );
  } catch (error) {
    logger.error("Error deleting payment account:", error);
    await ctx.reply("❌ Error processing deletion.");
  }
}

/**
 * Confirm delete payment account
 */
export async function handleConfirmDeletePaymentAccount(ctx: any): Promise<void> {
  try {
    const accountId = ctx.session?.accountToDelete;
    if (!accountId) {
      await ctx.reply("❌ No account selected for deletion.");
      return;
    }

    await PaymentAccountService.deletePaymentAccount(accountId);

    await ctx.reply("✅ Payment account deactivated successfully.", {
      reply_markup: createAdminPaymentAccountKeyboard(),
    });

    if (ctx.session) {
      delete ctx.session.accountToDelete;
    }

    logger.info(
      `[ADMIN] Admin ${ctx.from?.id} deleted payment account ${accountId}`
    );
  } catch (error) {
    logger.error("Error confirming delete:", error);
    await ctx.reply("❌ Error deactivating account.");
  }
}

/**
 * Edit payment account - show field selection
 */
export async function handleEditPaymentAccount(ctx: any): Promise<void> {
  try {
    const accountId = ctx.session?.accountToManage;
    if (!accountId) {
      await ctx.reply("❌ Invalid account ID.");
      return;
    }

    const account = await PaymentAccountService.getPaymentAccountById(accountId);
    if (!account) {
      await ctx.reply("❌ Account not found.");
      return;
    }

    ctx.session.editingAccountId = accountId;

    let message = `<b>✏️ Edit Payment Account</b>\n\n`;
    message += `Current Details:\n`;
    message += `🏦 Bank: ${account.bankName}\n`;
    message += `👤 Account Name: ${account.accountName}\n`;
    message += `🔢 Account Number: ${account.accountNumber}\n`;
    message += `📝 Instructions: ${account.instructions || "Not set"}\n\n`;
    message += `Which field would you like to edit?`;

    const editKeyboard = {
      inline_keyboard: [
        [{ text: "🏦 Bank Name", callback_data: "edit_field_bankName" }],
        [{ text: "👤 Account Name", callback_data: "edit_field_accountName" }],
        [{ text: "🔢 Account Number", callback_data: "edit_field_accountNumber" }],
        [{ text: "📝 Instructions", callback_data: "edit_field_instructions" }],
        [{ text: "🔙 Cancel", callback_data: "admin_view_payment_accounts" }],
      ],
    };

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: editKeyboard,
    });

    logger.info(`[ADMIN] Admin ${ctx.from?.id} started editing account ${accountId}`);
  } catch (error) {
    logger.error("Error editing payment account:", error);
    await ctx.reply("❌ Error loading edit form.");
  }
}

/**
 * Toggle payment account active status
 */
export async function handleTogglePaymentAccountActive(ctx: any): Promise<void> {
  try {
    const accountId = ctx.session?.accountToManage;
    if (!accountId) {
      await ctx.reply("❌ Invalid account ID.");
      return;
    }

    const account = await PaymentAccountService.getPaymentAccountById(accountId);
    if (!account) {
      await ctx.reply("❌ Account not found.");
      return;
    }

    const newStatus = !account.isActive;
    await PaymentAccountService.updatePaymentAccount(accountId, {
      isActive: newStatus,
    });

    const statusMsg = newStatus
      ? "✅ Account activated and now available to users"
      : "⭕ Account deactivated and hidden from users";

    await ctx.reply(
      `${statusMsg}\n\nShowing updated account details:`,
      {
        reply_markup: createAdminPaymentAccountKeyboard(),
      }
    );

    // Re-fetch and show updated account
    const updatedAccount = await PaymentAccountService.getPaymentAccountById(
      accountId
    );
    if (updatedAccount) {
      let message = `<b>💳 Payment Account Details</b>\n\n`;
      message += formatPaymentDetails(updatedAccount);
      message += `\n\n📊 Status: ${updatedAccount.isActive ? "✅ Active (available to users)" : "⭕ Inactive (hidden from users)"}`;
      message += `\n\n⚙️ Choose an action:`;

      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: createPaymentAccountManageKeyboard(
          accountId,
          updatedAccount.isActive
        ),
      });
    }

    logger.info(
      `[ADMIN] Admin ${ctx.from?.id} toggled account ${accountId} to ${newStatus}`
    );
  } catch (error) {
    logger.error("Error toggling account status:", error);
    await ctx.reply("❌ Error updating account status.");
  }
}

/**
 * Show payment verification panel
 */
export async function handleAdminPaymentVerification(ctx: any): Promise<void> {
  try {
    let message = `<b>✅ Payment Verification</b>\n\n`;
    message += `Review and verify user payment proofs.\n\n`;
    message += `Options:\n`;
    message += `• ⏳ Pending Proofs - Not yet verified\n`;
    message += `• ✅ Approved Proofs - Already verified\n`;
    message += `• ❌ Rejected Proofs - Rejected and resubmitted`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: createAdminPaymentVerificationKeyboard(),
    });

    logger.info(`[ADMIN] Admin ${ctx.from?.id} accessed payment verification`);
  } catch (error) {
    logger.error("Error showing payment verification:", error);
    await ctx.reply("❌ Error loading verification panel.");
  }
}

/**
 * Show pending payment proofs
 */
export async function handleShowPendingProofs(ctx: any): Promise<void> {
  try {
    const pendingInvestments = await prisma.investment.findMany({
      where: {
        status: "AWAITING_PAYMENT" as any,
      },
      include: {
        user: true,
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    if (pendingInvestments.length === 0) {
      await ctx.reply(
        "✅ No pending payment proofs. All payments have been verified!",
        {
          reply_markup: createAdminPaymentVerificationKeyboard(),
        }
      );
      return;
    }

    let message = `<b>⏳ Pending Payment Proofs (${pendingInvestments.length})</b>\n\n`;
    message += `Click on an investor name to review their payment proof:\n\n`;

    const keyboard = new InlineKeyboard();
    
    pendingInvestments.forEach((inv: any, index: number) => {
      const user = inv.user;
      const displayName = `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`;
      message += `${index + 1}. ${displayName}\n`;
      
      // Add investor name as clickable button
      keyboard.text(
        `👤 ${displayName}`,
        `admin_review_proof_${inv.id}`
      );
      keyboard.row();
    });
    
    keyboard.text("🔙 Back", "admin_payment_verification");

    await ctx.reply(message, {
      parse_mode: "HTML",
    });

    await ctx.reply("Select an investor to review their payment proof:", {
      reply_markup: keyboard,
    });

    logger.info(
      `[ADMIN] Admin ${ctx.from?.id} viewed ${pendingInvestments.length} pending proofs`
    );
  } catch (error) {
    logger.error("Error showing pending proofs:", error);
    await ctx.reply("❌ Error loading pending proofs.");
  }
}

/**
 * Review single payment proof
 */
export async function handleReviewPaymentProof(ctx: any): Promise<void> {
  try {
    const investmentId = ctx.session?.reviewingProofFor;
    if (!investmentId) {
      await ctx.reply("❌ Invalid investment ID.");
      return;
    }

    const investment = await prisma.investment.findUnique({
      where: { id: investmentId },
      include: { 
        user: true,
        package: true,
      },
    });

    if (!investment) {
      await ctx.reply("❌ Investment not found.");
      return;
    }

    if (!ctx.session) ctx.session = {};
    ctx.session.reviewingProofFor = investmentId;

    // Build detailed investment information message
    const displayName = `${investment.user.firstName}${investment.user.lastName ? ` ${investment.user.lastName}` : ""}`;
    
    let message = `<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n`;
    message += `<b>👤 INVESTOR INFORMATION</b>\n`;
    message += `<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n\n`;
    message += `<b>Name:</b> ${displayName}\n`;
    message += `<b>Username:</b> @${investment.user.username || "N/A"}\n`;
    message += `<b>Telegram ID:</b> <code>${investment.user.telegramId}</code>\n\n`;

    message += `<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n`;
    message += `<b>💰 INVESTMENT DETAILS</b>\n`;
    message += `<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n\n`;
    message += `<b>Package:</b> ${investment.package?.name || "Unknown"}\n`;
    message += `<b>Investment Amount:</b> ${formatCurrency(investment.amount)}\n`;
    message += `<b>ROI Percentage:</b> ${investment.roiPercentage}%\n`;
    message += `<b>Expected Return:</b> ${formatCurrency(investment.expectedReturn)}\n`;
    message += `<b>Duration:</b> ${investment.package?.duration || "N/A"} days\n`;
    message += `<b>Investment Date:</b> ${new Date(investment.createdAt).toLocaleDateString()}\n\n`;

    message += `<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n`;
    message += `<b>📧 PAYMENT PROOF EMAIL</b>\n`;
    message += `<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n\n`;

    // Show payment account email if available (assuming we track which account was used)
    const paymentAccounts = await PaymentAccountService.getAllPaymentAccounts();
    const defaultAccount = paymentAccounts.find((acc: any) => acc.isActive);
    if (defaultAccount) {
      message += `<b>Transfer To:</b>\n`;
      message += `🏦 Bank: ${defaultAccount.bankName}\n`;
      message += `👤 Account Name: ${defaultAccount.accountName}\n`;
      message += `🔢 Account Number: ${defaultAccount.accountNumber}\n`;
    }
    
    message += `\n<b>Status:</b> ⏳ Pending Review\n`;

    await ctx.reply(message, {
      parse_mode: "HTML",
    });

    // Send the payment proof image
    if ((investment as any).paymentProofFileId) {
      try {
        await ctx.api.sendPhoto(
          ctx.chat!.id,
          (investment as any).paymentProofFileId,
          {
            caption: "<b>Payment Proof Submitted</b>",
            parse_mode: "HTML",
          }
        );
      } catch (e) {
        logger.warn("Could not retrieve proof image:", e);
        await ctx.reply(
          "⚠️ Could not retrieve proof image. File may have expired."
        );
      }
    }

    // Show action buttons
    await ctx.reply("Choose an action:", {
      reply_markup: createPaymentProofReviewKeyboard(investmentId),
    });

    logger.info(
      `[ADMIN] Admin ${ctx.from?.id} reviewing proof for investment ${investmentId}`
    );
  } catch (error) {
    logger.error("Error reviewing payment proof:", error);
    await ctx.reply("❌ Error loading proof details.");
  }
}

/**
 * Approve payment proof
 */
export async function handleApprovePaymentProof(ctx: any): Promise<void> {
  try {
    const investmentId = ctx.session?.approvingProofFor;
    if (!investmentId) {
      await ctx.reply("❌ Invalid investment ID.");
      return;
    }

    const investment = (await prisma.investment.update({
      where: { id: investmentId },
      data: {
        status: "ACTIVE" as any,
        paymentVerifiedAt: new Date(),
      } as any,
      include: { user: true },
    })) as any;

    // Also mark the crypto payment as COMPLETED to prevent scheduler from canceling it
    try {
      await (prisma as any).cryptoPayment.update({
        where: { investmentId },
        data: {
          status: "COMPLETED",
          confirmedAt: new Date(),
        },
      });
      logger.info(`[PAYMENT] CryptoPayment marked as COMPLETED for investment ${investmentId}`);
    } catch (cryptoErr) {
      logger.warn(`[PAYMENT] Could not update CryptoPayment status:`, cryptoErr);
      // Continue anyway - payment is already confirmed
    }

    const displayName = `${investment.user.firstName}${investment.user.lastName ? ` ${investment.user.lastName}` : ""}`;

    await ctx.reply(
      `✅ <b>Payment Approved!</b>\n\n` +
      `Investor: ${displayName}\n` +
      `Amount: ${formatCurrency(investment.amount)}\n` +
      `Status: ACTIVE\n\n` +
      `Returning to pending proofs list...`,
      {
        parse_mode: "HTML",
      }
    );

    try {
      await ctx.api.sendMessage(
        Number(investment.userId),
        `✅ <b>Payment Verified!</b>\n\n💰 Amount: ${formatCurrency(investment.amount)}\n\nYour investment is now ACTIVE and earning returns daily!`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "💰 View Investment", callback_data: `view_investment_${investmentId}` }],
              [{ text: "📊 My Portfolio", callback_data: "back_to_menu" }]
            ]
          }
        }
      );
    } catch (e) {
      logger.warn(`Could not notify user ${investment.userId}`);
    }

    // Create notification for the user
    try {
      await NotificationService.createNotification(
        investment.userId,
        "✅ Payment Verified",
        `Your payment proof for ${formatCurrency(investment.amount)} has been approved! Your investment is now ACTIVE.`,
        "SUCCESS",
        investmentId
      );
      console.log(`[APPROVE] Notification created for user ${investment.userId}`);
    } catch (notifError) {
      console.warn(`[APPROVE] Could not create notification:`, notifError);
      logger.warn(`Could not create approval notification for user ${investment.userId}`);
    }

    // Send Telegram notification to admin
    await TelegramNotificationService.notifyAdminPaymentApproved(
      investmentId,
      investment.userId,
      investment.amount,
      displayName
    );

    if (ctx.session) {
      delete ctx.session.reviewingProofFor;
      delete ctx.session.approvingProofFor;
    }

    logger.info(
      `[ADMIN] Admin ${ctx.from?.id} approved payment proof ${investmentId}`
    );

    // Return to pending proofs list
    await handleShowPendingProofs(ctx);
  } catch (error) {
    logger.error("Error approving payment proof:", error);
    await ctx.reply("❌ Error processing approval.");
  }
}

/**
 * Start rejection workflow
 */
export async function handleRejectPaymentProof(ctx: any): Promise<void> {
  try {
    const investmentId = ctx.session?.rejectingProofFor;
    if (!investmentId) {
      await ctx.reply("❌ Invalid investment ID.");
      return;
    }

    if (!ctx.session) ctx.session = {};
    ctx.session.rejectingProofFor = investmentId;

    let message = `<b>❌ Reject Payment Proof</b>\n\n`;
    message += `Please provide a reason for rejection.\n\n`;
    message += `Examples:\n`;
    message += `• Amount doesn't match\n`;
    message += `• Receipt is unclear\n`;
    message += `• Transfer recipient doesn't match our account\n`;
    message += `• Date is too old`;

    await ctx.reply(message, {
      parse_mode: "HTML",
    });

    logger.info(
      `[ADMIN] Admin ${ctx.from?.id} started rejecting proof ${investmentId}`
    );
  } catch (error) {
    logger.error("Error rejecting payment proof:", error);
    await ctx.reply("❌ Error starting rejection process.");
  }
}

/**
 * Confirm rejection with reason
 */
export async function handleConfirmRejectPaymentProof(
  ctx: any,
  reason: string
): Promise<void> {
  try {
    const investmentId = ctx.session?.rejectingProofFor;
    if (!investmentId) {
      await ctx.reply("❌ Rejection session expired.");
      return;
    }

    console.log(`[REJECT] Starting rejection for investment ${investmentId}`);

    const investment = (await prisma.investment.update({
      where: { id: investmentId },
      data: {
        status: "PAYMENT_REJECTED" as any,
        paymentVerificationNotes: reason,
      } as any,
      include: { user: true },
    })) as any;

    console.log(`[REJECT] Investment updated successfully`);

    const displayName = `${investment.user.firstName}${investment.user.lastName ? ` ${investment.user.lastName}` : ""}`;

    await ctx.reply(
      `✅ <b>Payment Rejected</b>\n\n` +
      `Investor: ${displayName}\n` +
      `Amount: ${formatCurrency(investment.amount)}\n` +
      `Reason: ${reason}\n\n` +
      `User has been notified to resubmit.\n` +
      `Returning to pending proofs list...`,
      {
        parse_mode: "HTML",
      }
    );

    try {
      await ctx.api.sendMessage(
        Number(investment.userId),
        `❌ <b>Payment Proof Rejected</b>\n\n<b>Reason:</b>\n${reason}\n\nPlease resubmit a clearer proof or contact support if you need help.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📋 View Reason", callback_data: `payment_rejection_${investmentId}` }],
              [{ text: "📋 Upload New Proof", callback_data: `upload_proof_${investmentId}` }]
            ]
          }
        }
      );
    } catch (e) {
      console.warn(`[REJECT] Could not notify user ${investment.userId}:`, e);
      logger.warn(`Could not notify user ${investment.userId}`);
    }

    // Create notification for the user
    try {
      await NotificationService.createNotification(
        investment.userId,
        "❌ Payment Proof Rejected",
        `Your payment proof for ${formatCurrency(investment.amount)} has been rejected.\n\nReason: ${reason}\n\nPlease resubmit a clearer proof.`,
        "ERROR",
        investmentId
      );
      console.log(`[REJECT] Notification created for user ${investment.userId}`);
    } catch (notifError) {
      console.warn(`[REJECT] Could not create notification:`, notifError);
      logger.warn(`Could not create rejection notification for user ${investment.userId}`);
    }

    // Send Telegram notification to admin
    await TelegramNotificationService.notifyAdminPaymentRejected(
      investmentId,
      investment.userId,
      investment.amount,
      displayName,
      reason
    );

    if (ctx.session) {
      delete ctx.session.rejectingProofFor;
      delete ctx.session.reviewingProofFor;
    }

    logger.info(
      `[ADMIN] Admin ${ctx.from?.id} rejected payment proof ${investmentId}`
    );

    // Return to pending proofs list
    await handleShowPendingProofs(ctx);
  } catch (error) {
    console.error("[REJECT ERROR]", error);
    logger.error("Error confirming rejection:", error);
    await ctx.reply("❌ Error processing rejection.");
  }
}
