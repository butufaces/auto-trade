import { config } from "../config/env.js";
// @ts-ignore - date-fns doesn't have types
import { format as dateFnsFormat } from "date-fns";

/**
 * Format currency with symbol
 */
export function formatCurrency(amount: number): string {
  return `${config.CURRENCY_SYMBOL}${amount.toFixed(2)}`;
}

/**
 * Format date according to config
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateFnsFormat(dateObj, config.DATE_FORMAT);
}

/**
 * Parse admin IDs from env
 */
export function getAdminIds(): bigint[] {
  if (!config.ADMIN_IDS) return [];
  return config.ADMIN_IDS.split(",")
    .map((id) => id.trim())
    .filter((id) => id)
    .map((id) => BigInt(id));
}

/**
 * Check if user is admin
 */
export function isAdmin(telegramId: bigint): boolean {
  return getAdminIds().includes(telegramId);
}

/**
 * Parse packages from env
 */
export interface ParsedPackage {
  name: string;
  icon: string;
  minAmount: number;
  maxAmount: number;
  duration: number;
  roiPercentage: number;
  riskLevel: "LOW" | "LOW_MEDIUM" | "MEDIUM" | "MEDIUM_HIGH" | "HIGH";
  description: string;
}

export function parsePackages(): ParsedPackage[] {
  if (!config.PACKAGES) return [];

  try {
    return config.PACKAGES.split(",").map((pkg) => {
      const parts = pkg.trim().split("|");
      if (parts.length < 8) {
        throw new Error(`Invalid package format: ${pkg}`);
      }

      return {
        name: parts[0],
        icon: parts[1],
        minAmount: parseFloat(parts[2]),
        maxAmount: parseFloat(parts[3]),
        duration: parseInt(parts[4]),
        roiPercentage: parseFloat(parts[5]),
        riskLevel: parts[6] as any,
        description: parts[7],
      };
    });
  } catch (error) {
    console.error("Failed to parse packages:", error);
    return [];
  }
}

/**
 * Calculate expected return
 */
export function calculateExpectedReturn(
  amount: number,
  roiPercentage: number
): number {
  return amount + (amount * roiPercentage) / 100;
}

/**
 * Calculate maturity date
 * @param durationDays - Number of days for investment
 * @param startDate - Optional start date (defaults to now). If provided, maturity is calculated from this exact time
 * 
 * IMPORTANT: Calculates maturity to the EXACT time, not just the date.
 * Example: If activated at 10 PM on Mar 12, a 30-day investment matures at 10 PM on Apr 11
 */
export function calculateMaturityDate(durationDays: number, startDate?: Date): Date {
  const baseDate = startDate ? new Date(startDate) : new Date();
  
  // Calculate by adding exactly durationDays * 24 hours in milliseconds
  // This preserves the exact time of day (hour, minute, second)
  const millisPerDay = 24 * 60 * 60 * 1000;
  const maturityTime = baseDate.getTime() + (durationDays * millisPerDay);
  
  return new Date(maturityTime);
}

/**
 * Check if investment is matured
 */
export function isMatured(maturityDate: Date): boolean {
  return new Date() >= maturityDate;
}

/**
 * Generate referral code
 */
export function generateReferralCode(telegramId: bigint): string {
  return `REF_${telegramId}_${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Escape special characters for Telegram markdown
 */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/~/g, "\\~")
    .replace(/`/g, "\\`")
    .replace(/>/g, "\\>")
    .replace(/#/g, "\\#")
    .replace(/\+/g, "\\+")
    .replace(/\-/g, "\\-")
    .replace(/\=/g, "\\=")
    .replace(/\|/g, "\\|")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\./g, "\\.")
    .replace(/!/g, "\\!");
}

/**
 * Truncate text to max length
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Convert bigint to number safely
 */
export function bigintToNumber(value: bigint): number {
  const num = Number(value);
  if (!Number.isSafeInteger(num)) {
    throw new Error("BigInt value is too large to convert to number");
  }
  return num;
}

/**
 * Get user display name
 */
export function getUserDisplayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.firstName) {
    return user.firstName;
  }
  if (user.username) {
    return `@${user.username}`;
  }
  return "User";
}

/**
 * Delay execution
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format date
 */
export function format(date: Date): string {
  return dateFnsFormat(date, "dd/MM/yyyy");
}
/**
 * Format payment details for display
 */
export function formatPaymentDetails(account: any): string {
  let details = `<b>Bank Details</b>\n`;
  details += `🏦 <b>Bank:</b> ${account.bankName}\n`;
  details += `👤 <b>Account Name:</b> ${account.accountName}\n`;
  details += `🔢 <b>Account Number:</b> <code>${account.accountNumber}</code>\n`;

  if (account.instructions) {
    details += `\n📝 <b>Instructions:</b>\n${account.instructions}`;
  }

  return details;
}

/**
 * Format payment proof status for display
 */
export function formatPaymentProofStatus(status: string): string {
  const statusMap: Record<string, string> = {
    PENDING: "⏳ Pending Review",
    VERIFIED: "✅ Verified",
    REJECTED: "❌ Rejected",
  };
  return statusMap[status] || status;
}

/**
 * Generate payment receipt summary
 */
export function generatePaymentReceiptSummary(investment: any): string {
  let receipt = `<b>💰 Investment Receipt</b>\n\n`;
  receipt += `📦 <b>Package:</b> ${investment.packageName}\n`;
  receipt += `💵 <b>Amount:</b> ${formatCurrency(investment.amount)}\n`;
  receipt += `📅 <b>Duration:</b> ${investment.packageDuration} days\n`;
  receipt += `📈 <b>Expected Return:</b> ${formatCurrency(
    investment.expectedReturn
  )}\n\n`;
  receipt += `Status: ${formatPaymentProofStatus(
    investment.paymentProofStatus
  )}`;

  return receipt;
}