import prisma from '../db/client.js';
import logger from '../config/logger.js';

export interface ReminderSettings {
  enabled: boolean;
  frequencyHours: number;
  message: string;
}

export interface EscalationSettings {
  urgentThresholdDays: number; // Days remaining to trigger URGENT (e.g., 3)
  criticalThresholdHours: number; // Hours remaining to trigger CRITICAL (e.g., 24)
  regularPrefix: string; // e.g., "⏰"
  urgentPrefix: string; // e.g., "⚠️ URGENT:"
  criticalPrefix: string; // e.g., "🔴 CRITICAL:"
}

export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  totalMinutes: number;
  formatted: string; // Human-readable format like "2 days", "3 hours", "45 minutes"
}

export class BonusReminderService {
  /**
   * Get bonus reminder settings from database
   */
  static async getReminderSettings(): Promise<ReminderSettings> {
    try {
      const settings = await (prisma as any).settings.findMany({
        where: {
          key: {
            in: ['BONUS_REMINDER_ENABLED', 'BONUS_REMINDER_FREQUENCY_HOURS', 'BONUS_REMINDER_MESSAGE'],
          },
        },
      });

      const settingsMap = settings.reduce((acc: any, s: any) => {
        acc[s.key] = s.value;
        return acc;
      }, {});

      return {
        enabled: settingsMap['BONUS_REMINDER_ENABLED'] !== 'false', // Default to true
        frequencyHours: parseInt(settingsMap['BONUS_REMINDER_FREQUENCY_HOURS'] || '6', 10),
        message: settingsMap['BONUS_REMINDER_MESSAGE'] || 
          '⏰ Your $X bonus expires in Y days!\n\n💡 Don\'t miss out! Make your first trade now to use your bonus.\n\nTap here to start trading 👇',
      };
    } catch (error) {
      logger.error('Failed to get bonus reminder settings:', error);
      return {
        enabled: true,
        frequencyHours: 6,
        message: '⏰ Your $X bonus expires in Y days!\n\n💡 Don\'t miss out! Make your first trade now to use your bonus.',
      };
    }
  }

  /**
   * Get bonus escalation settings from database
   */
  static async getEscalationSettings(): Promise<EscalationSettings> {
    try {
      const settings = await (prisma as any).settings.findMany({
        where: {
          key: {
            in: [
              'BONUS_REMINDER_URGENT_THRESHOLD_DAYS',
              'BONUS_REMINDER_CRITICAL_THRESHOLD_HOURS',
              'BONUS_REMINDER_REGULAR_PREFIX',
              'BONUS_REMINDER_URGENT_PREFIX',
              'BONUS_REMINDER_CRITICAL_PREFIX',
            ],
          },
        },
      });

      const settingsMap = settings.reduce((acc: any, s: any) => {
        acc[s.key] = s.value;
        return acc;
      }, {});

      return {
        urgentThresholdDays: parseInt(settingsMap['BONUS_REMINDER_URGENT_THRESHOLD_DAYS'] || '3', 10),
        criticalThresholdHours: parseInt(settingsMap['BONUS_REMINDER_CRITICAL_THRESHOLD_HOURS'] || '24', 10),
        regularPrefix: settingsMap['BONUS_REMINDER_REGULAR_PREFIX'] || '⏰',
        urgentPrefix: settingsMap['BONUS_REMINDER_URGENT_PREFIX'] || '⚠️ URGENT:',
        criticalPrefix: settingsMap['BONUS_REMINDER_CRITICAL_PREFIX'] || '🔴 CRITICAL:',
      };
    } catch (error) {
      logger.error('Failed to get bonus escalation settings:', error);
      return {
        urgentThresholdDays: 3,
        criticalThresholdHours: 24,
        regularPrefix: '⏰',
        urgentPrefix: '⚠️ URGENT:',
        criticalPrefix: '🔴 CRITICAL:',
      };
    }
  }

  /**
   * Calculate time remaining until bonus expires with detailed breakdown
   */
  static calculateDaysRemaining(expiryDate: Date | null): TimeRemaining {
    if (!expiryDate) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        totalMinutes: 0,
        formatted: 'Expired',
      };
    }

    const now = new Date();
    const diff = expiryDate.getTime() - now.getTime();
    
    if (diff <= 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        totalMinutes: 0,
        formatted: 'Expired',
      };
    }

    const totalMinutes = Math.floor(diff / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    let formatted: string;
    if (days > 0) {
      formatted = days === 1 ? '1 day' : `${days} days`;
      if (hours > 0) {
        formatted += ` and ${hours === 1 ? '1 hour' : `${hours} hours`}`;
      }
    } else if (hours > 0) {
      formatted = hours === 1 ? '1 hour' : `${hours} hours`;
      if (minutes > 0) {
        formatted += ` and ${minutes === 1 ? '1 minute' : `${minutes} minutes`}`;
      }
    } else {
      formatted = minutes === 1 ? '1 minute' : `${minutes} minutes`;
    }

    return {
      days,
      hours,
      minutes,
      totalMinutes,
      formatted,
    };
  }

  /**
   * Get escalated message based on time remaining and escalation settings
   */
  static getEscalatedMessage(
    timeRemaining: TimeRemaining,
    bonusAmount: number,
    customMessage: string,
    escalationSettings: EscalationSettings
  ): string {
    let urgency = '';

    // Determine urgency level based on remaining time and thresholds
    if (timeRemaining.days > escalationSettings.urgentThresholdDays) {
      // Regular reminder for comfortable time window
      urgency = escalationSettings.regularPrefix;
    } else if (timeRemaining.days >= 1 && timeRemaining.days <= escalationSettings.urgentThresholdDays) {
      // Urgent reminder when approaching urgent threshold
      urgency = escalationSettings.urgentPrefix;
    } else if (timeRemaining.totalMinutes > 0 && timeRemaining.totalMinutes <= escalationSettings.criticalThresholdHours * 60) {
      // Critical for when below critical threshold
      urgency = escalationSettings.criticalPrefix;
    }

    // Replace template variables with formatted time (support both old and new formats)
    let message = customMessage
      .replace('{bonusAmount}', `$${bonusAmount.toFixed(2)}`)
      .replace('{daysLeft}', timeRemaining.formatted)
      .replace('{X}', `$${bonusAmount.toFixed(2)}`)
      .replace('{Y}', timeRemaining.formatted)
      .replace('$X', `$${bonusAmount.toFixed(2)}`)
      .replace('Y days', timeRemaining.formatted)
      .replace(/investment/gi, 'trade'); // Replace "investment" with "trade" (case-insensitive)

    // Add urgency prefix if not already in message
    if (urgency && !message.startsWith(urgency)) {
      message = `${urgency}\n${message}`;
    }

    return message;
  }

  /**
   * Check if enough time has passed since last reminder
   */
  static shouldSendReminder(lastReminderSent: Date | null, frequencyHours: number): boolean {
    if (!lastReminderSent) {
      return true; // No reminder sent yet
    }

    const now = new Date();
    const timeSinceLastReminder = now.getTime() - lastReminderSent.getTime();
    const frequencyMs = frequencyHours * 60 * 60 * 1000;

    return timeSinceLastReminder >= frequencyMs;
  }

  /**
   * Send bonus reminders to all eligible users
   * Returns number of reminders sent
   */
  static async sendBonusReminders(bot: any): Promise<number> {
    let remindersSent = 0;

    try {
      // Get reminder settings
      const settings = await this.getReminderSettings();

      if (!settings.enabled) {
        logger.info('[BONUS REMINDER] Reminders disabled, skipping');
        return 0;
      }

      // Get escalation settings
      const escalationSettings = await this.getEscalationSettings();

      const now = new Date();

      // Find all users with active bonuses who haven't completed first trade
      const eligibleUsers = await (prisma as any).user.findMany({
        where: {
          // Bonus exists and is not applied/expired
          registrationBonusStatus: {
            in: ['PENDING', 'LOCKED', 'UNLOCKED'],
          },
          // Haven't completed first trade yet
          hasCompletedFirstTrade: false,
          // Bonus hasn't expired
          registrationBonusExpiryDate: {
            gt: now,
          },
          // Not deleted or suspended
          status: 'ACTIVE',
        },
        select: {
          id: true,
          telegramId: true,
          registrationBonusAmount: true,
          registrationBonusExpiryDate: true,
          lastBonusReminderSentAt: true,
        },
      });

      logger.info(`[BONUS REMINDER] Found ${eligibleUsers.length} eligible users for reminders`);

      for (const user of eligibleUsers) {
        try {
          // Check if we should send reminder based on frequency
          if (!this.shouldSendReminder(user.lastBonusReminderSentAt, settings.frequencyHours)) {
            continue;
          }

          // Calculate time remaining
          const bonusAmount = (user as any).registrationBonusAmount || 0;
          const expiryDate = (user as any).registrationBonusExpiryDate;
          const timeRemaining = this.calculateDaysRemaining(expiryDate);

          // Don't send if bonus already expired (shouldn't happen, but safety)
          if (timeRemaining.totalMinutes <= 0) {
            continue;
          }

          // Get escalated message
          const message = this.getEscalatedMessage(timeRemaining, bonusAmount, settings.message, escalationSettings);

          // Send message
          await bot.api.sendMessage(Number((user as any).telegramId), message, {
            parse_mode: 'HTML',
          });

          // Update last reminder sent timestamp
          await (prisma as any).user.update({
            where: { id: user.id },
            data: { lastBonusReminderSentAt: now },
          });

          remindersSent++;
          logger.info(
            `[BONUS REMINDER] Sent reminder to user ${user.id} (${timeRemaining.formatted} left)`
          );
        } catch (userError) {
          logger.error(`[BONUS REMINDER] Failed to send reminder to user ${user.id}:`, userError);
        }
      }

      logger.info(`[BONUS REMINDER] Sent ${remindersSent} reminders total`);
      return remindersSent;
    } catch (error) {
      logger.error('[BONUS REMINDER] Error sending bonus reminders:', error);
      return remindersSent;
    }
  }

  /**
   * Update reminder settings
   */
  static async updateReminderSettings(
    enabled?: boolean,
    frequencyHours?: number,
    message?: string
  ): Promise<void> {
    try {
      if (enabled !== undefined) {
        await (prisma as any).settings.upsert({
          where: { key: 'BONUS_REMINDER_ENABLED' },
          update: { value: enabled.toString() },
          create: { key: 'BONUS_REMINDER_ENABLED', value: enabled.toString() },
        });
      }

      if (frequencyHours !== undefined) {
        await (prisma as any).settings.upsert({
          where: { key: 'BONUS_REMINDER_FREQUENCY_HOURS' },
          update: { value: frequencyHours.toString() },
          create: { key: 'BONUS_REMINDER_FREQUENCY_HOURS', value: frequencyHours.toString() },
        });
      }

      if (message !== undefined) {
        await (prisma as any).settings.upsert({
          where: { key: 'BONUS_REMINDER_MESSAGE' },
          update: { value: message },
          create: { key: 'BONUS_REMINDER_MESSAGE', value: message },
        });
      }

      logger.info('[BONUS REMINDER] Updated reminder settings');
    } catch (error) {
      logger.error('[BONUS REMINDER] Failed to update settings:', error);
      throw error;
    }
  }

  /**
   * Update escalation settings
   */
  static async updateEscalationSettings(
    urgentThresholdDays?: number,
    criticalThresholdHours?: number,
    regularPrefix?: string,
    urgentPrefix?: string,
    criticalPrefix?: string
  ): Promise<void> {
    try {
      if (urgentThresholdDays !== undefined) {
        await (prisma as any).settings.upsert({
          where: { key: 'BONUS_REMINDER_URGENT_THRESHOLD_DAYS' },
          update: { value: urgentThresholdDays.toString() },
          create: { key: 'BONUS_REMINDER_URGENT_THRESHOLD_DAYS', value: urgentThresholdDays.toString() },
        });
      }

      if (criticalThresholdHours !== undefined) {
        await (prisma as any).settings.upsert({
          where: { key: 'BONUS_REMINDER_CRITICAL_THRESHOLD_HOURS' },
          update: { value: criticalThresholdHours.toString() },
          create: { key: 'BONUS_REMINDER_CRITICAL_THRESHOLD_HOURS', value: criticalThresholdHours.toString() },
        });
      }

      if (regularPrefix !== undefined) {
        await (prisma as any).settings.upsert({
          where: { key: 'BONUS_REMINDER_REGULAR_PREFIX' },
          update: { value: regularPrefix },
          create: { key: 'BONUS_REMINDER_REGULAR_PREFIX', value: regularPrefix },
        });
      }

      if (urgentPrefix !== undefined) {
        await (prisma as any).settings.upsert({
          where: { key: 'BONUS_REMINDER_URGENT_PREFIX' },
          update: { value: urgentPrefix },
          create: { key: 'BONUS_REMINDER_URGENT_PREFIX', value: urgentPrefix },
        });
      }

      if (criticalPrefix !== undefined) {
        await (prisma as any).settings.upsert({
          where: { key: 'BONUS_REMINDER_CRITICAL_PREFIX' },
          update: { value: criticalPrefix },
          create: { key: 'BONUS_REMINDER_CRITICAL_PREFIX', value: criticalPrefix },
        });
      }

      logger.info('[BONUS REMINDER] Updated escalation settings');
    } catch (error) {
      logger.error('[BONUS REMINDER] Failed to update escalation settings:', error);
      throw error;
    }
  }
}
