import prisma from "../db/client.js";
import { generateReferralCode } from "../lib/helpers.js";
import logger from "../config/logger.js";
import crypto from "crypto";
import { config } from "../config/env.js";

export class UserService {
  /**
   * Get or create user
   */
  static async getOrCreateUser(telegramUser: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  }) {
    const telegramId = BigInt(telegramUser.id);

    let user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId,
          username: telegramUser.username,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          referralCode: generateReferralCode(telegramId),
        },
      });

      logger.info(`User created: ${telegramId}`);
    }

    return user;
  }

  /**
   * Generate email verification token
   */
  static generateVerificationToken(): { token: string; expiry: Date } {
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(
      Date.now() + config.EMAIL_VERIFICATION_TOKEN_EXPIRY_MINUTES * 60 * 1000
    );
    return { token, expiry };
  }

  /**
   * Update user profile with email
   */
  static async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      email?: string;
      bankDetails?: string;
    }
  ) {
    return await prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  /**
   * Set email verification token
   */
  static async setEmailVerificationToken(userId: string, emailToVerify?: string) {
    const { token, expiry } = this.generateVerificationToken();
    
    // If no email provided, get current email
    let email = emailToVerify;
    if (!email) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      email = user?.email || "";
    }
    
    // Format: email:{token}:{base64-encoded-email}
    const encodedEmail = Buffer.from(email || "").toString("base64");
    const storageValue = `email:${token}:${encodedEmail}`;
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: storageValue,
        emailVerificationTokenExpiry: expiry,
      },
    });

    return token;
  }

  /**
   * Verify email token
   */
  static async verifyEmailToken(token: string) {
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: {
          startsWith: "email:",
        },
        emailVerificationTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user || !user.emailVerificationToken) {
      return null;
    }

    // Parse the stored value: email:{token}:{base64-encoded-email}
    const parts = user.emailVerificationToken.split(":");
    if (parts.length < 3 || parts[0] !== "email") {
      return null;
    }

    const storedToken = parts[1];
    if (storedToken !== token) {
      return null;
    }

    // Decode the email and update it
    const verifiedEmail = Buffer.from(parts.slice(2).join(":"), "base64").toString("utf-8");

    // Mark email as verified and clear token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: verifiedEmail,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,
      },
    });

    return user;
  }

  /**
   * Set bank details verification token (stored in emailVerificationToken field temporarily)
   */
  static async setBankDetailsVerificationToken(userId: string, pendingBankDetails: string) {
    // Store the token and the pending bank details in the verification token field temporarily
    // Format: bankDetails:{token}:{base64-encoded-details}
    const token = crypto.randomBytes(32).toString("hex");
    const encodedDetails = Buffer.from(pendingBankDetails).toString("base64");
    const storageValue = `bankDetails:${token}:${encodedDetails}`;

    const expiry = new Date(
      Date.now() + config.EMAIL_VERIFICATION_TOKEN_EXPIRY_MINUTES * 60 * 1000
    );

    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: storageValue,
        emailVerificationTokenExpiry: expiry,
      },
    });

    return token;
  }

  /**
   * Verify bank details token and update bank details
   */
  static async verifyBankDetailsToken(token: string) {
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: {
          startsWith: "bankDetails:",
        },
        emailVerificationTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user || !user.emailVerificationToken) {
      return null;
    }

    // Parse the stored value: bankDetails:{token}:{base64-encoded-details}
    const parts = user.emailVerificationToken.split(":");
    if (parts.length < 3 || parts[0] !== "bankDetails") {
      return null;
    }

    const storedToken = parts[1];
    if (storedToken !== token) {
      return null;
    }

    // Decode the bank details
    const bankDetails = Buffer.from(parts.slice(2).join(":"), "base64").toString("utf-8");

    // Update bank details and clear token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        bankDetails,
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,
      },
    });

    return user;
  }

  /**
   * Set withdrawal verification token
   */
  static async setWithdrawalVerificationToken(userId: string, withdrawalData: any) {
    const token = crypto.randomBytes(32).toString("hex");
    const encodedData = Buffer.from(JSON.stringify(withdrawalData)).toString("base64");
    const storageValue = `withdrawal:${token}:${encodedData}`;

    const expiry = new Date(
      Date.now() + config.EMAIL_VERIFICATION_TOKEN_EXPIRY_MINUTES * 60 * 1000
    );

    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: storageValue,
        emailVerificationTokenExpiry: expiry,
      },
    });

    return token;
  }

  /**
   * Verify withdrawal token and create withdrawal request on admin side
   */
  static async verifyWithdrawalToken(token: string) {
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: {
          startsWith: "withdrawal:",
        },
        emailVerificationTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return null;
    }

    const parts = user.emailVerificationToken!.split(":");
    if (parts[0] !== "withdrawal" || parts[1] !== token) {
      return null;
    }

    // Decode the withdrawal data
    const withdrawalData = JSON.parse(
      Buffer.from(parts.slice(2).join(":"), "base64").toString("utf-8")
    );

    // Clear token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,
      },
    });

    return { user, withdrawalData };
  }

  /**
   * Check if email already exists
   */
  static async emailExists(email: string) {
    const user = await prisma.user.findFirst({
      where: { email },
    });
    return !!user;
  }

  /**
   * Get user by telegram ID
   */
  static async getUserByTelegramId(telegramId: bigint) {
    return await prisma.user.findUnique({
      where: { telegramId },
    });
  }

  /**
   * Get user by ID
   */
  static async getUserById(id: string) {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        investments: true,
        reviews: true,
      },
    });
  }

  /**
   * Update user
   */
  static async updateUser(
    id: string,
    data: {
      username?: string;
      email?: string;
      phoneNumber?: string;
      bankDetails?: string;
      status?: "ACTIVE" | "SUSPENDED" | "DELETED";
    }
  ) {
    return await prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * Get user profile
   */
  static async getUserProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        investments: true,
        reviews: true,
        _count: {
          select: {
            investments: true,
            reviews: true,
          },
        },
      },
    });

    if (!user) return null;

    return {
      ...user,
      stats: {
        totalInvestments: user._count.investments,
        totalReviews: user._count.reviews,
        totalInvested: user.totalInvested,
        totalEarned: user.totalEarned,
        totalWithdrawn: user.totalWithdrawn,
      },
    };
  }

  /**
   * Get all active users
   */
  static async getActiveUsers(limit = 100, offset = 0) {
    return await prisma.user.findMany({
      where: { status: "ACTIVE" },
      skip: offset,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Count active users
   */
  static async countActiveUsers() {
    return await prisma.user.count({
      where: { status: "ACTIVE" },
    });
  }

  /**
   * Suspend user
   */
  static async suspendUser(userId: string, reason?: string) {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        status: "SUSPENDED",
      },
    });
  }

  /**
   * Activate user
   */
  static async activateUser(userId: string) {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        status: "ACTIVE",
      },
    });
  }

  /**
   * Delete user (soft delete)
   */
  static async deleteUser(userId: string) {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        status: "DELETED",
      },
    });
  }

  /**
   * Get user investments
   */
  static async getUserInvestments(
    userId: string,
    status?: string,
    limit = 10,
    offset = 0
  ) {
    const where: any = { userId };
    if (status) where.status = status;

    return await prisma.investment.findMany({
      where,
      include: { package: true },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    });
  }

  /**
   * Count user investments
   */
  static async countUserInvestments(userId: string, status?: string) {
    const where: any = { userId };
    if (status) where.status = status;

    return await prisma.investment.count({ where });
  }

  /**
   * Update user stats
   */
  static async updateUserStats(userId: string) {
    const investments: any[] = await prisma.investment.findMany({
      where: { userId },
    });

    // Only count ACTIVE, MATURED, COMPLETED investments towards totalInvested
    const totalInvested: number = investments
      .filter(inv => ["ACTIVE", "MATURED", "COMPLETED"].includes(inv.status))
      .reduce((sum: number, inv: any): number => sum + inv.amount, 0);

    // totalEarned = sum of all accrued profit from active/completed investments
    const totalEarned: number = investments
      .filter(inv => ["ACTIVE", "MATURED", "COMPLETED"].includes(inv.status))
      .reduce((sum: number, inv: any): number => sum + (inv.totalAccruedProfit || 0), 0);

    // totalWithdrawn = sum of all withdrawn amounts from all investments
    const totalWithdrawn: number = investments
      .reduce((sum: number, inv: any): number => sum + (inv.totalWithdrawn || 0), 0);

    return await prisma.user.update({
      where: { id: userId },
      data: {
        totalInvested,
        totalEarned,
        totalWithdrawn,
        lastActiveAt: new Date(),
      },
    });
  }

  /**
   * Get users by referral code
   */
  static async getUsersByReferrer(referralCode: string) {
    return await prisma.user.findMany({
      where: { referredBy: referralCode },
    });
  }

  /**
   * Update user admin status
   */
  static async updateAdmin(userId: string, isAdmin: boolean) {
    return await prisma.user.update({
      where: { id: userId },
      data: { isAdmin },
    });
  }
}

export default UserService;
