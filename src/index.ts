import "dotenv/config";
import { Bot, session, GrammyError, HttpError, Context } from "grammy";
import { createServer } from "http";
import { URL } from "url";
import { config } from "./config/env.js";
import logger from "./config/logger.js";
import {
  logButtonClick,
  logPageView,
  logError,
  logSuccess,
  logNavigation,
  logButtonResponse,
} from "./utils/logging.js";
import prisma from "./db/client.js";
import PaymentAccountService from "./services/paymentAccount.js";
import PackageService from "./services/package.js";
import UserService from "./services/user.js";
import InvestmentService from "./services/investment.js";

import {
  ensureUserExists,
  requireAdmin,
  requireActiveUser,
  checkMaintenanceMode,
  rateLimitMiddleware,
  loggingMiddleware,
} from "./middleware/auth.js";

import {
  getAdminIds,
  formatCurrency,
  isAdmin,
} from "./lib/helpers.js";

import {
  handleStart,
  handleViewPackages,
  handleSelectPackage,
  handleSelectAmount,
  handleConfirmInvestment,
  handleViewPortfolio,
  handleSettings,
  handleSecurity,
  handleExportData,
  handleViewProfile,
  handleViewMyReferrals,
  handleWithdrawReferralBonus,
  handleReferralBonusAmountInput,
  handleConfirmReferralWithdrawal,
  handleHelp,
  handleHelpArticleView,
  handleViewBankDetails,
  handleEditBankDetails,
  handleProcessBankDetails,
  handleConfirmBankDetails,
  handleViewInvestmentDetails,
  handleProcessWithdrawal,
  handleConfirmWithdrawalAmount,
  handleCompleteWithdrawal,
  handleNotifications,
  handleNotificationDetail,
  handleShowInvestmentDetails,
  handleViewLiveGrowth,
  handleCloseLiveGrowth,
  handleWithdrawInvestment,
  handleWithdrawInvestmentInput,
  handleWithdrawalAmountInput,
  handleViewWallets,
  handleAddWalletStart,
  handleAddWalletAddress,
  handleSaveWallet,
  handleDeleteWallet,
} from "./handlers/user.js";

// Log quick DB sanity info on startup
async function logDbSanity() {
  try {
    const activeCount = await prisma.investment.count({ where: { status: "ACTIVE" } });
    const totalCount = await prisma.investment.count();
    const rawUrl = process.env.DATABASE_URL || "";
    const dbHost = rawUrl.split("@")[1] || rawUrl;
    logger.info(`DB sanity: total_investments=${totalCount} active_investments=${activeCount} db_host=${dbHost.substring(0, 40)}`);
  } catch (err) {
    logger.error("DB sanity check failed:", err);
  }
}

import {
  handleAdminPanel,
  handlePendingInvestments,
  handleApproveInvestment,
  handleRejectInvestment,
  handleProcessRejection,
  handleProcessApproval,
  handleManageUsers,
  handleUserDetails,
  handleAdminLogs,
  handleCreateAnnouncement,
  handleAskAnnouncementTitle,
  handleAnnouncementTitle,
  handleAnnouncementMessage,
  handleAnnouncementPhotoUpload,
  handleAnnouncementVideoUpload,
  handleAnnouncementAnimationUpload,
  handleShowUsersForSelection,
  handleSendAnnouncement,
  handlePendingWithdrawals,
  handleViewWithdrawalDetail,
  handleApproveWithdrawal,
  handleCompleteWithdrawal as handleAdminCompleteWithdrawal,
  handleRejectWithdrawalRequest,
  handleReferralSettings,
  handleEditReferralBonusStart,
  handleEditReferralBonusInput,
  handleViewReferralAnalytics,
  handleManageWelcomeMedia,
  handleWelcomeMediaPhoto,
  handleWelcomeMediaVideo,
  handleWelcomeMediaAnimation,
  handleRemoveWelcomeMedia,
} from "./handlers/admin.js";

import {
  handleManageAllInvestments,
  handleAddInvestmentStart,
  handleAddInvestmentSelectPackage,
  handleAddInvestmentAmount,
  handleConfirmAddInvestment,
  handleCreateInvestmentFinal,
  handlePendingDeposits,
  handleConfirmDepositManually,
} from "./handlers/admin-investments.js";

import {
  handleManagePackages,
  handleAddPackageStart,
  handleEditPackageStart,
  handleUpdatePackageField,
  handleConfirmPackageUpdate,
  handleUpdateRiskLevel,
  handleCreatePackage,
} from "./handlers/admin-packages.js";

import {
  handleManageAbout,
  handleEditAboutStart,
  handleConfirmAboutUpdate,
  handleViewAbout,
} from "./handlers/admin-about.js";

import {
  handleManageCurrency,
  handleManageDepositCurrencies,
  handleManageWithdrawalCurrencies,
  handleToggleDepositCurrency,
  handleToggleWithdrawalCurrency,
} from "./handlers/admin-currency.js";

import {
  handleSupportMenu,
  handleNewComplaint,
  handleComplaintSubject,
  handleComplaintDescription,
  handleComplaintPriority,
  handleReadyToConfirm,
  handleComplaintFileUpload,
  handleSubmitComplaint,
  handleMyTickets,
  handleViewTicket,
  handleViewUserTicketFiles,
  handleViewUserTicketFile,
  handleReplyToTicket,
  handleReplyMessage,
  handleSupportCancel,
} from "./handlers/user-support.js";

import {
  handleAdminSupportDashboard,
  handleViewSupportTickets,
  handleAdminViewTicket,
  handleViewTicketFiles,
  handleViewTicketFile,
  handleAdminReplyStart,
  handleAdminReplyStoreMessage,
  handleAdminReplyFileUpload,
  handleAdminReplySubmit,
  handleEditTicketStatus,
  handleSetTicketStatus,
  handleEditTicketPriority,
  handleSetTicketPriority,
  handleMarkTicketResolved,
} from "./handlers/admin-support.js";

import {
  handleAdminNotifications,
  handleAdminNotificationDetail,
  handleAdminMarkAllNotificationsRead,
} from "./handlers/admin-notifications.js";

import {
  handleAdminSettings,
  handleEditPlatformName,
  handleEditPlatformAbout,
  handleEditPlatformWebsite,
  handleEditPlatformSupportEmail,
  handleEditPlatformMission,
  handleEditPlatformVision,
  handleEditPlatformTermsUrl,
  handleEditPlatformPrivacyUrl,
  handleProcessSettingsInput,
} from "./handlers/admin-settings.js";

import {
  handleManageHelpArticles,
  handleViewAllHelpArticles,
  handleAddHelpArticleStart,
  handleHelpArticleInput,
  handleSaveHelpArticle,
  handleEditHelpArticle,
  handleDeleteHelpArticleConfirm,
  handleDeleteHelpArticle,
  handleToggleHelpArticleStatus,
} from "./handlers/admin-help.js";

import {
  handleStartRegistration,
  handleRegistrationInput,
  handleConfirmRegistration,
  handleEditProfile,
  handleStartEditField,
  handleProcessFieldEdit,
  handleConfirmFieldEdit,
  handleResendVerificationEmail,
  handleChangeEmailPostRegistration,
  handleSaveNewEmailPostRegistration,
} from "./handlers/registration.js";

import {
  handleShowPaymentDetails,
  handleInitiateProofUpload,
  handleUploadPaymentProof,
  handleShowProofStatus,
  handleShowPendingPayments,
  handleShowProofNotes,
  handleCancelInvestment,
} from "./handlers/payment.js";

import {
  handleInitiateCryptoPayment,
  handleSelectCryptocurrency,
  handleSelectBlockchain,
  handleCheckPaymentStatus,
  handleCancelCryptoPayment,
  handleCopyAddress,
} from "./handlers/cryptoPayment.js";

import {
  handlePaymentWebhook,
  handleWithdrawalWebhook,
} from "./handlers/paymentWebhook.js";

import {
  handleAdminPaymentAccounts,
  handleAddPaymentAccount,
  handlePaymentAccountInput,
  handleViewPaymentAccounts,
  handleManagePaymentAccount,
  handleDeletePaymentAccount,
  handleConfirmDeletePaymentAccount,
  handleEditPaymentAccount,
  handleTogglePaymentAccountActive,
  handleAdminPaymentVerification,
  handleShowPendingProofs,
  handleReviewPaymentProof,
  handleApprovePaymentProof,
  handleRejectPaymentProof,
  handleConfirmRejectPaymentProof,
} from "./handlers/adminPayment.js";

import {
  mainMenuKeyboard,
  adminMenuKeyboard,
  settingsKeyboard,
  securityKeyboard,
} from "./utils/keyboard.js";

import startScheduledTasks from "./tasks/scheduler.js";

// Types for session
interface SessionData {
  userId?: string;
  telegramId?: bigint;
  isAdmin?: boolean;
  pendingInvestment?: { packageId: string; amount: number };
  approveInvestmentId?: string;
  rejectInvestmentId?: string;
  investmentPage?: number;
  allInvestmentPage?: number;
  userPage?: number;
  withdrawalPage?: number;
  notificationPage?: number;
  adminNotificationPage?: number;
  announcementStep?: string;
  announcementTitle?: string;
  announcementMessage?: string;
  announcementTarget?: string;
  targetUserIds?: string[];
  userSelectionPage?: number;
  registrationStep?: string;
  registrationData?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
  };
  editingField?: string;
  pendingFieldEdit?: {
    field: string;
    value: string;
  };
  pendingBankDetailsToken?: string;
  withdrawalData?: {
    investmentId?: string;
    availableAmount?: number;
    withdrawAmount?: number;
    withdrawalType?: string;
    packageName?: string;
    principal?: number;
    profit?: number;
    walletId?: string;
  };
  rejectingWithdrawalId?: string;
  addInvestmentStep?: string;
  addInvestmentData?: {
    userId?: string;
    packageId?: string;
    amount?: number;
    expectedReturn?: number;
    maturityDate?: Date;
  };
  addPackageStep?: string;
  addPackageData?: {
    name?: string;
    minAmount?: number;
    maxAmount?: number;
    roiPercentage?: number;
    duration?: number;
  };
  editPackageId?: string;
  editPackageStep?: string;
  editPackageField?: string;
  editAboutStep?: string;
  editAboutField?: string;
  // Payment-related
  currentInvestment?: {
    investmentId: string;
    packageName: string;
    amount: number;
    packageDuration: number;
    expectedReturn: number;
  };
  uploadingProofFor?: string;
  viewingProofStatusFor?: string;
  viewingProofNotesFor?: string;
  cancelingInvestment?: string;
  accountToManage?: string;
  approvingProofFor?: string;
  addingPaymentAccount?: boolean;
  editingAccountId?: string;
  editingAccountField?: string;
  paymentAccountData?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    instructions?: string;
  };
  rejectingProofFor?: string;
  reviewingProofFor?: string;
  accountToDelete?: string;
  enteringCustomAmountFor?: string;
  // Support-related
  supportStep?: string;
  supportData?: {
    subject?: string;
    description?: string;
    priority?: string;
    attachmentUrls?: string[];
  };
  adminReplyData?: {
    message?: string;
    attachmentUrls?: string[];
  };
  replyingToTicketId?: string;
  viewingTicketId?: string;
  editingReferralBonus?: boolean;
  // Wallet-related
  pendingWallet?: {
    cryptocurrency?: string;
  };
  // Registration email change post-registration
  changingEmailPostRegistration?: boolean;
  // Welcome media management
  managingWelcomeMedia?: boolean;
  // Help article management
  helpArticleCreation?: {
    step: "title" | "icon" | "content" | "category" | "confirm";
    title?: string;
    icon?: string;
    content?: string;
    category?: string;
    articleId?: string;
  } | null;
}

// Create bot
const bot = new Bot<Context & { session: SessionData }>(config.BOT_TOKEN);

// Session middleware
bot.use(
  session({
    initial: (): SessionData => ({}),
  })
);

// Middleware
bot.use(rateLimitMiddleware);
bot.use(loggingMiddleware);
bot.use(checkMaintenanceMode);
bot.use(ensureUserExists);

// ==================== COMMANDS ====================

// /start
bot.command("start", handleStart);

// /help
bot.command("help", handleHelp);

// /admin - Admin panel
bot.command("admin", requireAdmin, handleAdminPanel);

// /logs - Admin logs
bot.command("logs", requireAdmin, handleAdminLogs);

// ==================== TEXT HANDLERS ====================

// Main menu
bot.hears("🚀 Begin Trading", handleViewPackages);
bot.hears("📚 Packages", handleViewPackages);
bot.hears("📊 My Portfolio", requireActiveUser, handleViewPortfolio);
bot.hears("💳 My Wallet", requireActiveUser, handleViewWallets);
bot.hears("🎁 My Referrals", handleViewMyReferrals);
bot.hears("⚙️ Settings", async (ctx: any) => {
  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: ctx.session.userId },
  });
  
  if (user?.isAdmin) {
    return handleAdminSettings(ctx);
  } else {
    return handleSettings(ctx);
  }
});
bot.hears("🔐 Security", handleSecurity);
bot.hears("❓ Help", handleHelp);
bot.hears("👤 Edit Profile", handleEditProfile);
bot.hears("🏦 Bank Details", handleViewBankDetails);
bot.hears("🔔 Notifications", async (ctx: any) => {
  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: ctx.session.userId },
  });
  
  if (user?.isAdmin) {
    return handleAdminNotifications(ctx);
  } else {
    return handleNotifications(ctx);
  }
});
bot.hears("ℹ️ About", async (ctx: any) => {
  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: ctx.session.userId },
  });
  
  if (user?.isAdmin) {
    return handleManageAbout(ctx);
  } else {
    return handleViewAbout(ctx);
  }
});

bot.hears("📚 Help Articles", async (ctx: any) => {
  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: ctx.session.userId },
  });
  
  if (user?.isAdmin) {
    return handleManageHelpArticles(ctx);
  } else {
    return handleHelp(ctx);
  }
});

bot.hears("📞 Support", async (ctx: any) => {
  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: ctx.session.userId },
  });
  
  if (user?.isAdmin) {
    return handleAdminSupportDashboard(ctx);
  } else {
    return handleSupportMenu(ctx);
  }
});

bot.hears(" Export Data", (ctx) => {
  ctx.reply(
    "📥 <b>Export Account Data</b>\n\n" +
    "To export your account data, please contact support:\n" +
    `📧 Email: ${config.SMTP_FROM_EMAIL}\n\n` +
    "Your data will be provided in JSON format within 48 hours.",
    { parse_mode: "HTML", reply_markup: securityKeyboard }
  );
});
bot.hears("💾 Backup", (ctx) => {
  ctx.reply(
    "💾 <b>Account Backup</b>\n\n" +
    "Your account is automatically backed up daily.\n" +
    "No action needed on your part.\n\n" +
    "For security questions, contact support.",
    { parse_mode: "HTML", reply_markup: securityKeyboard }
  );
});
bot.hears("�🔙 Back", handleStart);

// Admin menu
bot.hears("👥 Manage Users", requireAdmin, handleManageUsers);
bot.hears("💰 Manage Investments", requireAdmin, handleManageAllInvestments);
bot.hears("� Pending Deposits", requireAdmin, handlePendingDeposits);
bot.hears("�🔗 Manage Withdrawals", requireAdmin, handlePendingWithdrawals);
bot.hears("📢 Announcements", requireAdmin, handleCreateAnnouncement);
bot.hears("📋 Logs", requireAdmin, handleAdminLogs);
bot.hears("🎬 Welcome Media", requireAdmin, handleManageWelcomeMedia);
bot.hears("📦 Manage Packages", requireAdmin, handleManagePackages);
bot.hears("� Manage Currency", requireAdmin, handleManageCurrency);
bot.hears("�💳 Payment Accounts", requireAdmin, handleAdminPaymentAccounts);
bot.hears("✅ Payment Verification", requireAdmin, handleAdminPaymentVerification);
bot.hears("🎁 Referral Settings", requireAdmin, handleReferralSettings);

bot.hears(
  "🔌 Close Admin Panel",
  (ctx) => ctx.reply("Admin panel closed", { reply_markup: mainMenuKeyboard })
);

// ==================== CALLBACK HANDLERS ====================

bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data || "";
  const userId = ctx.session.userId || ctx.from?.id;
  const userName = ctx.from?.first_name || "Unknown";
  
  try {
    // Back button handler (generic)
    if (data === "back") {
      logger.info(`↩️ Back button pressed`);
      // Determine where to go back based on context
      if (ctx.session.editingField) {
        ctx.session.editingField = undefined;
        delete ctx.session.pendingFieldEdit;
        logNavigation("Edit Field", "Edit Profile", ctx.session.userId);
        return handleEditProfile(ctx);
      } else if (ctx.session.registrationStep && ctx.session.registrationStep !== "confirm") {
        ctx.session.registrationStep = undefined;
        delete ctx.session.registrationData;
        logNavigation("Registration", "Main Menu", ctx.session.userId);
        return handleStart(ctx);
      } else {
        return handleStart(ctx);
      }
    }

    // Context-aware back buttons
    if (data === "back_from_bank_settings") {
      logNavigation("Bank Settings", "Edit Profile", ctx.session.userId);
      return handleEditProfile(ctx);
    }

    if (data === "back_from_investment") {
      logNavigation("Investment Details", "Portfolio", ctx.session.userId);
      return handleViewPortfolio(ctx);
    }

    if (data === "back_from_admin_withdrawal") {
      logNavigation("Withdrawal Details", "Pending Withdrawals", ctx.session.userId);
      return handlePendingWithdrawals(ctx);
    }

    // Resend verification email
    if (data === "resend_verification") {
      logNavigation("Profile", "Resend Verification", ctx.session.userId);
      return handleResendVerificationEmail(ctx);
    }

    // Change email post-registration
    if (data === "change_email_post_registration") {
      logNavigation("Registration Success", "Change Email", ctx.session.userId);
      await ctx.answerCallbackQuery();
      return handleChangeEmailPostRegistration(ctx);
    }

    // Profile field editing
    if (data.startsWith("edit_field_")) {
      const field = data.replace("edit_field_", "");
      
      // Check if editing payment account
      if (ctx.session.editingAccountId) {
        ctx.session.editingAccountField = field;
        const fieldLabels: any = {
          bankName: "Bank Name",
          accountName: "Account Name",
          accountNumber: "Account Number",
          instructions: "Instructions",
        };
        await ctx.reply(
          `📝 Enter new <b>${fieldLabels[field] || field}</b>:`,
          { parse_mode: "HTML" }
        );
      } else {
        // User profile field editing
        logger.info(`✏️ Editing field: ${field}`);
        return handleStartEditField(ctx, field);
      }
    }

    // Pagination
    if (data.startsWith("pending_inv_")) {
      if (data.includes("_prev_")) {
        ctx.session.investmentPage = (ctx.session.investmentPage || 2) - 1;
        logger.info(`⬅️ Previous page: Investment page ${ctx.session.investmentPage}`);
      } else if (data.includes("_next_")) {
        ctx.session.investmentPage = (ctx.session.investmentPage || 1) + 1;
        logger.info(`➡️ Next page: Investment page ${ctx.session.investmentPage}`);
      }
      return handlePendingInvestments(ctx);
    }

    // Start new investment (from admin button)
    if (data === "start_new_investment") {
      logger.info(`🚀 Starting new investment from admin button`);
      return handleViewPackages(ctx);
    }

    // Package selection
    if (data.startsWith("select_package_")) {
      const packageId = data.replace("select_package_", "");
      logger.info(`📦 Package selected: ${packageId}`);
      return handleSelectPackage(ctx, packageId);
    }

    // Amount selection
    if (data.startsWith("select_amount_")) {
      const [packageId, amount] = data.replace("select_amount_", "").split("_");
      logger.info(`💰 Amount selected: ${amount} for package ${packageId}`);
      return handleSelectAmount(ctx, packageId, parseFloat(amount));
    }

    // Custom amount entry
    if (data.startsWith("enter_custom_amount_")) {
      const packageId = data.replace("enter_custom_amount_", "");
      ctx.session.enteringCustomAmountFor = packageId;
      logger.info(`💰 Custom amount entry initiated for package ${packageId}`);
      await ctx.reply(
        `<b>💰 Enter Custom Amount</b>\n\nPlease type the amount you want to invest (in USD).\n\nExample: 50000`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Investment approval
    if (data.startsWith("invest_approve_")) {
      const investmentId = data.replace("invest_approve_", "");
      logger.info(`✅ Investment approval initiated: ${investmentId}`);
      return handleApproveInvestment(ctx, investmentId);
    }

    if (data.startsWith("invest_reject_")) {
      const investmentId = data.replace("invest_reject_", "");
      logger.info(`❌ Investment rejection initiated: ${investmentId}`);
      return handleRejectInvestment(ctx, investmentId);
    }

    // User status
    if (data.startsWith("user_status_")) {
      const action = data.replace("user_status_", "").split("_")[0];
      const userId = data.split("_").slice(2).join("_");
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        logger.error(`❌ User not found: ${userId}`);
        return ctx.reply("❌ User not found");
      }

      if (action === "activate") {
        logger.info(`✅ User activated: ${user.firstName} (${userId})`);
        await prisma.user.update({
          where: { id: userId },
          data: { status: "ACTIVE" },
        });
        return ctx.reply(`✅ <b>User Activated</b>\n\n${user.firstName} is now ACTIVE`, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "👤 View Details", callback_data: `user_${userId}` }],
              [{ text: "👥 Back to Users", callback_data: "back_to_users" }],
            ],
          },
        });
      } else if (action === "suspend") {
        logger.info(`⛔ User suspended: ${user.firstName} (${userId})`);
        await prisma.user.update({
          where: { id: userId },
          data: { status: "SUSPENDED" },
        });
        return ctx.reply(`⛔ <b>User Suspended</b>\n\n${user.firstName} is now SUSPENDED from trading`, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "👤 View Details", callback_data: `user_${userId}` }],
              [{ text: "👥 Back to Users", callback_data: "back_to_users" }],
            ],
          },
        });
      } else if (action === "delete") {
        await prisma.user.update({
          where: { id: userId },
          data: { status: "DELETED" },
        });
        return ctx.reply(`🗑️ <b>User Deleted</b>\n\n${user.firstName} account has been deleted`, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "👥 Back to Users", callback_data: "back_to_users" }]],
          },
        });
      }
    }

    // Investment management (admin)
    if (data === "manage_all_investments") {
      return handleManageAllInvestments(ctx);
    }

    if (data === "add_investment_start") {
      return handleAddInvestmentStart(ctx);
    }

    if (data.startsWith("add_inv_user_")) {
      const userId = data.replace("add_inv_user_", "");
      return handleAddInvestmentSelectPackage(ctx, userId);
    }

    if (data.startsWith("add_inv_package_")) {
      const packageId = data.replace("add_inv_package_", "");
      return handleAddInvestmentAmount(ctx, packageId);
    }

    if (data === "confirm_add_investment") {
      ctx.session.addInvestmentStep = undefined;
      return handleCreateInvestmentFinal(ctx);
    }

    if (data === "cancel_add_investment") {
      delete ctx.session.addInvestmentData;
      ctx.session.addInvestmentStep = undefined;
      return handleManageAllInvestments(ctx);
    }

    if (data === "all_inv_prev") {
      if (!ctx.session.allInvestmentPage) ctx.session.allInvestmentPage = 1;
      ctx.session.allInvestmentPage--;
      return handleManageAllInvestments(ctx);
    }

    if (data === "all_inv_next") {
      if (!ctx.session.allInvestmentPage) ctx.session.allInvestmentPage = 1;
      ctx.session.allInvestmentPage++;
      return handleManageAllInvestments(ctx);
    }

    // Pending deposits (admin - manual payment confirmation)
    if (data === "view_pending_deposits") {
      (ctx.session as any).pendingDepositPage = 1;
      return handlePendingDeposits(ctx);
    }

    if (data === "pending_deposit_prev_page") {
      if (!(ctx.session as any).pendingDepositPage) (ctx.session as any).pendingDepositPage = 1;
      (ctx.session as any).pendingDepositPage--;
      if ((ctx.session as any).pendingDepositPage < 1) (ctx.session as any).pendingDepositPage = 1;
      return handlePendingDeposits(ctx);
    }

    if (data === "pending_deposit_next_page") {
      if (!(ctx.session as any).pendingDepositPage) (ctx.session as any).pendingDepositPage = 1;
      (ctx.session as any).pendingDepositPage++;
      return handlePendingDeposits(ctx);
    }

    if (data.startsWith("confirm_deposit_")) {
      const investmentId = data.replace("confirm_deposit_", "");
      return handleConfirmDepositManually(ctx, investmentId);
    }

    if (data === "back_to_admin") {
      return handleAdminPanel(ctx);
    }

    if (data === "back_to_users") {
      return handleManageUsers(ctx);
    }

    if (data === "manage_packages") {
      return handleManagePackages(ctx);
    }

    // About management
    if (data === "manage_about") {
      return handleManageAbout(ctx);
    }

    if (data.startsWith("edit_about_")) {
      const field = data.replace("edit_about_", "");
      return handleEditAboutStart(ctx, field);
    }

    if (data === "view_about") {
      return handleViewAbout(ctx);
    }

    // ==================== HELP ARTICLE MANAGEMENT ====================

    if (data === "help_menu") {
      return handleHelp(ctx);
    }

    if (data.startsWith("help_article_")) {
      const articleId = data.replace("help_article_", "");
      return handleHelpArticleView(ctx, articleId);
    }

    if (data === "manage_help_articles") {
      return handleManageHelpArticles(ctx);
    }

    if (data === "help_view_all") {
      return handleViewAllHelpArticles(ctx);
    }

    if (data === "help_add_new") {
      return handleAddHelpArticleStart(ctx);
    }

    if (data === "help_save_article") {
      return handleSaveHelpArticle(ctx);
    }

    if (data.startsWith("help_edit_")) {
      const articleId = data.replace("help_edit_", "");
      return handleEditHelpArticle(ctx, articleId);
    }

    if (data.startsWith("help_toggle_")) {
      const articleId = data.replace("help_toggle_", "");
      return handleToggleHelpArticleStatus(ctx, articleId);
    }

    if (data.startsWith("help_delete_confirm_yes_")) {
      const articleId = data.replace("help_delete_confirm_yes_", "");
      return handleDeleteHelpArticle(ctx, articleId);
    }

    if (data.startsWith("help_delete_confirm_")) {
      const articleId = data.replace("help_delete_confirm_", "");
      return handleDeleteHelpArticleConfirm(ctx, articleId);
    }

    // ==================== CURRENCY MANAGEMENT ====================

    if (data === "manage_currency") {
      return handleManageCurrency(ctx);
    }

    if (data === "manage_deposit_currencies") {
      return handleManageDepositCurrencies(ctx);
    }

    if (data === "manage_withdrawal_currencies") {
      return handleManageWithdrawalCurrencies(ctx);
    }

    if (data.startsWith("toggle_deposit_")) {
      const cryptocurrency = data.replace("toggle_deposit_", "");
      return handleToggleDepositCurrency(ctx, cryptocurrency);
    }

    if (data.startsWith("toggle_withdrawal_")) {
      const cryptocurrency = data.replace("toggle_withdrawal_", "");
      return handleToggleWithdrawalCurrency(ctx, cryptocurrency);
    }

    // ==================== PLATFORM SETTINGS ====================

    if (data === "admin_settings") {
      return handleAdminSettings(ctx);
    }

    if (data === "edit_platform_name") {
      return handleEditPlatformName(ctx);
    }

    if (data === "edit_platform_about") {
      return handleEditPlatformAbout(ctx);
    }

    if (data === "edit_platform_website") {
      return handleEditPlatformWebsite(ctx);
    }

    if (data === "edit_platform_support_email") {
      return handleEditPlatformSupportEmail(ctx);
    }

    if (data === "edit_platform_mission") {
      return handleEditPlatformMission(ctx);
    }

    if (data === "edit_platform_vision") {
      return handleEditPlatformVision(ctx);
    }

    if (data === "edit_platform_terms_url") {
      return handleEditPlatformTermsUrl(ctx);
    }

    if (data === "edit_platform_privacy_url") {
      return handleEditPlatformPrivacyUrl(ctx);
    }

    // ==================== SUPPORT CALLBACKS ====================

    // User support
    if (data === "support_new_complaint") {
      return handleNewComplaint(ctx);
    }

    if (data.startsWith("support_priority_")) {
      const priority = data.replace("support_priority_", "");
      return handleComplaintPriority(ctx, priority);
    }

    if (data === "support_skip_files") {
      return handleReadyToConfirm(ctx);
    }

    if (data === "support_confirm_submit") {
      return handleSubmitComplaint(ctx);
    }

    if (data === "support_cancel") {
      return handleSupportCancel(ctx);
    }

    if (data.startsWith("support_my_tickets_page_")) {
      const page = parseInt(data.replace("support_my_tickets_page_", ""));
      return handleMyTickets(ctx, page);
    }

    if (data.startsWith("support_view_ticket_")) {
      const ticketId = data.replace("support_view_ticket_", "");
      return handleViewTicket(ctx, ticketId);
    }

    if (data.startsWith("support_view_files_")) {
      const ticketId = data.replace("support_view_files_", "");
      return handleViewUserTicketFiles(ctx, ticketId);
    }

    if (data.startsWith("support_file_")) {
      const parts = data.replace("support_file_", "").split("_");
      const ticketId = parts[0];
      const fileIndex = parts[1];
      return handleViewUserTicketFile(ctx, ticketId, fileIndex);
    }

    if (data.startsWith("support_reply_")) {
      const ticketId = data.replace("support_reply_", "");
      return handleReplyToTicket(ctx, ticketId);
    }

    // Admin support
    if (data === "admin_support_dashboard") {
      return handleAdminSupportDashboard(ctx);
    }

    if (data.startsWith("admin_support_status_")) {
      const parts = data.replace("admin_support_status_", "").split("_page_");
      const status = parts[0];
      const page = parseInt(parts[1]) || 1;
      return handleViewSupportTickets(ctx, status, page);
    }

    if (data === "admin_support_all_page_1" || data.startsWith("admin_support_all_page_")) {
      const page = parseInt(data.replace("admin_support_all_page_", "")) || 1;
      return handleViewSupportTickets(ctx, null, page);
    }

    if (data.startsWith("admin_support_view_")) {
      const ticketId = data.replace("admin_support_view_", "");
      return handleAdminViewTicket(ctx, ticketId);
    }

    if (data.startsWith("admin_support_files_")) {
      const ticketId = data.replace("admin_support_files_", "");
      return handleViewTicketFiles(ctx, ticketId);
    }

    if (data.startsWith("admin_support_file_")) {
      const parts = data.replace("admin_support_file_", "").split("_");
      const ticketId = parts[0];
      const fileIndex = parts[1];
      return handleViewTicketFile(ctx, ticketId, fileIndex);
    }

    if (data.startsWith("admin_support_reply_")) {
      const ticketId = data.replace("admin_support_reply_", "");
      return handleAdminReplyStart(ctx, ticketId);
    }

    if (data.startsWith("admin_support_send_reply_")) {
      const ticketId = data.replace("admin_support_send_reply_", "");
      // Send the reply that was stored
      const message = ctx.session.adminReplyData?.message || "";
      if (message) {
        return handleAdminReplySubmit(ctx, message);
      } else {
        await ctx.reply("❌ No message to send. Please type your reply first.");
        return ctx.answerCallbackQuery();
      }
    }

    if (data.startsWith("admin_support_edit_status_")) {
      const ticketId = data.replace("admin_support_edit_status_", "");
      return handleEditTicketStatus(ctx, ticketId);
    }

    if (data.startsWith("admin_support_set_status_")) {
      const parts = data.replace("admin_support_set_status_", "").split("_");
      const status = parts[0];
      const ticketId = parts[1];
      return handleSetTicketStatus(ctx, status, ticketId);
    }

    if (data.startsWith("admin_support_edit_priority_")) {
      const ticketId = data.replace("admin_support_edit_priority_", "");
      return handleEditTicketPriority(ctx, ticketId);
    }

    if (data.startsWith("admin_support_set_priority_")) {
      const parts = data.replace("admin_support_set_priority_", "").split("_");
      const priority = parts[0];
      const ticketId = parts[1];
      return handleSetTicketPriority(ctx, priority, ticketId);
    }

    if (data.startsWith("admin_support_resolve_")) {
      const ticketId = data.replace("admin_support_resolve_", "");
      return handleMarkTicketResolved(ctx, ticketId);
    }

    // Package management
    if (data === "add_package_start") {
      return handleAddPackageStart(ctx);
    }

    if (data.startsWith("edit_package_")) {
      const packageId = data.replace("edit_package_", "");
      return handleEditPackageStart(ctx, packageId);
    }

    if (data.startsWith("edit_pkg_")) {
      const parts = data.replace("edit_pkg_", "").split("_");
      const field = parts.slice(0, -1).join("_");
      const packageId = parts[parts.length - 1];
      return handleUpdatePackageField(ctx, packageId, field);
    }

    if (data.startsWith("pkg_risk_")) {
      const parts = data.replace("pkg_risk_", "").split("_");
      const riskLevel = parts.slice(0, -1).join("_");
      const packageId = parts[parts.length - 1];
      return handleUpdateRiskLevel(ctx, packageId, riskLevel);
    }

    // User details
    if (data.startsWith("user_")) {
      const userId = data.replace("user_", "");
      return handleUserDetails(ctx, userId);
    }

    // Confirmation for registration and profile edits
    if (data === "confirm_yes") {
      if (ctx.session.registrationStep === "confirm") {
        return handleConfirmRegistration(ctx, true);
      } else if (ctx.session.editingField === "bankDetails") {
        return handleConfirmBankDetails(ctx, true);
      } else if (ctx.session.editingField) {
        return handleConfirmFieldEdit(ctx, true);
      } else if (ctx.session.withdrawalData?.withdrawAmount) {
        return handleCompleteWithdrawal(ctx, true);
      } else {
        return handleConfirmInvestment(ctx);
      }
    }

    if (data === "confirm_no") {
      if (ctx.session.registrationStep === "confirm") {
        return handleConfirmRegistration(ctx, false);
      } else if (ctx.session.editingField === "bankDetails") {
        return handleConfirmBankDetails(ctx, false);
      } else if (ctx.session.editingField) {
        return handleConfirmFieldEdit(ctx, false);
      } else if (ctx.session.withdrawalData?.withdrawAmount) {
        return handleCompleteWithdrawal(ctx, false);
      } else {
        delete ctx.session.pendingInvestment;
        return ctx.reply("✅ Investment cancelled", {
          reply_markup: mainMenuKeyboard,
        });
      }
    }

    // Announcement target
    if (data === "announce_all") {
      ctx.session.announcementTarget = "ALL";
      return handleAskAnnouncementTitle(ctx);
    } else if (data === "announce_active") {
      ctx.session.announcementTarget = "ACTIVE_INVESTORS";
      return handleAskAnnouncementTitle(ctx);
    } else if (data === "announce_noninvestors") {
      ctx.session.announcementTarget = "NON_INVESTORS";
      return handleAskAnnouncementTitle(ctx);
    } else if (data === "announce_pick_user") {
      ctx.session.userSelectionPage = 0;
      return handleShowUsersForSelection(ctx);
    } else if (data.startsWith("announce_user_")) {
      const userId = data.replace("announce_user_", "");
      ctx.session.targetUserIds = [userId];
      ctx.session.announcementTarget = "SPECIFIC_USERS";
      return handleAskAnnouncementTitle(ctx);
    } else if (data === "announce_users_prev") {
      if (!ctx.session.userSelectionPage) ctx.session.userSelectionPage = 0;
      ctx.session.userSelectionPage--;
      return handleShowUsersForSelection(ctx);
    } else if (data === "announce_send_now") {
      // Skip media and send announcement
      return handleSendAnnouncement(ctx);
    } else if (data === "announce_add_photo") {
      logger.info(`🔘 announce_add_photo button clicked`);
      ctx.session.announcementStep = "photo";
      logger.info(`✅ Session announcementStep set to: photo`, { announcementStep: ctx.session.announcementStep });
      const reply = await ctx.reply("📸 Please send a photo for this announcement:");
      logger.info(`✅ Replied with message ID: ${reply.message_id}`);
      return;
    } else if (data === "announce_add_video") {
      logger.info(`🔘 announce_add_video button clicked`);
      ctx.session.announcementStep = "video";
      logger.info(`✅ Session announcementStep set to: video`, { announcementStep: ctx.session.announcementStep });
      const reply = await ctx.reply("🎥 Please send a video for this announcement:");
      logger.info(`✅ Replied with message ID: ${reply.message_id}`);
      return;
    } else if (data === "announce_add_gif") {
      logger.info(`🔘 announce_add_gif button clicked`);
      ctx.session.announcementStep = "animation";
      await ctx.reply("🎬 Please send an animated GIF for this announcement:");
      return;
    }

    // Bank details
    if (data === "edit_bank_details") {
      return handleEditBankDetails(ctx);
    }

    // Settings menu callbacks
    if (data === "edit_profile") {
      logNavigation("Settings", "Edit Profile", ctx.session.userId);
      return handleEditProfile(ctx);
    }

    if (data === "view_bank_details") {
      logNavigation("Settings", "Bank Details", ctx.session.userId);
      return handleViewBankDetails(ctx);
    }

    // Wallet management
    if (data === "view_wallets") {
      logNavigation("Settings", "Your Wallets", ctx.session.userId);
      return handleViewWallets(ctx);
    }

    if (data === "add_wallet") {
      logNavigation("Wallets", "Add Wallet", ctx.session.userId);
      return handleAddWalletStart(ctx);
    }

    if (data.startsWith("add_wallet_blockchain_")) {
      const blockchain = data.replace("add_wallet_blockchain_", "");
      return handleAddWalletAddress(ctx, blockchain);
    }

    if (data === "back_from_wallets") {
      return handleSettings(ctx);
    }

    if (data.startsWith("delete_wallet_")) {
      const walletId = data.replace("delete_wallet_", "");
      return handleDeleteWallet(ctx, walletId);
    }

    if (data === "view_security") {
      logNavigation("Settings", "Security", ctx.session.userId);
      return handleSecurity(ctx);
    }

    if (data === "view_notifications") {
      logNavigation("Settings", "Notifications", ctx.session.userId);
      return handleNotifications(ctx);
    }

    // Security settings callbacks
    if (data === "export_data") {
      return handleExportData(ctx);
    }

    if (data === "backup_data") {
      await ctx.reply(
        "💾 <b>Account Backup</b>\n\n" +
        "Your account is automatically backed up daily.\n" +
        "No action needed on your part.\n\n" +
        "For security questions, contact support.",
        { parse_mode: "HTML", reply_markup: securityKeyboard }
      );
      return;
    }

    if (data === "back_to_settings") {
      return handleSettings(ctx);
    }

    // Investment details and withdrawal
    if (data.startsWith("invest_details_")) {
      const investmentId = data.replace("invest_details_", "");
      return handleViewInvestmentDetails(ctx, investmentId);
    }

    // Live growth view
    if (data.startsWith("view_live_growth_")) {
      const investmentId = data.replace("view_live_growth_", "");
      return handleViewLiveGrowth(ctx, investmentId);
    }

    if (data.startsWith("close_live_growth_")) {
      const investmentId = data.replace("close_live_growth_", "");
      return handleCloseLiveGrowth(ctx, investmentId);
    }

    // CRYPTO PAYMENT CALLBACKS
    if (data.startsWith("initiate_crypto_")) {
      const investmentId = data.replace("initiate_crypto_", "");
      return handleInitiateCryptoPayment(ctx);
    }

    if (data.startsWith("select_crypto_")) {
      return handleSelectCryptocurrency(ctx);
    }

    if (data.startsWith("select_blockchain_")) {
      return handleSelectBlockchain(ctx);
    }

    if (data.startsWith("check_payment_status_")) {
      return handleCheckPaymentStatus(ctx);
    }

    if (data.startsWith("cancel_investment_")) {
      return handleCancelCryptoPayment(ctx);
    }

    if (data.startsWith("copy_address_")) {
      return handleCopyAddress(ctx);
    }

    if (data.startsWith("retry_crypto_payment_")) {
      return handleInitiateCryptoPayment(ctx);
    }

    // Missing handlers for common callbacks
    if (data === "support") {
      logNavigation("Crypto Payment", "Support Menu", ctx.session.userId);
      return handleSupportMenu(ctx);
    }

    if (data === "menu") {
      logNavigation("Feature", "Main Menu", ctx.session.userId);
      return handleStart(ctx);
    }

    if (data === "my_investments") {
      logNavigation("Feature", "My Portfolio", ctx.session.userId);
      return handleViewPortfolio(ctx);
    }

    if (data === "invest") {
      logNavigation("Notification", "Packages", ctx.session.userId);
      return handleViewPackages(ctx);
    }

    if (data === "portfolio") {
      logNavigation("Notification", "My Portfolio", ctx.session.userId);
      return handleViewPortfolio(ctx);
    }

    // Generic cancel without investment ID
    if (data === "cancel_investment") {
      logNavigation("Feature", "Main Menu", ctx.session.userId);
      return handleStart(ctx);
    }

    // Pending withdrawal notice
    if (data === "has_pending_withdrawal") {
      const pendingWithdrawalDetails = await InvestmentService.getPendingWithdrawalDetails(ctx.session.userId);
      if (pendingWithdrawalDetails) {
        const message = `⏳ <b>Pending Withdrawal Active</b>\n\n⚠️ You cannot make a new withdrawal until your current pending request is completed.\n\n<b>Details:</b>\n• Amount: ${formatCurrency(pendingWithdrawalDetails.amount)}\n• Status: ${pendingWithdrawalDetails.status}\n• Request ID: <code>${pendingWithdrawalDetails.id}</code>`;
        await ctx.answerCallbackQuery();
        await ctx.reply(message, { parse_mode: "HTML" });
      }
      return;
    }

    // SPECIFIC WITHDRAW HANDLERS - MUST BE BEFORE GENERIC "withdraw_" HANDLER
    if (data.startsWith("withdraw_investment_input_")) {
      const investmentId = data.replace("withdraw_investment_input_", "").trim();
      return handleWithdrawInvestmentInput(ctx, investmentId);
    }

    // Handle wallet selection for old investment withdrawal flow
    if (data.startsWith("withdraw_select_wallet_input_")) {
      const walletId = data.replace("withdraw_select_wallet_input_", "").trim();
      const { handleConfirmWalletForWithdrawalInput } = await import("./handlers/user.js");
      return handleConfirmWalletForWithdrawalInput(ctx, walletId);
    }

    if (data.startsWith("withdraw_investment_")) {
      const investmentId = data.replace("withdraw_investment_", "").trim();
      return handleWithdrawInvestment(ctx, investmentId);
    }

    // GENERIC WITHDRAW HANDLER - catches other withdraw types
    if (data.startsWith("withdraw_")) {
      const investmentId = data.replace("withdraw_", "");
      return handleProcessWithdrawal(ctx, investmentId);
    }

    if (data === "insufficient_funds") {
      return ctx.reply("❌ No funds available to withdraw at this time");
    }

    // Admin withdrawal management
    if (data.startsWith("view_withdrawal_")) {
      const withdrawalId = data.replace("view_withdrawal_", "");
      const { handleViewWithdrawalDetail } = await import("./handlers/admin.js");
      return handleViewWithdrawalDetail(ctx, withdrawalId);
    }

    if (data.startsWith("approve_withdrawal_")) {
      const withdrawalId = data.replace("approve_withdrawal_", "");
      return handleApproveWithdrawal(ctx, withdrawalId);
    }

    if (data.startsWith("complete_withdrawal_")) {
      const withdrawalId = data.replace("complete_withdrawal_", "");
      return handleAdminCompleteWithdrawal(ctx, withdrawalId);
    }

    if (data.startsWith("reject_withdrawal_inline_")) {
      const withdrawalId = data.replace("reject_withdrawal_inline_", "");
      return handleRejectWithdrawalRequest(ctx, withdrawalId);
    }

    // NEW CRYPTO WITHDRAWAL SYSTEM
    if (data.startsWith("admin_view_withdrawal_")) {
      const withdrawalId = data.replace("admin_view_withdrawal_", "");
      const { handleAdminViewWithdrawalDetails } = await import("./handlers/withdrawalAdmin.js");
      return handleAdminViewWithdrawalDetails(ctx, withdrawalId);
    }

    if (data.startsWith("admin_approve_withdrawal_")) {
      const withdrawalId = data.replace("admin_approve_withdrawal_", "");
      const { handleAdminApproveWithdrawal } = await import("./handlers/withdrawalAdmin.js");
      return handleAdminApproveWithdrawal(ctx, withdrawalId);
    }

    if (data.startsWith("admin_mark_withdrawal_paid_")) {
      const withdrawalId = data.replace("admin_mark_withdrawal_paid_", "");
      const { handleAdminMarkWithdrawalPaid } = await import("./handlers/withdrawalAdmin.js");
      return handleAdminMarkWithdrawalPaid(ctx, withdrawalId);
    }

    if (data.startsWith("admin_reject_withdrawal_")) {
      const withdrawalId = data.replace("admin_reject_withdrawal_", "");
      const { handleAdminRejectWithdrawal } = await import("./handlers/withdrawalAdmin.js");
      return handleAdminRejectWithdrawal(ctx, withdrawalId);
    }

    if (data === "admin_view_withdrawals") {
      const { handleAdminViewWithdrawals } = await import("./handlers/withdrawalAdmin.js");
      return handleAdminViewWithdrawals(ctx);
    }

    // Crypto withdrawal text input for rejection reason
    if (ctx.session.rejectingWithdrawalId && (ctx.message as any)?.text && !(ctx.message as any).text.startsWith("/")) {
      const { handleAdminRejectWithdrawalReason } = await import("./handlers/withdrawalAdmin.js");
      return handleAdminRejectWithdrawalReason(ctx);
    }

    if (data.startsWith("withdrawals_page_")) {
      const page = parseInt(data.replace("withdrawals_page_", ""));
      ctx.session.withdrawalPage = page;
      const { handlePendingWithdrawals } = await import("./handlers/admin.js");
      return handlePendingWithdrawals(ctx);
    }

    if (data === "back_to_withdrawals") {
      const { handlePendingWithdrawals } = await import("./handlers/admin.js");
      return handlePendingWithdrawals(ctx);
    }

    if (data === "waiting_verify") {
      return ctx.reply("Please wait for the user to verify their email address");
    }

    // Withdrawal confirmations
    if (data === "confirm_withdrawal_amount") {
      return handleConfirmWithdrawalAmount(ctx);
    }

    if (data === "cancel_withdrawal") {
      delete ctx.session.withdrawalData;
      return ctx.reply("Withdrawal cancelled");
    }

    // Notifications
    if (data.startsWith("notification_page:")) {
      const page = parseInt(data.replace("notification_page:", ""));
      ctx.session.notificationPage = page;
      return handleNotifications(ctx);
    }

    // ==================== PAYMENT HANDLERS ====================

    // Payment details and proof upload
    if (data === "show_payment_details") {
      return handleShowPaymentDetails(ctx);
    }

    if (data.startsWith("upload_proof_")) {
      const investmentId = data.replace("upload_proof_", "");
      ctx.session.uploadingProofFor = investmentId;
      return handleInitiateProofUpload(ctx);
    }

    if (data.startsWith("proof_upload_screenshot_")) {
      const investmentId = data.replace("proof_upload_screenshot_", "");
      ctx.session.uploadingProofFor = investmentId;
      await ctx.reply("📸 Please send a screenshot of your payment receipt.\n\nYou can use:\n• Image file\n• Screenshot/Photo\n• Any clear image showing the transaction");
      return;
    }

    if (data.startsWith("proof_take_photo_")) {
      const investmentId = data.replace("proof_take_photo_", "");
      ctx.session.uploadingProofFor = investmentId;
      await ctx.reply("📷 Please send a photo of your payment receipt.\n\nYou can:\n• Take a photo with your camera\n• Upload an existing image\n• Send a screenshot\n\nMake sure it's clear and shows all transaction details");
      return;
    }

    if (data.startsWith("back_to_payment_details_")) {
      const investmentId = data.replace("back_to_payment_details_", "");
      ctx.session.currentInvestment = {
        investmentId: investmentId,
        packageName: ctx.session.currentInvestment?.packageName || "",
        amount: ctx.session.currentInvestment?.amount || 0,
        packageDuration: ctx.session.currentInvestment?.packageDuration || 0,
        expectedReturn: ctx.session.currentInvestment?.expectedReturn || 0,
      };
      return handleShowPaymentDetails(ctx);
    }

    if (data.startsWith("proof_status_")) {
      const investmentId = data.replace("proof_status_", "");
      ctx.session.viewingProofStatusFor = investmentId;
      return handleShowProofStatus(ctx);
    }

    if (data.startsWith("proof_notes_")) {
      const investmentId = data.replace("proof_notes_", "");
      ctx.session.viewingProofNotesFor = investmentId;
      return handleShowProofNotes(ctx);
    }

    if (data.startsWith("view_proof_")) {
      const investmentId = data.replace("view_proof_", "");
      // Will be implemented when cloud storage is added
      return ctx.reply("📄 Proof view feature coming soon with cloud storage integration");
    }

    if (data.startsWith("cancel_investment_")) {
      const investmentId = data.replace("cancel_investment_", "");
      ctx.session.cancelingInvestment = investmentId;
      return handleCancelInvestment(ctx);
    }

    if (data.startsWith("save_draft_")) {
      await ctx.reply("💾 Investment saved as draft. You can complete it anytime.");
      return;
    }

    // Pending payments dashboard
    if (data === "my_pending_payments") {
      return handleShowPendingPayments(ctx);
    }

    if (data.startsWith("refresh_payment_status_")) {
      const investmentId = data.replace("refresh_payment_status_", "");
      ctx.session.viewingProofStatusFor = investmentId;
      return handleShowProofStatus(ctx);
    }

    if (data.startsWith("view_pending_status_")) {
      const investmentId = data.replace("view_pending_status_", "");
      ctx.session.viewingProofStatusFor = investmentId;
      return handleShowProofStatus(ctx);
    }

    // ==================== PORTFOLIO INVESTMENT HANDLERS ====================

    if (data === "view_portfolio" || data === "portfolio") {
      const { handleViewPortfolio } = await import("./handlers/user.js");
      return handleViewPortfolio(ctx);
    }

    if (data.startsWith("view_investment_")) {
      const investmentId = data.replace("view_investment_", "").trim();
      logger.info(`[BUTTON] View investment details for: [${investmentId}]`);
      return handleShowInvestmentDetails(ctx, investmentId);
    }

    if (data === "investment_not_matured") {
      await ctx.reply("⏱️ This investment has not matured yet. Please wait until the maturity date to withdraw the full investment.");
      return;
    }

    // ==================== USER CRYPTO WITHDRAWAL HANDLERS ====================

    if (data.startsWith("withdraw_crypto_")) {
      const investmentId = data.replace("withdraw_crypto_", "").trim();
      const { handleSelectWalletForWithdrawal } = await import("./handlers/withdrawalUser.js");
      return handleSelectWalletForWithdrawal(ctx, investmentId);
    }

    if (data.startsWith("withdraw_select_wallet_")) {
      const walletId = data.replace("withdraw_select_wallet_", "").trim();
      const { handleConfirmWalletForWithdrawal } = await import("./handlers/withdrawalUser.js");
      return handleConfirmWalletForWithdrawal(ctx, walletId);
    }

    if (data === "confirm_crypto_withdrawal") {
      const { handleConfirmCryptoWithdrawal } = await import("./handlers/withdrawalUser.js");
      return handleConfirmCryptoWithdrawal(ctx);
    }

    // ==================== ADMIN PAYMENT HANDLERS ====================

    if (data === "admin_payment_accounts") {
      return handleAdminPaymentAccounts(ctx);
    }

    if (data === "admin_add_payment_account") {
      return handleAddPaymentAccount(ctx);
    }

    if (data === "admin_view_payment_accounts") {
      return handleViewPaymentAccounts(ctx);
    }

    if (data.startsWith("admin_manage_account_")) {
      const accountId = data.replace("admin_manage_account_", "");
      ctx.session.accountToManage = accountId;
      return handleManagePaymentAccount(ctx);
    }

    if (data.startsWith("admin_edit_payment_account_")) {
      const accountId = data.replace("admin_edit_payment_account_", "");
      ctx.session.accountToManage = accountId;
      return handleEditPaymentAccount(ctx);
    }

    if (data.startsWith("admin_toggle_account_")) {
      const accountId = data.replace("admin_toggle_account_", "");
      ctx.session.accountToManage = accountId;
      return handleTogglePaymentAccountActive(ctx);
    }

    if (data.startsWith("admin_delete_payment_account_")) {
      const accountId = data.replace("admin_delete_payment_account_", "");
      ctx.session.accountToDelete = accountId;
      return handleDeletePaymentAccount(ctx);
    }

    // Admin payment verification
    if (data === "admin_payment_verification") {
      return handleAdminPaymentVerification(ctx);
    }

    if (data === "admin_verify_pending") {
      return handleShowPendingProofs(ctx);
    }

    if (data === "admin_verify_approved") {
      return ctx.reply(
        "✅ Verified Proofs - Feature to view approved proofs coming soon"
      );
    }

    if (data === "admin_verify_rejected") {
      return ctx.reply(
        "❌ Rejected Proofs - Feature to view rejected proofs coming soon"
      );
    }

    if (data.startsWith("admin_review_proof_")) {
      const investmentId = data.replace("admin_review_proof_", "");
      ctx.session.reviewingProofFor = investmentId;
      return handleReviewPaymentProof(ctx);
    }

    if (data.startsWith("admin_approve_proof_")) {
      const investmentId = data.replace("admin_approve_proof_", "");
      ctx.session.approvingProofFor = investmentId;
      return handleApprovePaymentProof(ctx);
    }

    if (data.startsWith("admin_reject_proof_")) {
      const investmentId = data.replace("admin_reject_proof_", "");
      ctx.session.rejectingProofFor = investmentId;
      return handleRejectPaymentProof(ctx);
    }

    // Delete confirmation
    if (data === "yes" && ctx.session?.accountToDelete) {
      return handleConfirmDeletePaymentAccount(ctx);
    }

    if (data === "no" && ctx.session?.accountToDelete) {
      if (ctx.session) delete ctx.session.accountToDelete;
      return handleViewPaymentAccounts(ctx);
    }

    // ==================== NOTIFICATIONS ====================

    // Notifications

    if (data === "mark_all_notifications_read") {
      try {
        const userId = ctx.session.userId;
        if (!userId) {
          await ctx.answerCallbackQuery({
            text: "❌ User not found",
          });
          return;
        }
        const { NotificationService } = await import(
          "./services/notification.js"
        );
        const count = await NotificationService.markAllAsRead(userId);
        await ctx.answerCallbackQuery({
          text: `✅ Marked ${count} notifications as read`,
        });
        return handleNotifications(ctx);
      } catch (error) {
        logger.error("Error marking notifications as read:", error);
        await ctx.answerCallbackQuery({
          text: "❌ Error marking notifications as read",
        });
      }
    }

    if (data.startsWith("delete_notification:")) {
      const notificationId = data.replace("delete_notification:", "");
      try {
        const userId = ctx.session.userId;
        if (!userId) {
          await ctx.answerCallbackQuery({
            text: "❌ User not found",
          });
          return;
        }
        const { NotificationService } = await import(
          "./services/notification.js"
        );
        await NotificationService.deleteNotification(notificationId, userId);
        await ctx.answerCallbackQuery({
          text: "✅ Notification deleted",
        });
        return handleNotifications(ctx);
      } catch (error) {
        logger.error("Error deleting notification:", error);
        await ctx.answerCallbackQuery({
          text: "❌ Error deleting notification",
        });
      }
    }

    if (data.startsWith("view_notification:")) {
      const notificationId = data.replace("view_notification:", "");
      return handleNotificationDetail(ctx, notificationId);
    }

    if (data === "back_to_notifications") {
      return handleNotifications(ctx);
    }

    if (data === "back_to_menu") {
      return handleStart(ctx);
    }

    // ==================== ADMIN NOTIFICATIONS ====================

    if (data.startsWith("admin_notification_page:")) {
      const page = parseInt(data.replace("admin_notification_page:", ""));
      ctx.session.adminNotificationPage = page;
      return handleAdminNotifications(ctx);
    }

    if (data.startsWith("admin_view_notification:")) {
      const notificationId = data.replace("admin_view_notification:", "");
      return handleAdminNotificationDetail(ctx, notificationId);
    }

    if (data === "admin_mark_all_notifications_read") {
      return handleAdminMarkAllNotificationsRead(ctx);
    }

    if (data === "back_to_admin_notifications") {
      return handleAdminNotifications(ctx);
    }

    if (data === "admin_view_notifications") {
      return handleAdminNotifications(ctx);
    }

    // Pagination for users
    if (data === "users_prev") {
      if (!ctx.session.userPage) ctx.session.userPage = 1;
      ctx.session.userPage--;
      return handleManageUsers(ctx);
    } else if (data === "users_next") {
      if (!ctx.session.userPage) ctx.session.userPage = 1;
      ctx.session.userPage++;
      return handleManageUsers(ctx);
    }

    // Pagination for withdrawals
    if (data === "withdrawals_prev") {
      if (!ctx.session.withdrawalPage) ctx.session.withdrawalPage = 1;
      ctx.session.withdrawalPage--;
      return handlePendingWithdrawals(ctx);
    } else if (data === "withdrawals_next") {
      if (!ctx.session.withdrawalPage) ctx.session.withdrawalPage = 1;
      ctx.session.withdrawalPage++;
      return handlePendingWithdrawals(ctx);
    }

    // ==================== REFERRAL CALLBACKS ====================

    if (data === "view_my_referrals") {
      logPageView(`My Referrals`, ctx.session.userId);
      return handleViewMyReferrals(ctx);
    }

    if (data === "withdraw_referral_bonus") {
      logPageView(`Withdraw Referral Bonus`, ctx.session.userId);
      return handleWithdrawReferralBonus(ctx);
    }

    if (data === "share_referral_code") {
      const user = await prisma.user.findUnique({
        where: { id: ctx.session.userId },
        select: { referralCode: true, firstName: true, lastName: true },
      });

      if (user?.referralCode) {
        await ctx.reply(
          `🎁 <b>Share Your Referral Code</b>\n\n
Your Code: <code>${user.referralCode}</code>\n\n
<b>Share this code with your friends!</b> 👇\n
When they use your code during registration, you'll earn a bonus from their investments.`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "📋 Copy Code", callback_data: "copy_referral_code" }],
                [{ text: "🔙 Back", callback_data: "view_my_referrals" }]
              ]
            }
          }
        );
      }
      return;
    }

    if (data === "confirm_referral_withdrawal") {
      return handleConfirmReferralWithdrawal(ctx);
    }

    if (data === "view_profile") {
      logPageView(`My Profile`, ctx.session.userId);
      return handleViewProfile(ctx);
    }

    if (data === "referral_settings") {
      logPageView(`Referral Settings`, ctx.session.userId);
      return handleReferralSettings(ctx);
    }

    if (data === "edit_referral_percentage") {
      logPageView(`Edit Referral Percentage`, ctx.session.userId);
      return handleEditReferralBonusStart(ctx);
    }

    if (data === "view_referral_analytics") {
      logPageView(`Referral Analytics`, ctx.session.userId);
      return handleViewReferralAnalytics(ctx);
    }

    if (data === "back_to_admin_menu") {
      logNavigation("Referral Settings", "Admin Panel", ctx.session.userId);
      return handleAdminPanel(ctx);
    }

    if (data === "admin_panel") {
      logNavigation("Admin Feature", "Admin Panel", ctx.session.userId);
      return handleAdminPanel(ctx);
    }

    // ==================== WELCOME MEDIA HANDLERS ====================

    if (data === "upload_photo_welcome") {
      ctx.session.managingWelcomeMedia = true;
      logger.info(`[ADMIN] Preparing to upload welcome photo`);
      await ctx.reply(
        "📸 <b>Upload Photo</b>\n\nPlease send the photo you want to display on the welcome screen.\n\nYou can send:\n• A JPG/PNG image file\n• A screenshot\n• Any clear image\n\nMake sure it represents your brand well! 🎨",
        { parse_mode: "HTML" }
      );
      return;
    }

    if (data === "upload_video_welcome") {
      ctx.session.managingWelcomeMedia = true;
      logger.info(`[ADMIN] Preparing to upload welcome video`);
      await ctx.reply(
        "🎥 <b>Upload Video</b>\n\nPlease send the video you want to display on the welcome screen.\n\nNote:\n• Keep it short (under 60 seconds recommended)\n• MP4 format preferred\n• File size: up to 50MB\n\nThis will impress your users! 🎬",
        { parse_mode: "HTML" }
      );
      return;
    }

    if (data === "upload_gif_welcome") {
      ctx.session.managingWelcomeMedia = true;
      logger.info(`[ADMIN] Preparing to upload welcome GIF`);
      await ctx.reply(
        "🎬 <b>Upload GIF/Animation</b>\n\nPlease send an animated GIF you want to display on the welcome screen.\n\nNote:\n• GIF or MP4 animation supported\n• Keep it short and eye-catching\n• File size: up to 50MB\n\nAnimations grab attention! ✨",
        { parse_mode: "HTML" }
      );
      return;
    }

    if (data === "remove_welcome_media_action") {
      logger.info(`[ADMIN] Initiating media removal`);
      await ctx.answerCallbackQuery();
      return handleRemoveWelcomeMedia(ctx);
    }

    logButtonResponse(data, true, ctx.session.userId);
    await ctx.answerCallbackQuery();
  } catch (error) {
    logError(`Callback [${data}]`, error as Error, ctx.session.userId);
    await ctx.reply("❌ An error occurred");
  }
});

// ==================== WELCOME MEDIA HANDLERS ====================

// Handle photo uploads for welcome media
bot.on("message:photo", async (ctx, next) => {
  if (ctx.session.managingWelcomeMedia) {
    // Check admin status for welcome media management
    if (!isAdmin(BigInt(ctx.from?.id || 0))) {
      await ctx.reply("❌ You don't have permission to manage welcome media");
      return;
    }
    await handleWelcomeMediaPhoto(ctx);
  } else {
    // Not managing welcome media, let other handlers process this (support tickets, etc.)
    await next();
  }
});

// Handle video uploads for welcome media
bot.on("message:video", async (ctx, next) => {
  if (ctx.session.managingWelcomeMedia) {
    // Check admin status for welcome media management
    if (!isAdmin(BigInt(ctx.from?.id || 0))) {
      await ctx.reply("❌ You don't have permission to manage welcome media");
      return;
    }
    await handleWelcomeMediaVideo(ctx);
  } else {
    // Not managing welcome media, let other handlers process this (support tickets, etc.)
    await next();
  }
});

// Handle animation (GIF) uploads for welcome media
bot.on("message:animation", async (ctx, next) => {
  if (ctx.session.managingWelcomeMedia) {
    // Check admin status for welcome media management
    if (!isAdmin(BigInt(ctx.from?.id || 0))) {
      await ctx.reply("❌ You don't have permission to manage welcome media");
      return;
    }
    await handleWelcomeMediaAnimation(ctx);
  } else {
    // Not managing welcome media, let other handlers process this (support tickets, etc.)
    await next();
  }
});

// Remove welcome media command
bot.command("remove_welcome_media", requireAdmin, handleRemoveWelcomeMedia);

// ==================== MESSAGE HANDLER ====================

// This handler processes workflow-specific messages (registration, investments, etc.)
// It should NOT intercept regular menu button clicks - those are handled by bot.hears() below
bot.on("message", async (ctx) => {
  try {
    const session = ctx.session;
    const text = ctx.update.message?.text || "";

    // Check if this message is part of a workflow that requires special handling
    // If not, skip this handler and let bot.hears() handlers process it
    const isWorkflowMessage = 
      session.registrationStep ||
      session.announcementStep ||
      session.supportStep ||
      session.editingField ||
      session.editPackageStep ||
      session.addPackageData ||
      session.editAboutStep ||
      session.enteringCustomAmountFor ||
      session.withdrawalData ||
      session.editingAccountId ||
      session.addingPaymentAccount ||
      session.replyingToTicketId ||
      session.editingReferralBonus ||
      session.helpArticleCreation;

    // If this is not a workflow message, don't handle it here
    if (!isWorkflowMessage && ctx.message?.text) {
      // Let bot.hears() and other handlers process this message
      logger.debug(`📨 Non-workflow text message received: "${text.substring(0, 50)}" - delegating to other handlers`);
      return;
    }

    // Log incoming message for debugging
    logger.info(`📨 Message received (workflow)`, {
      announcementStep: session.announcementStep,
      registrationStep: session.registrationStep,
      hasPhoto: !!ctx.message?.photo,
      hasVideo: !!ctx.message?.video,
      hasAnimation: !!ctx.message?.animation,
      hasText: !!text,
      messageType: ctx.message?.photo ? "photo" : ctx.message?.video ? "video" : ctx.message?.animation ? "animation" : "text",
    });

    // ==================== ANNOUNCEMENT MEDIA UPLOAD ====================
    // Handle announcement media uploads FIRST (before other text handlers)
    if (session.announcementStep === "photo") {
      logger.info(`📸 Photo upload detected, announcementStep=photo, hasPhoto=${!!ctx.message?.photo}`);
      if (ctx.message?.photo) {
        logger.info(`✅ Processing photo upload for announcement`);
        return handleAnnouncementPhotoUpload(ctx);
      } else {
        logger.warn(`⚠️ Expected photo but got: ${Object.keys(ctx.message || {}).join(", ")}`);
        await ctx.reply("❌ Please send a photo");
        return;
      }
    }

    if (session.announcementStep === "video") {
      logger.info(`🎥 Video upload detected, announcementStep=video, hasVideo=${!!ctx.message?.video}`);
      if (ctx.message?.video) {
        logger.info(`✅ Processing video upload for announcement`);
        return handleAnnouncementVideoUpload(ctx);
      } else {
        logger.warn(`⚠️ Expected video but got: ${Object.keys(ctx.message || {}).join(", ")}`);
        await ctx.reply("❌ Please send a video");
        return;
      }
    }

    if (session.announcementStep === "animation") {
      logger.info(`🎬 GIF upload detected, announcementStep=animation, hasAnimation=${!!ctx.message?.animation}`);
      if (ctx.message?.animation) {
        logger.info(`✅ Processing GIF upload for announcement`);
        return handleAnnouncementAnimationUpload(ctx);
      } else {
        logger.warn(`⚠️ Expected animation but got: ${Object.keys(ctx.message || {}).join(", ")}`);
        await ctx.reply("❌ Please send an animated GIF");
        return;
      }
    }

    // ==================== PAYMENT PROOF UPLOAD ====================
    
    // Handle payment proof file upload (document/photo)
    if (session.uploadingProofFor) {
      if (ctx.message?.photo || ctx.message?.document) {
        return handleUploadPaymentProof(ctx);
      } else {
        await ctx.reply("❌ Please upload an image or document file.");
        return;
      }
    }

    // Handle payment account creation input (admin)
    if (session.addingPaymentAccount) {
      // Determine which step we're on based on what's already in paymentAccountData
      const data = session.paymentAccountData || {};
      let step = 1;
      if (data.bankName) step = 2;
      if (data.accountName) step = 3;
      if (data.accountNumber) step = 4;
      
      return handlePaymentAccountInput(ctx, step);
    }

    // Handle payment account field editing (admin)
    if (session.editingAccountField) {
      try {
        const accountId = session.editingAccountId;
        const field = session.editingAccountField;
        const value = text.trim();

        if (!value) {
          await ctx.reply("❌ Value cannot be empty. Please try again.");
          return;
        }

        // @ts-ignore - Prisma types not regenerated
        await PaymentAccountService.updatePaymentAccount(accountId, {
          [field]: value,
        });

        const fieldLabels: any = {
          bankName: "Bank Name",
          accountName: "Account Name",
          accountNumber: "Account Number",
          instructions: "Instructions",
        };

        await ctx.reply(`✅ ${fieldLabels[field]} updated successfully!`);

        // Refresh the account management view
        session.accountToManage = accountId;
        delete session.editingAccountField;
        delete session.editingAccountId;

        return handleManagePaymentAccount(ctx);
      } catch (error) {
        logger.error("Error updating payment account field:", error);
        await ctx.reply("❌ Error updating field. Please try again.");
      }
    }

    // Handle rejection reason input (admin)
    if (session.rejectingProofFor) {
      return handleConfirmRejectPaymentProof(ctx, text);
    }

    // Handle platform settings input (admin)
    if ((session as any).settingsEditingField) {
      return handleProcessSettingsInput(ctx, text.trim());
    }

    // ==================== EXISTING HANDLERS ====================

    // Handle registration flow
    if (session.registrationStep && session.registrationStep !== "confirm") {
      return handleRegistrationInput(ctx);
    }

    // Handle bank details editing specifically
    if (session.editingField === "bankDetails") {
      return handleProcessBankDetails(ctx);
    }

    // Handle wallet address input
    if (session.pendingWallet) {
      return handleSaveWallet(ctx, text.trim());
    }

    // Handle profile field editing (for other fields like name, email, phone)
    if (session.editingField) {
      return handleProcessFieldEdit(ctx);
    }

    // Handle email change post-registration
    if (session.changingEmailPostRegistration) {
      const newEmail = text.trim();
      delete session.changingEmailPostRegistration;
      return handleSaveNewEmailPostRegistration(ctx, newEmail);
    }

    // Investment approval workflow
    if (session.approveInvestmentId) {
      return handleProcessApproval(ctx);
    }

    if (session.rejectInvestmentId) {
      return handleProcessRejection(ctx);
    }

    // Custom amount input during investment
    if (session.enteringCustomAmountFor) {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply("❌ Please enter a valid amount (must be greater than 0)");
        return;
      }
      const packageId = session.enteringCustomAmountFor;
      delete session.enteringCustomAmountFor;
      logger.info(`💰 Custom amount ${amount} entered for package ${packageId}`);
      return handleSelectAmount(ctx, packageId, amount);
    }

    // Add investment amount input
    if (session.addInvestmentStep === "enter_amount") {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply("❌ Please enter a valid number");
        return;
      }
      return handleConfirmAddInvestment(ctx, amount);
    }

    // Add/Edit package workflow
    if (session.addPackageStep === "enter_name") {
      session.addPackageData = { name: text };
      session.addPackageStep = "enter_minAmount";
      await ctx.reply("💰 Enter minimum amount:");
      return;
    }

    if (session.addPackageStep === "enter_minAmount") {
      const minAmount = parseFloat(text);
      if (isNaN(minAmount) || minAmount <= 0) {
        await ctx.reply("❌ Please enter a valid number");
        return;
      }
      session.addPackageData!.minAmount = minAmount;
      session.addPackageStep = "enter_maxAmount";
      await ctx.reply("💰 Enter maximum amount:");
      return;
    }

    if (session.addPackageStep === "enter_maxAmount") {
      const maxAmount = parseFloat(text);
      if (isNaN(maxAmount) || maxAmount <= 0) {
        await ctx.reply("❌ Please enter a valid number");
        return;
      }
      session.addPackageData!.maxAmount = maxAmount;
      session.addPackageStep = "enter_roiPercentage";
      await ctx.reply("📈 Enter ROI percentage (e.g., 10 for 10%):");
      return;
    }

    if (session.addPackageStep === "enter_roiPercentage") {
      const roiPercentage = parseFloat(text);
      if (isNaN(roiPercentage) || roiPercentage < 0) {
        await ctx.reply("❌ Please enter a valid number");
        return;
      }
      session.addPackageData!.roiPercentage = roiPercentage;
      session.addPackageStep = "enter_duration";
      await ctx.reply("📅 Enter duration in days:");
      return;
    }

    if (session.addPackageStep === "enter_duration") {
      const duration = parseInt(text);
      if (isNaN(duration) || duration <= 0) {
        await ctx.reply("❌ Please enter a valid number");
        return;
      }
      session.addPackageData!.duration = duration;
      return handleCreatePackage(ctx, session.addPackageData!);
    }

    if (session.editPackageStep === "enter_value") {
      const value = parseFloat(text);
      if (isNaN(value) || value <= 0) {
        await ctx.reply("❌ Please enter a valid number");
        return;
      }
      return handleConfirmPackageUpdate(ctx, value);
    }

    if (session.editPackageStep === "enter_description") {
      return handleConfirmPackageUpdate(ctx, text);
    }

    // About field editing workflow
    if (session.editAboutStep === "enter_value") {
      return handleConfirmAboutUpdate(ctx, text);
    }

    // Support workflow - handle complaint subject
    if (session.supportStep === "enter_subject") {
      return handleComplaintSubject(ctx, text);
    }

    // Support workflow - handle complaint description
    if (session.supportStep === "enter_description") {
      return handleComplaintDescription(ctx, text);
    }

    // Support workflow - handle file uploads during complaint creation
    if (session.supportStep === "upload_files") {
      if (ctx.message?.document || ctx.message?.photo || ctx.message?.video || ctx.message?.audio) {
        return handleComplaintFileUpload(ctx);
      }
      // If text message during upload_files, treat as "done" and continue
      if (text.toLowerCase() === "done" || text.toLowerCase() === "finished") {
        return handleReadyToConfirm(ctx);
      }
      await ctx.reply("Please send a file to attach, or say 'done' to continue without more files.");
      return;
    }

    // Support workflow - handle reply message
    if (session.supportStep === "reply_message") {
      return handleReplyMessage(ctx, text);
    }

    // Admin support workflow - handle admin reply message
    if (session.supportStep === "admin_reply_message") {
      return handleAdminReplyStoreMessage(ctx, text);
    }

    // Support workflow - handle file uploads during admin reply
    if (session.supportStep === "admin_reply_upload_files") {
      if (ctx.message?.document || ctx.message?.photo || ctx.message?.video || ctx.message?.audio) {
        return handleAdminReplyFileUpload(ctx);
      }
      // If text message during upload_files, treat as "done" and send the reply
      if (text.toLowerCase() === "done" || text.toLowerCase() === "finished") {
        // Send the reply that was stored earlier
        const message = session.adminReplyData?.message || "Response sent.";
        return handleAdminReplySubmit(ctx, message);
      }
      await ctx.reply("Please send a file to attach, or say 'done' to send the reply.");
      return;
    }

    // Referral bonus percentage edit workflow
    if (session.editingReferralBonus) {
      return handleEditReferralBonusInput(ctx);
    }

    // Withdrawal workflow - handle amount input
    if (session.withdrawalData && session.withdrawalData.withdrawalType === "REFERRAL_BONUS" && !session.withdrawalData.withdrawAmount) {
      return handleReferralBonusAmountInput(ctx);
    }

    if (session.withdrawalData && session.withdrawalData.investmentId && !session.withdrawalData.withdrawAmount) {
      return handleWithdrawalAmountInput(ctx);
    }

    // Crypto withdrawal workflow - handle amount input
    if (session.withdrawalData && session.withdrawalData.walletId && !session.withdrawalData.withdrawAmount) {
      const { handleProcessCryptoWithdrawal } = await import("./handlers/withdrawalUser.js");
      return handleProcessCryptoWithdrawal(ctx);
    }

    // Announcement workflow
    if (session.announcementStep === "title") {
      return handleAnnouncementTitle(ctx);
    }

    if (session.announcementStep === "message") {
      return handleAnnouncementMessage(ctx);
    }

    if (session.announcementStep === "pick_user") {
      // User selection is now handled via callbacks
      logger.error(`❌ User selection error: No user selected from list`);
      return ctx.reply("❌ Please select a user from the list above");
    }

    // Help article creation workflow
    if (session.helpArticleCreation) {
      return handleHelpArticleInput(ctx, text);
    }

    // Handle text-based back buttons as fallback
    if (text === "🔙 Back") {
      logNavigation("Current Screen", "Main Menu", ctx.session.userId);
      logger.info(`✅ Back button (text) responded`);
      return handleStart(ctx);
    }
    
    logger.warn(`⚠️ Message not handled by any handler`, {
      announcementStep: session.announcementStep,
      text: text?.substring(0, 50),
      messageType: ctx.message?.photo ? "photo" : ctx.message?.video ? "video" : ctx.message?.animation ? "animation" : "text",
      hasPhoto: !!ctx.message?.photo,
    });
    
    // Allow other handlers (like bot.hears) to process this message
    logger.info(`✅ Passing message to other handlers for processing`);
  } catch (error) {
    logger.error(`❌ Error handling message: ${(error as Error).message}`, error);
  }
});

// ==================== ERROR HANDLING ====================

bot.catch((err) => {
  const ctx = err.ctx;
  logger.error("Error in update:", err.error);

  if (err.error instanceof GrammyError) {
    logger.error("Error in request:", err.error.description);
  } else if (err.error instanceof HttpError) {
    logger.error("Could not reach Telegram:", err.error);
  } else {
    logger.error("Unknown error:", err.error);
  }
});

// ==================== GRACEFUL SHUTDOWN ====================

process.once("SIGINT", async () => {
  logger.info("Shutting down gracefully...");
  await bot.stop();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.once("SIGTERM", async () => {
  logger.info("Shutting down gracefully...");
  await bot.stop();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
});

// ==================== HTTP SERVER FOR WEBHOOKS ====================

const server = createServer(async (req, res) => {
  try {
    // Handle email verification endpoint
    if (req.method === "GET" && req.url?.startsWith("/verify-email")) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get("token");

      if (!token) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h1>❌ Missing Verification Token</h1><p>No token provided for email verification.</p>`);
        return;
      }

      try {
        // Verify the token (this also updates the email if it's a new one)
        const user = await UserService.verifyEmailToken(token);

        if (!user) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`<h1>❌ Invalid or Expired Token</h1><p>The verification link has expired or is invalid.</p>`);
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <head>
              <title>Email Verified ✅</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 40px; background: #f0f0f0; }
                .container { background: white; padding: 40px; border-radius: 8px; max-width: 500px; margin: 0 auto; }
                h1 { color: #28a745; }
                p { color: #666; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>✅ Email Verified Successfully!</h1>
                <p>Your email has been verified. You can now use your account.</p>
                <p>You can return to the Telegram bot to continue using the Investment Bot.</p>
              </div>
            </body>
          </html>
        `);
        
        logger.info(`Email verified for user ${user.id}`);
      } catch (error) {
        logger.error("Email verification error:", error);
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end(`<h1>❌ Error</h1><p>An error occurred during verification: ${(error as Error).message}</p>`);
      }
      return;
    }

    // Handle bank details verification endpoint
    if (req.method === "GET" && req.url?.startsWith("/verify-bank-details")) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get("token");

      if (!token) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h1>❌ Missing Verification Token</h1><p>No token provided for bank details verification.</p>`);
        return;
      }

      try {
        // Verify the bank details token
        const user = await UserService.verifyBankDetailsToken(token);

        if (!user) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`<h1>❌ Invalid or Expired Token</h1><p>The verification link has expired or is invalid.</p>`);
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <head>
              <title>Bank Details Verified ✅</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 40px; background: #f0f0f0; }
                .container { background: white; padding: 40px; border-radius: 8px; max-width: 500px; margin: 0 auto; }
                h1 { color: #28a745; }
                p { color: #666; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>✅ Bank Details Verified Successfully!</h1>
                <p>Your bank account information has been verified and saved securely.</p>
                <p>You can now proceed with withdrawals when your investments mature.</p>
                <p>Return to the Telegram bot to continue.</p>
              </div>
            </body>
          </html>
        `);
        
        logger.info(`Bank details verified and updated for user ${user.id}`);
      } catch (error) {
        logger.error("Bank details verification error:", error);
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end(`<h1>❌ Error</h1><p>An error occurred during verification: ${(error as Error).message}</p>`);
      }
      return;
    }

    // Handle withdrawal verification endpoint
    if (req.method === "GET" && req.url?.startsWith("/verify-withdrawal")) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get("token");

      if (!token) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h1>❌ Missing Verification Token</h1><p>No token provided for withdrawal verification.</p>`);
        return;
      }

      try {
        // Import services
        const InvestmentService = (await import("./services/investment.js")).default;
        
        // Verify the withdrawal token using InvestmentService
        const verifiedWithdrawal = await InvestmentService.verifyWithdrawalToken(token);
        
        if (!verifiedWithdrawal) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`<h1>❌ Invalid or Expired Token</h1><p>The verification link has expired or is invalid.</p>`);
          return;
        }

        const user = verifiedWithdrawal.user;

        // Send admin notification about pending withdrawal
        const adminIds = getAdminIds();
        const adminMessage = `
        <b>💰 New Withdrawal Request (Email Verified)</b>

<b>User:</b> ${user.firstName || "User"}
<b>Telegram ID:</b> <code>${user.telegramId}</code>
<b>Email:</b> ${user.email}

<b>Investment Details:</b>
• Investment ID: <code>${verifiedWithdrawal.investment?.id || "N/A"}</code>
• Package: ${verifiedWithdrawal.investment?.package?.name || "N/A"}
• Withdrawal Amount: <b>${formatCurrency(verifiedWithdrawal.amount)}</b>

<b>Bank Account:</b>
${verifiedWithdrawal.bankDetails || "Not provided"}

<b>Status:</b> ✅ Email Verified - Pending Admin Approval
<b>Withdrawal ID:</b> <code>${verifiedWithdrawal.id}</code>

[Approve Withdrawal Request]
        `;

        // Notify admins
        for (const adminId of adminIds) {
          try {
            await bot.api.sendMessage(adminId.toString(), adminMessage, { parse_mode: "HTML" });
          } catch (error) {
            logger.error(`Failed to notify admin ${adminId}:`, error);
          }
        }

        // Send confirmation message to user via Telegram
        if (user && user.telegramId) {
          try {
            const userMessage = `✅ <b>Withdrawal Request Verified!</b>\n\n💰 Amount: <b>${formatCurrency(verifiedWithdrawal.amount)}</b>\n\n📋 Your withdrawal request has been verified and sent to our administration team for approval.\n\n⏳ <b>Status:</b> Pending Admin Review\n\nYou will receive a notification as soon as a decision is made.\n\n<i>Withdrawal ID: ${verifiedWithdrawal.id}</i>`;
            await bot.api.sendMessage(Number(user.telegramId), userMessage, { parse_mode: "HTML" });
            logger.info(`Withdrawal verification confirmation sent to user ${user.id}`);
          } catch (error) {
            logger.error(`Failed to send user notification for withdrawal verification:`, error);
          }
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <head>
              <title>Withdrawal Verified ✅</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 40px; background: #f0f0f0; }
                .container { background: white; padding: 40px; border-radius: 8px; max-width: 500px; margin: 0 auto; }
                h1 { color: #28a745; }
                p { color: #666; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>✅ Withdrawal Verified Successfully!</h1>
                <p>Your withdrawal request of <strong>${formatCurrency(verifiedWithdrawal.amount)}</strong> has been verified.</p>
                <p>The request has been sent to our admins for processing.</p>
                <p><strong>Status: Pending Admin Approval</strong></p>
                <p>You will be notified when your payment is being processed.</p>
                <p>Return to the Telegram bot for more details.</p>
              </div>
            </body>
          </html>
        `);
        
        logger.info(`Withdrawal email verified for request ${verifiedWithdrawal.id}`);
      } catch (error) {
        const errorMessage = (error as Error).message;
        
        // Handle invalid or expired token (client error - 400)
        if (errorMessage.includes("Invalid or expired verification token")) {
          logger.warn("Withdrawal verification failed: Invalid or expired token");
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`<h1>❌ Invalid or Expired Token</h1><p>The verification link has expired or is invalid. Please request a new withdrawal.</p>`);
          return;
        }
        
        // Handle other errors (server error - 500)
        logger.error("Withdrawal verification error:", error);
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end(`<h1>❌ Error</h1><p>An error occurred during verification: ${errorMessage}</p>`);
      }
      return;
    }

    // Handle payment webhook from NOWPayments
    if (req.method === "POST" && req.url?.startsWith("/webhook/payment")) {
      try {
        let body = "";
        
        req.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          try {
            const parsedBody = JSON.parse(body);
            req.body = parsedBody;
            req.rawBody = body;

            await handlePaymentWebhook(req, res);
          } catch (error) {
            logger.error("Error processing payment webhook:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        });

        req.on("error", (error) => {
          logger.error("Error reading payment webhook body:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        });
      } catch (error) {
        logger.error("Error setting up payment webhook handler:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
      return;
    }

    // Handle withdrawal webhook from NOWPayments
    if (req.method === "POST" && req.url?.startsWith("/webhook/withdrawal")) {
      try {
        let body = "";
        
        req.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          try {
            const parsedBody = JSON.parse(body);
            req.body = parsedBody;
            req.rawBody = body;

            await handleWithdrawalWebhook(req, res);
          } catch (error) {
            logger.error("Error processing withdrawal webhook:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        });

        req.on("error", (error) => {
          logger.error("Error reading withdrawal webhook body:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        });
      } catch (error) {
        logger.error("Error setting up withdrawal webhook handler:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
      return;
    }

    // Default 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (error) {
    logger.error("HTTP server error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
});

// ==================== STARTUP ====================

async function main(): Promise<void> {
  try {
    // Verify database connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info("✅ Database connected");
    await logDbSanity();

    // Initialize packages from env
    await PackageService.initializePackages();

    // Seed help articles if not already present
    try {
      const { seedHelpArticles } = await import("./scripts/seedHelpArticles.js");
      await seedHelpArticles();
    } catch (error) {
      logger.warn("Help articles seeding skipped:", error);
    }

    // Start scheduled tasks
    startScheduledTasks(bot);

    // Start HTTP server for webhooks
    const port = config.BOT_WEBHOOK_PORT;
    server.listen(port, () => {
      logger.info(`🌐 HTTP server listening on port ${port}`);
      logger.info(`🔗 Webhook URL: ${config.BOT_WEBHOOK_URL}`);
      logger.info(`📧 Verification endpoints: ${config.BOT_WEBHOOK_URL}/verify-email, ${config.BOT_WEBHOOK_URL}/verify-bank-details, ${config.BOT_WEBHOOK_URL}/verify-withdrawal`);
    });

    // Start bot
    logger.info("🚀 Bot starting...");
    await bot.start();
  } catch (error) {
    logger.error("Failed to start bot:", error);
    process.exit(1);
  }
}

// Add global error handlers
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

main();

export default bot;
