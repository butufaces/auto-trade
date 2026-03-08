import prisma from '../db/client.js';
// @ts-ignore - Prisma type export issues
import type { Notification } from '@prisma/client';
import { logger } from '../config/logger.js';

export type NotificationType = 
  | 'INFO' 
  | 'SUCCESS' 
  | 'WARNING' 
  | 'ERROR' 
  | 'INVESTMENT' 
  | 'WITHDRAWAL' 
  | 'ANNOUNCEMENT'
  | 'SUPPORT'
  | 'REFERRAL_BONUS';

export class NotificationService {
  /**
   * Create a new notification for a user
   */
  static async createNotification(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    investmentId?: string,
    withdrawalId?: string,
    supportTicketId?: string
  ): Promise<Notification> {
    try {
      const notification = await (prisma as any).notification.create({
        data: {
          userId,
          title,
          message,
          type,
          investmentId: investmentId || null,
          withdrawalId: withdrawalId || null,
          supportTicketId: supportTicketId || null,
          isRead: false,
        },
      });

      logger.info(`Notification created for user ${userId}: ${title}`);
      return notification;
    } catch (error) {
      logger.error(`Failed to create notification for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get paginated notifications for a user (unread first)
   */
  static async getUserNotifications(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ notifications: Notification[]; total: number }> {
    try {
      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where: { userId },
          orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
          take: limit,
          skip: offset,
        }),
        prisma.notification.count({ where: { userId } }),
      ]);

      return { notifications, total };
    } catch (error) {
      logger.error(`Failed to get notifications for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Count unread notifications for a user
   */
  static async countUnreadNotifications(userId: string): Promise<number> {
    try {
      const count = await prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      });
      return count;
    } catch (error) {
      logger.error(`Failed to count unread notifications for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(
    notificationId: string,
    userId: string
  ): Promise<Notification> {
    try {
      const notification = await prisma.notification.update({
        where: { id: notificationId },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      logger.info(`Notification ${notificationId} marked as read for user ${userId}`);
      return notification;
    } catch (error) {
      logger.error(`Failed to mark notification as read:`, error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      logger.info(`Marked ${result.count} notifications as read for user ${userId}`);
      return result.count;
    } catch (error) {
      logger.error(`Failed to mark all notifications as read for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a specific notification
   */
  static async deleteNotification(
    notificationId: string,
    userId: string
  ): Promise<void> {
    try {
      await prisma.notification.delete({
        where: { id: notificationId },
      });

      logger.info(`Notification ${notificationId} deleted for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to delete notification:`, error);
      throw error;
    }
  }

  /**
   * Delete all old read notifications for a user (older than 30 days)
   */
  static async cleanupOldNotifications(userId: string, daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.notification.deleteMany({
        where: {
          userId,
          isRead: true,
          createdAt: { lt: cutoffDate },
        },
      });

      logger.info(`Cleaned up ${result.count} old notifications for user ${userId}`);
      return result.count;
    } catch (error) {
      logger.error(`Failed to cleanup old notifications for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific notification by ID
   */
  static async getNotificationById(
    notificationId: string,
    userId: string
  ): Promise<Notification | null> {
    try {
      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId,
        },
      });

      return notification;
    } catch (error) {
      logger.error(`Failed to get notification ${notificationId}:`, error);
      throw error;
    }
  }

  /**
   * Create notifications for all users (for announcements)
   */
  static async createBroadcastNotification(
    title: string,
    message: string,
    type: NotificationType = 'ANNOUNCEMENT'
  ): Promise<number> {
    try {
      // Get all active users
      const users = await prisma.user.findMany({
        where: {
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      // Create notifications for all users in batch
    const result = await prisma.notification.createMany({
      data: users.map((user: { id: string }) => ({
        userId: user.id,
        title,
        message,
        type,
        isRead: false,
      })),
    });

      logger.info(`Broadcast notification created for ${result.count} users: ${title}`);
      return result.count;
    } catch (error) {
      logger.error(`Failed to create broadcast notification:`, error);
      throw error;
    }
  }
}
