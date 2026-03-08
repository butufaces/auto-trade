import logger from "../config/logger.js";

/**
 * Log button click
 */
export function logButtonClick(buttonName: string, userId: string | number, userName: string) {
  logger.info(`🔘 BUTTON CLICKED: [${buttonName}] by @${userName} (${userId})`);
}

/**
 * Log page view
 */
export function logPageView(pageName: string, userId?: string) {
  const userInfo = userId ? ` | User: ${userId}` : "";
  logger.info(`📄 PAGE SHOWN: ${pageName}${userInfo}`);
}

/**
 * Log error message
 */
export function logError(action: string, error: Error | string, userId?: string) {
  const userInfo = userId ? ` | User: ${userId}` : "";
  const errorMsg = error instanceof Error ? error.message : error;
  logger.error(`❌ ERROR [${action}]: ${errorMsg}${userInfo}`);
}

/**
 * Log success action
 */
export function logSuccess(action: string, message: string, userId?: string) {
  const userInfo = userId ? ` | User: ${userId}` : "";
  logger.info(`✅ SUCCESS [${action}]: ${message}${userInfo}`);
}

/**
 * Log info message
 */
export function logInfo(message: string, userId?: string) {
  const userInfo = userId ? ` | User: ${userId}` : "";
  logger.info(`ℹ️ INFO: ${message}${userInfo}`);
}

/**
 * Log navigation
 */
export function logNavigation(from: string, to: string, userId?: string) {
  const userInfo = userId ? ` | User: ${userId}` : "";
  logger.info(`➡️ NAVIGATION: ${from} → ${to}${userInfo}`);
}

/**
 * Log warning
 */
export function logWarning(message: string, userId?: string) {
  const userInfo = userId ? ` | User: ${userId}` : "";
  logger.warn(`⚠️ WARNING: ${message}${userInfo}`);
}

/**
 * Log confirmation dialog
 */
export function logDialog(message: string, userId?: string) {
  const userInfo = userId ? ` | User: ${userId}` : "";
  logger.info(`💬 DIALOG: ${message}${userInfo}`);
}

/**
 * Log button response
 */
export function logButtonResponse(buttonName: string, responded: boolean, userId?: string) {
  const status = responded ? "✅ RESPONDED" : "❌ NO RESPONSE";
  const userInfo = userId ? ` | User: ${userId}` : "";
  logger.info(`${status}: Button [${buttonName}]${userInfo}`);
}
