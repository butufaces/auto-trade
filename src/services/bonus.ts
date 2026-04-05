import prisma from '../db/client.js';
// @ts-ignore - Prisma type export issues
import type { User, BonusStatus } from '@prisma/client';
import logger from '../config/logger.js';
import { NotificationService } from './notification.js';

export interface BonusSettings {
  registrationBonusAmount: number;
  registrationBonusExpiryDays: number;
  enabled: boolean;
}

export class BonusService {
  /**
   * Get bonus settings from database
   */
  static async getBonusSettings(): Promise<BonusSettings> {
    try {
      const settings = await (prisma as any).settings.findMany({
        where: {
          key: {
            in: ['REGISTRATION_BONUS_AMOUNT', 'REGISTRATION_BONUS_EXPIRY_DAYS', 'REGISTRATION_BONUS_ENABLED'],
          },
        },
      });

      const settingsMap = settings.reduce((acc: any, s: any) => {
        acc[s.key] = s.value;
        return acc;
      }, {});

      return {
        registrationBonusAmount: parseFloat(settingsMap['REGISTRATION_BONUS_AMOUNT'] || '10'),
        registrationBonusExpiryDays: parseInt(settingsMap['REGISTRATION_BONUS_EXPIRY_DAYS'] || '30', 10),
        enabled: settingsMap['REGISTRATION_BONUS_ENABLED'] !== 'false', // Default to true if not explicitly disabled
      };
    } catch (error) {
      logger.error('Failed to get bonus settings:', error);
      // Return default settings if fetch fails
      return {
        registrationBonusAmount: 10,
        registrationBonusExpiryDays: 30,
        enabled: true,
      };
    }
  }

  /**
   * Award registration bonus to a user after email verification
   */
  static async awardRegistrationBonus(userId: string, telegramId: BigInt): Promise<User | null> {
    try {
      const settings = await this.getBonusSettings();

      if (!settings.enabled) {
        logger.info(`[BONUS] Registration bonus disabled for user ${userId}`);
        return null;
      }

      // Check if user already has a bonus (one-time only)
      const existingUser = await (prisma as any).user.findUnique({
        where: { id: userId },
      });

      if (existingUser?.registrationBonusAmount > 0) {
        logger.warn(`[BONUS] User ${userId} already received registration bonus`);
        return null;
      }

      // Calculate expiry date
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + settings.registrationBonusExpiryDays);

      // Award bonus
      const user = await (prisma as any).user.update({
        where: { id: userId },
        data: {
          registrationBonusAmount: settings.registrationBonusAmount,
          registrationBonusStatus: 'LOCKED', // Locked until first trade
          registrationBonusExpiryDate: expiryDate,
          totalEarned: {
            increment: settings.registrationBonusAmount, // Add to total earned
          },
        },
      });

      logger.info(`[BONUS] ✅ Registration bonus awarded to user ${userId}: $${settings.registrationBonusAmount}`);
      logger.info(`[BONUS] Expiry date: ${expiryDate.toISOString()}`);

      // Send notification
      try {
        await NotificationService.createNotification(
          userId,
          '🎁 Registration Bonus Awarded!',
          `You've received $${settings.registrationBonusAmount} bonus for verifying your email!\n\n💡 Make your first investment to unlock it.`,
          'REFERRAL_BONUS'
        );
      } catch (notifError) {
        logger.error(`[BONUS] Failed to send notification to user ${userId}:`, notifError);
      }

      return user;
    } catch (error) {
      logger.error(`[BONUS] Failed to award registration bonus to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Unlock registration bonus when user completes first investment
   */
  static async unlockRegistrationBonus(userId: string): Promise<User | null> {
    try {
      const user = await (prisma as any).user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        logger.error(`[BONUS] User ${userId} not found`);
        return null;
      }

      // Check if bonus is locked
      if (user.registrationBonusStatus !== 'LOCKED') {
        return null; // Bonus already applied or expired
      }

      // Check if bonus has expired
      if (user.registrationBonusExpiryDate && new Date() > new Date(user.registrationBonusExpiryDate)) {
        // Bonus expired
        const expiredUser = await (prisma as any).user.update({
          where: { id: userId },
          data: {
            registrationBonusStatus: 'EXPIRED',
            totalEarned: {
              decrement: user.registrationBonusAmount, // Remove expired bonus from total
            },
          },
        });

        logger.info(`[BONUS] ⏰ Registration bonus expired for user ${userId}`);
        return expiredUser;
      }

      // Unlock bonus
      const unlockedUser = await (prisma as any).user.update({
        where: { id: userId },
        data: {
          registrationBonusStatus: 'UNLOCKED',
          hasCompletedFirstTrade: true,
        },
      });

      logger.info(`[BONUS] 🔓 Registration bonus unlocked for user ${userId}`);

      // Send notification
      try {
        await NotificationService.createNotification(
          userId,
          '🔓 Bonus Unlocked!',
          `Your $${user.registrationBonusAmount} bonus is now unlocked!\n\nIt will be added to your next withdrawal.`,
          'REFERRAL_BONUS'
        );
      } catch (notifError) {
        logger.error(`[BONUS] Failed to send unlockednotification to user ${userId}:`, notifError);
      }

      return unlockedUser;
    } catch (error) {
      logger.error(`[BONUS] Failed to unlock registration bonus for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Apply bonus to withdrawal amount
   */
  static async applyBonusToWithdrawal(userId: string): Promise<{ bonusAmount: number; user: User } | null> {
    try {
      const user = await (prisma as any).user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        logger.error(`[BONUS] User ${userId} not found`);
        return null;
      }

      // Check if bonus can be applied
      if (user.registrationBonusStatus !== 'UNLOCKED' || user.registrationBonusAmount <= 0) {
        return null; // No bonus to apply
      }

      // Apply bonus
      const updatedUser = await (prisma as any).user.update({
        where: { id: userId },
        data: {
          registrationBonusStatus: 'APPLIED',
        },
      });

      logger.info(`[BONUS] ✅ Bonus applied to withdrawal for user ${userId}: $${user.registrationBonusAmount}`);

      return {
        bonusAmount: user.registrationBonusAmount,
        user: updatedUser,
      };
    } catch (error) {
      logger.error(`[BONUS] Failed to apply bonus to withdrawal for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get bonus status for a user
   */
  static async getBonusStatus(userId: string): Promise<{
    amount: number;
    status: BonusStatus;
    expiryDate: Date | null;
    canWithdraw: boolean;
  } | null> {
    try {
      const user = await (prisma as any).user.findUnique({
        where: { id: userId },
      });

      if (!user || user.registrationBonusAmount === 0) {
        return null;
      }

      const canWithdraw =
        user.registrationBonusStatus === 'UNLOCKED' &&
        (!user.registrationBonusExpiryDate || new Date() <= new Date(user.registrationBonusExpiryDate));

      return {
        amount: user.registrationBonusAmount,
        status: user.registrationBonusStatus,
        expiryDate: user.registrationBonusExpiryDate,
        canWithdraw,
      };
    } catch (error) {
      logger.error(`[BONUS] Failed to get bonus status for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Update bonus settings (admin only)
   */
  static async updateBonusSettings(amount: number, expiryDays: number, enabled: boolean): Promise<void> {
    try {
      // Update registration bonus amount
      await (prisma as any).settings.upsert({
        where: { key: 'REGISTRATION_BONUS_AMOUNT' },
        update: { value: amount.toString() },
        create: {
          key: 'REGISTRATION_BONUS_AMOUNT',
          value: amount.toString(),
          type: 'number',
          description: 'Amount awarded to new users on email verification',
        },
      });

      // Update expiry days
      await (prisma as any).settings.upsert({
        where: { key: 'REGISTRATION_BONUS_EXPIRY_DAYS' },
        update: { value: expiryDays.toString() },
        create: {
          key: 'REGISTRATION_BONUS_EXPIRY_DAYS',
          value: expiryDays.toString(),
          type: 'number',
          description: 'Days until registration bonus expires',
        },
      });

      // Update enabled status
      await (prisma as any).settings.upsert({
        where: { key: 'REGISTRATION_BONUS_ENABLED' },
        update: { value: enabled ? 'true' : 'false' },
        create: {
          key: 'REGISTRATION_BONUS_ENABLED',
          value: enabled ? 'true' : 'false',
          type: 'boolean',
          description: 'Whether registration bonus is enabled',
        },
      });

      logger.info(`[BONUS] Settings updated: amount=$${amount}, expiryDays=${expiryDays}, enabled=${enabled}`);
    } catch (error) {
      logger.error('[BONUS] Failed to update bonus settings:', error);
      throw error;
    }
  }
}
