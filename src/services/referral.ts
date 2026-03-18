import prisma from "../db/client.js";
import { config } from "../config/env.js";
import logger from "../config/logger.js";

class ReferralService {
  /**
   * Get referral bonus percentage (from config or settings)
   */
  static async getBonusPercentage(): Promise<number> {
    try {
      // First check if there's a setting in DB
      const setting = await prisma.settings.findUnique({
        where: { key: "REFERRAL_BONUS_PERCENTAGE" },
      });

      if (setting && setting.value) {
        return parseFloat(setting.value);
      }

      // Fall back to env variable
      return config.REFERRAL_BONUS_PERCENTAGE;
    } catch (error) {
      logger.error("Error getting bonus percentage:", error);
      return config.REFERRAL_BONUS_PERCENTAGE;
    }
  }

  /**
   * Calculate referral bonus for an investment
   */
  static calculateBonus(investmentAmount: number, bonusPercentage: number): number {
    return (investmentAmount * bonusPercentage) / 100;
  }

  /**
   * Credit referral bonus when investment is confirmed/approved
   */
  static async creditReferralBonus(
    investmentId: string,
    investmentAmount: number,
    referredUserId: string
  ): Promise<void> {
    try {
      // Skip if referral bonus is disabled
      if (!config.ENABLE_REFERRAL_BONUS) {
        logger.info(`[REFERRAL] Bonus disabled, skipping for investment ${investmentId}`);
        return;
      }

      logger.info(`[REFERRAL] 🎁 Starting bonus credit for investment ${investmentId}`);
      logger.info(`[REFERRAL]   Amount: $${investmentAmount}, User: ${referredUserId}`);

      // Get referred user's referrer
      const referredUser = await prisma.user.findUnique({
        where: { id: referredUserId },
        select: { 
          referredBy: true, 
          id: true, 
          firstName: true, 
          lastName: true,
          email: true 
        },
      });

      if (!referredUser) {
        logger.error(`[REFERRAL] ❌ User not found: ${referredUserId}`);
        return;
      }

      // CRITICAL CHECK - if referredBy is NULL, bonus cannot be credited
      if (!referredUser.referredBy) {
        logger.warn(`[REFERRAL-CRITICAL] ❌ User ${referredUserId} (${referredUser.firstName} ${referredUser.lastName}) has NO referrer!`);
        logger.warn(`[REFERRAL-CRITICAL]    referredBy = NULL - User was NOT registered with a referral code`);
        logger.warn(`[REFERRAL-CRITICAL]    Expected bonus: $${(investmentAmount * (await this.getBonusPercentage())) / 100}`);
        logger.warn(`[REFERRAL-CRITICAL]    Action: Investment ${investmentId} will NOT get referral bonus`);
        
        // Create a failed bonus record for admin visibility
        try {
          await prisma.referralBonus.create({
            data: {
              referrerId: "SYSTEM_FAILED",
              investmentId,
              referredUserId: referredUserId,
              bonusAmount: 0,
              bonusPercentage: await this.getBonusPercentage(),
              investmentAmount,
              status: "FAILED",
            },
          });
          logger.info(`[REFERRAL] Created FAILED bonus record for tracking`);
        } catch (createFailedError) {
          logger.error(`[REFERRAL] Could not create failed bonus record:`, createFailedError);
        }
        
        return;
      }

      logger.info(`[REFERRAL] ✅ User has referrer code: ${referredUser.referredBy}`);

      // Get referrer user by referral code
      const referrer = await prisma.user.findUnique({
        where: { referralCode: referredUser.referredBy },
        select: { id: true, status: true, firstName: true, lastName: true, email: true },
      });

      if (!referrer) {
        logger.error(`[REFERRAL] ❌ Referrer not found for code: ${referredUser.referredBy}`);
        return;
      }

      if (referrer.status !== "ACTIVE") {
        logger.warn(`[REFERRAL] ❌ Referrer ${referrer.id} (${referrer.firstName} ${referrer.lastName}) is not ACTIVE`);
        logger.warn(`[REFERRAL]    Status: ${referrer.status} - Bonus cannot be credited`);
        return;
      }

      // Skip if referrer is the same as referred user
      if (referrer.id === referredUserId) {
        logger.warn(`[REFERRAL] ❌ Referrer cannot be the same as referred user`);
        return;
      }

      // Get bonus percentage and calculate
      const bonusPercentage = await this.getBonusPercentage();
      const bonusAmount = this.calculateBonus(investmentAmount, bonusPercentage);

      logger.info(`[REFERRAL] 💰 Calculated bonus: ${bonusPercentage}% × $${investmentAmount} = $${bonusAmount}`);
      logger.info(`[REFERRAL]    Referrer: ${referrer.firstName} ${referrer.lastName} (${referrer.email})`);

      // Create referral bonus record
      const referralBonus = await prisma.referralBonus.create({
        data: {
          referrerId: referrer.id,
          investmentId,
          referredUserId: referredUserId,
          bonusAmount,
          bonusPercentage,
          investmentAmount,
          status: "CREDITED",
        },
      });

      logger.info(`[REFERRAL] ✅ ReferralBonus record created: ${referralBonus.id}`);

      // Update referrer's referral earnings (NOT incrementing referralCount here - it's done in registration)
      const updatedReferrer = await prisma.user.update({
        where: { id: referrer.id },
        data: {
          referralEarnings: {
            increment: bonusAmount,
          },
          totalEarned: {
            increment: bonusAmount,
          },
        },
        select: { 
          referralCount: true,
          referralEarnings: true, 
          totalEarned: true,
          firstName: true,
          lastName: true 
        }
      });

      logger.info(`[REFERRAL] ✅ 🎉 BONUS CREDITED SUCCESSFULLY!`);
      logger.info(`[REFERRAL]    Investment: ${investmentId}`);
      logger.info(`[REFERRAL]    Bonus Amount: $${bonusAmount}`);
      logger.info(`[REFERRAL]    Referrer: ${updatedReferrer.firstName} ${updatedReferrer.lastName}`);
      logger.info(`[REFERRAL]    Referral Count: ${updatedReferrer.referralCount} (set at registration)`);
      logger.info(`[REFERRAL]    New Referral Earnings: $${updatedReferrer.referralEarnings}`);
      logger.info(`[REFERRAL]    Total Earned: $${updatedReferrer.totalEarned}`);
    } catch (error) {
      logger.error(`[REFERRAL] ❌ Error crediting referral bonus for ${investmentId}:`, error);
      throw error;
    }
  }

  /**
   * Get referral stats for a user
   */
  static async getUserReferralStats(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          referralCode: true,
          referralCount: true,
          referralEarnings: true,
          referralBonuses: {
            where: { status: "CREDITED" },  // Only count credited bonuses
            select: {
              bonusAmount: true,
              status: true,
              createdAt: true,
              investment: {
                select: {
                  amount: true,
                  status: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      return {
        referralCode: user?.referralCode,
        referralCount: user?.referralCount || 0,
        referralEarnings: user?.referralEarnings || 0,
        bonusesList: user?.referralBonuses || [],
      };
    } catch (error) {
      logger.error("Error getting user referral stats:", error);
      throw error;
    }
  }

  /**
   * Get users referred by a referral code
   */
  static async getUsersReferredByCode(referralCode: string) {
    try {
      const referredUsers = await prisma.user.findMany({
        where: { referredBy: referralCode },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          createdAt: true,
          totalInvested: true,
          investments: {
            where: { status: { in: ["ACTIVE", "COMPLETED", "MATURED"] } },
            select: {
              amount: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return referredUsers;
    } catch (error) {
      logger.error("Error getting referred users:", error);
      throw error;
    }
  }

  /**
   * Get referral analytics (admin)
   */
  static async getReferralAnalytics() {
    try {
      const totalBonuses = await prisma.referralBonus.aggregate({
        _sum: { bonusAmount: true },
        _count: true,
      });

      const topReferrers = await prisma.user.findMany({
        where: {
          referralBonuses: {
            some: {},
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          referralCount: true,
          referralEarnings: true,
          referralBonuses: {
            select: { bonusAmount: true },
          },
        },
        orderBy: {
          referralEarnings: "desc",
        },
        take: 10,
      });

      return {
        totalBonusesDistributed: totalBonuses._sum.bonusAmount || 0,
        totalBonusRecords: totalBonuses._count,
        topReferrers: topReferrers.map((ref) => ({
          userId: ref.id,
          name: `${ref.firstName || ""} ${ref.lastName || ""}`.trim(),
          username: ref.username,
          referralCount: ref.referralCount,
          totalEarnings: ref.referralEarnings,
          bonusCount: ref.referralBonuses.length,
        })),
      };
    } catch (error) {
      logger.error("Error getting referral analytics:", error);
      throw error;
    }
  }

  /**
   * Update referral bonus percentage (admin)
   */
  static async updateBonusPercentage(newPercentage: number, updatedBy: string): Promise<void> {
    try {
      await prisma.settings.upsert({
        where: { key: "REFERRAL_BONUS_PERCENTAGE" },
        update: {
          value: newPercentage.toString(),
          updatedBy,
          updatedAt: new Date(),
        },
        create: {
          key: "REFERRAL_BONUS_PERCENTAGE",
          value: newPercentage.toString(),
          type: "number",
          description: "Percentage of investment amount given as referral bonus",
          updatedBy,
        },
      });

      logger.info(`Referral bonus percentage updated to ${newPercentage}% by admin ${updatedBy}`);
    } catch (error) {
      logger.error("Error updating bonus percentage:", error);
      throw error;
    }
  }

  /**
   * Get minimum referral withdrawal threshold (from config or settings)
   */
  static async getMinimumReferralThreshold(): Promise<number> {
    try {
      // First check if there's a setting in DB
      const setting = await prisma.settings.findUnique({
        where: { key: "MINIMUM_REFERRAL_WITHDRAWAL_AMOUNT" },
      });

      if (setting && setting.value) {
        return parseFloat(setting.value);
      }

      // Fall back to env variable
      return config.MINIMUM_REFERRAL_PAYOUT || 100;
    } catch (error) {
      logger.error("Error getting minimum referral threshold:", error);
      return config.MINIMUM_REFERRAL_PAYOUT || 100;
    }
  }

  /**
   * Update minimum referral withdrawal threshold (admin)
   */
  static async updateMinimumReferralThreshold(newThreshold: number, updatedBy: string): Promise<void> {
    try {
      await prisma.settings.upsert({
        where: { key: "MINIMUM_REFERRAL_WITHDRAWAL_AMOUNT" },
        update: {
          value: newThreshold.toString(),
          updatedBy,
          updatedAt: new Date(),
        },
        create: {
          key: "MINIMUM_REFERRAL_WITHDRAWAL_AMOUNT",
          value: newThreshold.toString(),
          type: "number",
          description: "Minimum referral bonus amount required to initiate withdrawal (in dollars)",
          updatedBy,
        },
      });

      logger.info(`Minimum referral withdrawal threshold updated to $${newThreshold} by admin ${updatedBy}`);
    } catch (error) {
      logger.error("Error updating minimum referral threshold:", error);
      throw error;
    }
  }

  /**
   * Validate referral code format and existence
   */
  static async validateReferralCode(referralCode: string, excludeUserId?: string): Promise<{ valid: boolean; message: string }> {
    try {
      if (!referralCode || referralCode.trim().length === 0) {
        return { valid: false, message: "Referral code is empty" };
      }

      const referrer = await prisma.user.findUnique({
        where: { referralCode: referralCode },
        select: { id: true, status: true },
      });

      if (!referrer) {
        return { valid: false, message: "Referral code not found" };
      }

      if (referrer.status !== "ACTIVE") {
        return { valid: false, message: "Referrer account is not active" };
      }

      if (excludeUserId && referrer.id === excludeUserId) {
        return { valid: false, message: "You cannot use your own referral code" };
      }

      return { valid: true, message: "Valid referral code" };
    } catch (error) {
      logger.error("Error validating referral code:", error);
      return { valid: false, message: "Error validating referral code" };
    }
  }
}

export default ReferralService;
