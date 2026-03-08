import { Context, NextFunction } from "grammy";
import { isAdmin } from "../lib/helpers.js";
import UserService from "../services/user.js";
import logger from "../config/logger.js";

/**
 * Ensure user exists middleware
 */
export async function ensureUserExists(
  ctx: Context & { session: any },
  next: NextFunction
): Promise<void> {
  if (!ctx.from) {
    await ctx.reply("❌ Unable to identify user");
    return;
  }

  // Check if user data is already cached in session to avoid DB hit on every request
  if (ctx.session.userId && ctx.session.telegramId) {
    // User already in session, just verify admin status (in-memory check only)
    const userIsAdmin = isAdmin(ctx.session.telegramId);
    if (ctx.session.isAdmin !== userIsAdmin) {
      ctx.session.isAdmin = userIsAdmin;
    }
    await next();
    return;
  }

  // First time user - fetch from database
  const user = await UserService.getOrCreateUser({
    id: ctx.from.id,
    username: ctx.from.username,
    first_name: ctx.from.first_name,
    last_name: ctx.from.last_name,
  });

  // Auto-detect admin role from ADMIN_IDS
  const userIsAdmin = isAdmin(user.telegramId);
  if (userIsAdmin && !user.isAdmin) {
    // Update user to admin if not already (async, don't await)
    UserService.updateAdmin(user.id, true).catch((err) =>
      logger.error("Error updating admin role:", err)
    );
    logger.info(`👑 Admin role assigned to user ${user.telegramId}`);
  }

  ctx.session.userId = user.id;
  ctx.session.telegramId = user.telegramId;
  ctx.session.isAdmin = userIsAdmin;

  await next();
}

/**
 * Require admin middleware
 */
export async function requireAdmin(
  ctx: Context & { session: any },
  next: NextFunction
): Promise<void> {
  if (!ctx.from) {
    await ctx.reply("❌ Unauthorized");
    return;
  }

  if (!isAdmin(BigInt(ctx.from.id))) {
    logger.warn(`Unauthorized admin access attempt by ${ctx.from.id}`);
    await ctx.reply("❌ You don't have permission to access this");
    return;
  }

  await next();
}

/**
 * Require active user middleware
 */
export async function requireActiveUser(
  ctx: Context & { session: any },
  next: NextFunction
): Promise<void> {
  if (!ctx.session?.userId) {
    await ctx.reply("❌ User not found");
    return;
  }

  const user = await UserService.getUserById(ctx.session.userId);

  if (!user) {
    await ctx.reply("❌ User not found");
    return;
  }

  if (user.status !== "ACTIVE") {
    await ctx.reply("❌ Your account is not active");
    return;
  }

  await next();
}

/**
 * Maintenance mode middleware
 */
export async function checkMaintenanceMode(
  ctx: Context & { session: any },
  next: NextFunction
): Promise<void> {
  const { ENABLE_MAINTENANCE_MODE, MAINTENANCE_MESSAGE } = process.env;

  if (ENABLE_MAINTENANCE_MODE === "true") {
    const isAdminUser = ctx.session?.isAdmin || false;
    if (!isAdminUser) {
      await ctx.reply(MAINTENANCE_MESSAGE || "Bot is under maintenance");
      return;
    }
  }

  await next();
}

/**
 * Rate limiting middleware (basic in-memory)
 */
const userRequests = new Map<string, number[]>();
let lastCleanup = Date.now();

export async function rateLimitMiddleware(
  ctx: Context & { session: any },
  next: NextFunction
): Promise<void> {
  if (!ctx.from) {
    await ctx.reply("❌ Unable to identify user");
    return;
  }

  const userId = ctx.from.id.toString();
  const now = Date.now();
  const windowMs = 60000; // 1 minute

  // Cleanup old entries every 5 minutes to prevent memory leak
  if (now - lastCleanup > 300000) {
    for (const [id, times] of userRequests.entries()) {
      const recent = times.filter((time) => now - time < windowMs);
      if (recent.length === 0) {
        userRequests.delete(id);
      } else {
        userRequests.set(id, recent);
      }
    }
    lastCleanup = now;
  }

  if (!userRequests.has(userId)) {
    userRequests.set(userId, []);
  }

  const requests = userRequests.get(userId)!;

  // Remove old requests outside the window
  const recentRequests = requests.filter((time) => now - time < windowMs);
  userRequests.set(userId, recentRequests);

  const maxRequests = 100; // from config

  if (recentRequests.length >= maxRequests) {
    logger.warn(`Rate limit exceeded for user ${userId}`);
    await ctx.reply(
      "⏱️ You're sending too many requests. Please try again later."
    );
    return;
  }

  recentRequests.push(now);
  userRequests.set(userId, recentRequests);

  await next();
}

/**
 * Logging middleware
 */
export async function loggingMiddleware(
  ctx: Context & { session: any },
  next: NextFunction
): Promise<void> {
  const start = Date.now();

  await next();

  const duration = Date.now() - start;
  // Only log slow responses (> 200ms) to reduce overhead
  if (duration > 200) {
    const userId = ctx.session?.userId || ctx.from?.id;
    const userName = ctx.from?.first_name || "Unknown";
    logger.warn(`⏱️ SLOW RESPONSE: [${duration}ms] for @${userName} (${userId})`);
  }
}

