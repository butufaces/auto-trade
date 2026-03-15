import { InlineKeyboard, Keyboard } from "grammy";
import { formatCurrency } from "../lib/helpers.js";

/**
 * Main Menu Keyboard
 */
export const mainMenuKeyboard = new Keyboard()
  .text("🚀 Begin Trading")
  .text("📊 My Portfolio")
  .row()
  .text("💼 My Trades")
  .text("💳 My Wallet")
  .row()
  .text("🎁 My Referrals")
  .text("📚 Packages")
  .row()
  .text("📞 Support")
  .text("🔔 Notifications")
  .row()
  .text("ℹ️ About")
  .text("❓ Help")
  .row()
  .text("⚙️ Settings");

/**
 * Admin Menu Keyboard
 */
export const adminMenuKeyboard = new Keyboard()
  .text("👥 Manage Users")
  .text("📦 Manage Packages")
  .row()
  .text("💰 Manage Investments")
  .text("📀 Pending Deposits")
  .row()
  .text("🔗 Manage Withdrawals")
  .row()
  .text("💱 Manage Currency")
  .text("💳 Payment Accounts")
  .row()
  .text("✅ Payment Verification")
  .text("📢 Announcements")
  .row()
  .text("📞 Support")
  .text("🎁 Referral Settings")
  .row()
  .text("🔔 Notifications")
  .text("📋 Logs")
  .row()
  .text("🎬 Welcome Media")
  .text("📚 Help Articles")
  .row()
  .text("ℹ️ About")
  .text("⚙️ Settings")
  .row()
  .text("� Close Admin Panel");

/**
 * Settings Menu Keyboard
 */
export const settingsKeyboard = new InlineKeyboard()
  .text("👤 Edit Profile", "edit_profile")
  .text("💳 Your Wallet", "view_wallets")
  .row()
  .text("🔐 Security", "view_security")
  .text("🔔 Notifications", "view_notifications")
  .row()
  .text("🎁 My Referrals", "view_my_referrals")
  .text("📊 My Profile", "view_profile")
  .row()
  .text("🏠 Back to Menu", "back_to_menu");

/**
 * Security Menu Keyboard
 */
export const securityKeyboard = new InlineKeyboard()
  .text("📥 Export Data", "export_data")
  .row()
  .text("💾 Backup", "backup_data")
  .row()
  .text("🔙 Back to Settings", "back_to_settings");

/**
 * Edit Profile Menu Keyboard
 */
export const editProfileMenuKeyboard = new InlineKeyboard()
  .text("✏️ First Name", "edit_field_firstName")
  .text("✏️ Last Name", "edit_field_lastName")
  .row()
  .text("✏️ Email", "edit_field_email")
  .text("✏️ Phone", "edit_field_phoneNumber")
  .row()
  .text("🔙 Back", "back");

/**
 * Profile Edit Keyboard
 */
export const profileEditKeyboard = new InlineKeyboard()
  .text("✏️ Edit Name", "edit_name")
  .text("✏️ Edit Email", "edit_email")
  .row()
  .text("✏️ Edit Phone", "edit_phone")
  .row()
  .text("🔙 Back", "back");

/**
 * Profile Edit Keyboard with Unverified Email
 */
export const profileEditKeyboardWithResend = new InlineKeyboard()
  .text("✏️ First Name", "edit_field_firstName")
  .text("✏️ Last Name", "edit_field_lastName")
  .row()
  .text("✏️ Email", "edit_field_email")
  .text("✏️ Phone", "edit_field_phoneNumber")
  .row()
  .text("📧 Resend Verification Email", "resend_verification")
  .row()
  .text("🔙 Back", "back");

/**
 * Registration Success Keyboard
 */
export const registrationSuccessKeyboard = new InlineKeyboard()
  .text("📧 Resend Verification Email", "resend_verification")
  .text("✏️ Change Email", "change_email_post_registration")
  .row()
  .text("🏠 Go to Main Menu", "back");

/**
 * Confirmation Keyboard
 */
export const confirmationKeyboard = new InlineKeyboard()
  .text("✅ Yes", "confirm_yes")
  .text("❌ No", "confirm_no");

/**
 * Yes/No Keyboard
 */
export const yesNoKeyboard = new InlineKeyboard()
  .text("✅ Yes", "yes")
  .text("❌ No", "no");

/**
 * Approval/Rejection Keyboard
 */
export const approvalKeyboard = new InlineKeyboard()
  .text("✅ Approve", "approve")
  .text("❌ Reject", "reject");

/**
 * Back Button Keyboard
 */
export const backButtonKeyboard = new InlineKeyboard().text(
  "🔙 Back",
  "back"
);

/**
 * Create pagination keyboard
 */
export function createPaginationKeyboard(
  currentPage: number,
  totalPages: number,
  baseCallbackData: string
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (currentPage > 1) {
    keyboard.text("⬅️ Previous", `${baseCallbackData}_prev_${currentPage}`);
  }

  keyboard.text(
    `📄 ${currentPage}/${totalPages}`,
    `${baseCallbackData}_page_${currentPage}`
  );

  if (currentPage < totalPages) {
    keyboard.text("➡️ Next", `${baseCallbackData}_next_${currentPage}`);
  }

  return keyboard;
}

/**
 * Create package selection keyboard
 */
export function createPackageKeyboard(
  packages: Array<{
    id: string;
    name: string;
    icon: string;
    roiPercentage: number;
  }>,
  baseCallbackData: string = "select_package"
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  packages.forEach((pkg) => {
    keyboard.text(
      `${pkg.icon} ${pkg.name} (${pkg.roiPercentage}%)`,
      `${baseCallbackData}_${pkg.id}`
    );
    keyboard.row();
  });

  keyboard.text("🔙 Back", "back");
  return keyboard;
}

/**
 * Generate rounded amount options between min and max
 * Examples:
 * - $20 to $200: [$20, $50, $100, $200]
 * - $100 to $5000: [$100, $1000, $2500, $5000]
 * - $1000 to $50000: [$1000, $15000, $30000, $50000]
 */
function generateRoundedAmounts(
  minAmount: number,
  maxAmount: number
): number[] {
  const amounts: number[] = [minAmount];

  if (minAmount === maxAmount) {
    return amounts;
  }

  const range = maxAmount - minAmount;

  // Determine appropriate step size based on range magnitude
  let stepSize: number;
  if (range < 100) {
    stepSize = 10;
  } else if (range < 500) {
    stepSize = 25;
  } else if (range < 2000) {
    stepSize = 100;
  } else if (range < 10000) {
    stepSize = 500;
  } else if (range < 100000) {
    stepSize = 5000;
  } else {
    stepSize = 50000;
  }

  // Generate intermediate amounts
  let current = minAmount + stepSize;
  while (current < maxAmount) {
    // Round to the nearest step size
    const rounded = Math.round(current / stepSize) * stepSize;
    if (rounded > minAmount && rounded < maxAmount && !amounts.includes(rounded)) {
      amounts.push(rounded);
    }
    current += stepSize;
  }

  // Always add max amount as the last option
  if (!amounts.includes(maxAmount)) {
    amounts.push(maxAmount);
  }

  // Limit to 4 options (min + 2 intermediate + max)
  if (amounts.length > 4) {
    const result = [amounts[0]]; // Keep min
    const step = Math.floor((amounts.length - 2) / 2);
    for (let i = 1; i < amounts.length - 1; i += step) {
      result.push(amounts[i]);
    }
    result.push(amounts[amounts.length - 1]); // Keep max
    return result;
  }

  return amounts;
}

/**
 * Create amount selection keyboard
 */
export function createAmountKeyboard(
  minAmount: number,
  maxAmount: number,
  packageId: string
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const amounts = generateRoundedAmounts(minAmount, maxAmount);

  for (const amount of amounts) {
    keyboard.text(
      formatCurrency(amount),
      `select_amount_${packageId}_${amount}`
    );
    keyboard.row();
  }

  keyboard.text("💰 Custom", `enter_custom_amount_${packageId}`);
  keyboard.row();
  keyboard.text("🔙 Back", "back");

  return keyboard;
}

/**
 * Create user status keyboard
 */
export function createUserStatusKeyboard(userId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Activate", `user_status_activate_${userId}`)
    .text("⛔ Suspend", `user_status_suspend_${userId}`)
    .row()
    .text("🗑️ Delete", `user_status_delete_${userId}`)
    .row()
    .text("🔙 Back", "back");
}

/**
 * Create investment status keyboard
 */
export function createInvestmentStatusKeyboard(
  investmentId: string
): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Approve", `invest_approve_${investmentId}`)
    .text("❌ Reject", `invest_reject_${investmentId}`)
    .row()
    .text("🔙 Back", "back");
}

/**
 * Create investment action keyboard
 */
export function createInvestmentActionKeyboard(
  investmentId: string
): InlineKeyboard {
  return new InlineKeyboard()
    .text("📤 Request Payout", `invest_request_payout_${investmentId}`)
    .row()
    .text("⭐ Review", `invest_review_${investmentId}`)
    .row()
    .text("🔙 Back", "back");
}

/**
 * Create rating keyboard (1-5 stars)
 */
export function createRatingKeyboard(baseCallbackData: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("⭐", `${baseCallbackData}_1`)
    .text("⭐⭐", `${baseCallbackData}_2`)
    .text("⭐⭐⭐", `${baseCallbackData}_3`)
    .row()
    .text("⭐⭐⭐⭐", `${baseCallbackData}_4`)
    .text("⭐⭐⭐⭐⭐", `${baseCallbackData}_5`)
    .row()
    .text("🔙 Back", "back");
}

/**
 * Create withdrawal keyboard
 */
export function createWithdrawalKeyboard(userId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("💰 Request Withdrawal", `withdrawal_request_${userId}`)
    .row()
    .text("📋 Withdrawal History", `withdrawal_history_${userId}`)
    .row()
    .text("🔙 Back", "back");
}

/**
 * Create announcement target keyboard
 */
export function createAnnouncementTargetKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("👥 All Users", "announce_target_ALL")
    .row()
    .text("📈 Active Investors", "announce_target_ACTIVE_INVESTORS")
    .row()
    .text("✅ Completed Investors", "announce_target_COMPLETED_INVESTORS")
    .row()
    .text("👤 Specific Users", "announce_target_SPECIFIC_USERS")
    .row()
    .text("🔙 Back", "back");
}

/**
 * Create quick action keyboard
 */
export const quickActionKeyboard = new InlineKeyboard()
  .text("📊 View Stats", "view_stats")
  .text("💡 Tips", "tips")
  .row()
  .text("🤝 Support", "support")
  .text("🏠 Home", "home");
/**
 * Create payment confirmation keyboard
 */
export function createPaymentConfirmationKeyboard(
  investmentId: string
): InlineKeyboard {
  return new InlineKeyboard()
    .text("💳 Upload Payment Proof", `upload_proof_${investmentId}`)
    .row()
    .text("⏸️ Save as Draft", `save_draft_${investmentId}`)
    .row()
    .text("❌ Cancel", `cancel_investment_${investmentId}`);
}

/**
 * Create payment proof options keyboard
 */
export function createPaymentProofOptionsKeyboard(
  investmentId: string
): InlineKeyboard {
  return new InlineKeyboard()
    .text("🖼️ Upload Screenshot", `proof_upload_screenshot_${investmentId}`)
    .row()
    .text("📱 Take Photo", `proof_take_photo_${investmentId}`)
    .row()
    .text("🔙 Back", `back_to_payment_details_${investmentId}`);
}

/**
 * Create payment proof action keyboard
 */
export function createPaymentProofActionKeyboard(
  investmentId: string
): InlineKeyboard {
  return new InlineKeyboard()
    .text("👀 View Proof", `view_proof_${investmentId}`)
    .row()
    .text("⏳ Status", `proof_status_${investmentId}`)
    .row()
    .text("📝 View Notes", `proof_notes_${investmentId}`)
    .row()
    .text("🔙 Back", "back");
}

/**
 * Create admin payment account keyboard
 */
export function createAdminPaymentAccountKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("➕ Add Account", "admin_add_payment_account")
    .row()
    .text("📋 View All", "admin_view_payment_accounts")
    .row()
    .text("🔙 Back", "admin_menu");
}

/**
 * Create payment account management keyboard
 */
export function createPaymentAccountManageKeyboard(
  accountId: string,
  isActive: boolean = true
): InlineKeyboard {
  return new InlineKeyboard()
    .text("✏️ Edit", `admin_edit_payment_account_${accountId}`)
    .row()
    .text(
      isActive ? "✅ Active (Click to Hide)" : "⭕ Inactive (Click to Activate)",
      `admin_toggle_account_${accountId}`
    )
    .row()
    .text("🗑️ Delete", `admin_delete_payment_account_${accountId}`)
    .row()
    .text("🔙 Back", "admin_view_payment_accounts");
}

/**
 * Create admin payment verification keyboard
 */
export function createAdminPaymentVerificationKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("⏳ Pending", "admin_verify_pending")
    .row()
    .text("✅ Approved", "admin_verify_approved")
    .row()
    .text("❌ Rejected", "admin_verify_rejected")
    .row()
    .text("🔙 Back", "admin_menu");
}

/**
 * Create payment proof review keyboard
 */
export function createPaymentProofReviewKeyboard(
  investmentId: string
): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Approve", `admin_approve_proof_${investmentId}`)
    .row()
    .text("❌ Reject With Notes", `admin_reject_proof_${investmentId}`)
    .row()
    .text("🔙 Back", "admin_verify_pending");
}

/**
 * Create pending payments keyboard
 */
export function createPendingPaymentsKeyboard(
  investmentId: string
): InlineKeyboard {
  return new InlineKeyboard()
    .text("👀 View Status", `view_pending_status_${investmentId}`)
    .row()
    .text("🔄 Check Status", `refresh_payment_status_${investmentId}`)
    .row()
    .text("🔙 Back", "back");
}