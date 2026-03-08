import { Context } from "grammy";
import { NotificationService } from "../services/notification.js";
import logger from "../config/logger.js";
import { adminMenuKeyboard } from "../utils/keyboard.js";

type SessionContext = Context & { session: any };

/**
 * Get emoji for notification type
 */
function getNotificationTypeEmoji(type: string): string {
  switch (type) {
    case "INFO":
      return "ℹ️";
    case "SUCCESS":
      return "✅";
    case "WARNING":
      return "⚠️";
    case "ERROR":
      return "❌";
    case "INVESTMENT":
      return "💰";
    case "WITHDRAWAL":
      return "💸";
    case "ANNOUNCEMENT":
      return "📢";
    case "SUPPORT":
      return "📞";
    default:
      return "🔔";
  }
}

/**
 * View admin notifications
 */
export async function handleAdminNotifications(ctx: SessionContext): Promise<void> {
  try {
    const adminId = ctx.session.userId;
    const page = ctx.session.adminNotificationPage || 0;
    const limit = 5;
    const offset = page * limit;

    const { notifications, total } = await NotificationService.getUserNotifications(
      adminId,
      limit,
      offset
    );

    const unreadCount = await NotificationService.countUnreadNotifications(adminId);

    if (notifications.length === 0) {
      await ctx.reply(
        `📬 <b>Your Notifications</b>\n\n
You have no notifications at the moment.

Check back soon! 🔔`,
        {
          reply_markup: adminMenuKeyboard,
          parse_mode: "HTML",
        }
      );
      return;
    }

    const message = `📬 <b>Admin Notifications</b>\n\n📊 <b>Unread: ${unreadCount}</b>\n\n<i>Page ${page + 1} of ${Math.ceil(total / limit)}</i>\n\nClick on any notification to view details:`;

    // Create inline keyboard with notification buttons
    const keyboard = [];
    
    // Add each notification as a button
    notifications.forEach((notification: any) => {
      const readIcon = notification.isRead ? "✅" : "🆕";
      const typeEmoji = getNotificationTypeEmoji(notification.type);
      const buttonText = `${readIcon} ${typeEmoji} ${notification.title.substring(0, 40)}${notification.title.length > 40 ? "..." : ""}`;
      keyboard.push([{ text: buttonText, callback_data: `admin_view_notification:${notification.id}` }]);
    });

    // Add pagination buttons
    if (page > 0 || page < Math.ceil(total / limit) - 1) {
      const paginationRow: any[] = [];
      if (page > 0) {
        paginationRow.push({ text: "⬅️ Prev", callback_data: `admin_notification_page:${page - 1}` });
      }
      if (page < Math.ceil(total / limit) - 1) {
        paginationRow.push({ text: "Next ➡️", callback_data: `admin_notification_page:${page + 1}` });
      }
      if (paginationRow.length > 0) {
        keyboard.push(paginationRow);
      }
    }

    // Add action buttons
    keyboard.push([{ text: "🔴 Mark All as Read", callback_data: "admin_mark_all_notifications_read" }]);
    keyboard.push([{ text: "🏠 Back to Menu", callback_data: "back_to_menu" }]);

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });

    ctx.session.adminNotificationPage = page;
  } catch (error) {
    logger.error("Error in handleAdminNotifications:", error);
    await ctx.reply(
      `❌ Error loading notifications: ${(error as Error).message}`,
      {
        reply_markup: adminMenuKeyboard,
      }
    );
  }
}

/**
 * View admin notification details
 */
export async function handleAdminNotificationDetail(
  ctx: SessionContext,
  notificationId: string
): Promise<void> {
  try {
    const adminId = ctx.session.userId;
    const notification = await NotificationService.getNotificationById(notificationId, adminId);

    if (!notification) {
      await ctx.reply("❌ Notification not found", { reply_markup: adminMenuKeyboard });
      return;
    }

    // Mark as read
    if (!notification.isRead) {
      await NotificationService.markAsRead(notificationId, adminId);
    }

    const typeEmoji = getNotificationTypeEmoji(notification.type);
    let message = `${typeEmoji} <b>${notification.title}</b>\n\n`;
    message += `${notification.message}\n\n`;
    message += `<i>Received: ${new Date(notification.createdAt).toLocaleString()}</i>`;

    const keyboard = [
      [{ text: "🔙 Back to Notifications", callback_data: "back_to_admin_notifications" }],
      [{ text: "🏠 Back to Menu", callback_data: "back_to_menu" }],
    ];

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } catch (error) {
    logger.error("Error in handleAdminNotificationDetail:", error);
    await ctx.reply(
      `❌ Error loading notification: ${(error as Error).message}`,
      {
        reply_markup: adminMenuKeyboard,
      }
    );
  }
}

/**
 * Mark all admin notifications as read
 */
export async function handleAdminMarkAllNotificationsRead(
  ctx: SessionContext
): Promise<void> {
  try {
    const adminId = ctx.session.userId;
    await NotificationService.markAllAsRead(adminId);

    await ctx.reply(
      `✅ <b>All notifications marked as read</b>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📬 View Notifications", callback_data: "admin_view_notifications" }],
            [{ text: "🏠 Back to Menu", callback_data: "back_to_menu" }],
          ],
        },
      }
    );
  } catch (error) {
    logger.error("Error marking notifications as read:", error);
    await ctx.reply("❌ Error", { reply_markup: adminMenuKeyboard });
  }
}
