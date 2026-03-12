import prisma from "../db/client.js";
import { calculateMaturityDate, isMatured } from "../lib/helpers.js";
import logger from "../config/logger.js";
import UserService from "./user.js";
import { config } from "../config/env.js";
import { randomBytes } from "crypto";

export class InvestmentService {
  /**
   * Create investment
   */
  static async createInvestment(
    userId: string,
    packageId: string,
    amount: number
  ) {
    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
    });

    if (!pkg) {
      throw new Error("Package not found");
    }

    if (amount < pkg.minAmount || amount > pkg.maxAmount) {
      throw new Error(
        `Amount must be between ${pkg.minAmount} and ${pkg.maxAmount}`
      );
    }

    const expectedReturn = amount + (amount * pkg.roiPercentage) / 100;
    const totalProfit = expectedReturn - amount;
    const maturityDate = calculateMaturityDate(pkg.duration);

    const investment = await prisma.investment.create({
      data: {
        userId,
        packageId,
        amount,
        roiPercentage: pkg.roiPercentage,
        expectedReturn,
        totalProfit,
        maturityDate,
        status: "PENDING",
      },
      include: { package: true, user: true },
    });

    logger.info(`Investment created: ${investment.id}`);

    return investment;
  }

  /**
   * Get investment by ID
   */
  static async getInvestmentById(id: string) {
    return await prisma.investment.findUnique({
      where: { id },
      include: { package: true, user: true },
    });
  }

  /**
   * Check if investment exists via raw query (for debugging)
   */
  static async investmentExistsRaw(id: string) {
    const result = await prisma.$queryRaw`
      SELECT id, userId, status, "availableWithdrawable" 
      FROM "Investment" 
      WHERE id = ${id}
      LIMIT 1
    ` as any[];
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get investments by user
   */
  static async getInvestmentsByUser(userId: string, status?: string) {
    const where: any = { userId };
    if (status) where.status = status;

    return await prisma.investment.findMany({
      where,
      include: { package: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Approve investment
   */
  static async approveInvestment(investmentId: string, proof: string) {
    // Get investment and its package to recalculate maturity date
    const investmentData = await prisma.investment.findUnique({
      where: { id: investmentId },
      include: { package: true },
    });

    if (!investmentData) {
      throw new Error("Investment not found");
    }

    // Set activation time to now and recalculate maturity date based on actual activation time
    const activationTime = new Date();
    const newMaturityDate = calculateMaturityDate(investmentData.package.duration, activationTime);

    const investment = await prisma.investment.update({
      where: { id: investmentId },
      data: {
        status: "ACTIVE",
        approvalProof: proof,
        activatedAt: activationTime,
        maturityDate: newMaturityDate,
        updatedAt: new Date(),
      },
      include: { package: true, user: true },
    });

    // Update package stats
    await prisma.package.update({
      where: { id: investment.packageId },
      data: {
        totalInvestments: { increment: 1 },
        totalAmountInvested: { increment: investment.amount },
      },
    });

    // Update user stats
    await UserService.updateUserStats(investment.userId);

    logger.info(`Investment approved: ${investmentId}, Activated at: ${activationTime}, Matures at: ${newMaturityDate}`);

    return investment;
  }

  /**
   * Reject investment
   */
  static async rejectInvestment(investmentId: string, reason: string) {
    const investment = await prisma.investment.update({
      where: { id: investmentId },
      data: {
        status: "REJECTED",
        notes: reason,
        updatedAt: new Date(),
      },
      include: { package: true, user: true },
    });

    logger.info(`Investment rejected: ${investmentId}`);

    return investment;
  }

  /**
   * Mark investment as matured
   */
  static async markMatured(investmentId: string) {
    // First get the investment to calculate total available
    const investment = await prisma.investment.findUnique({
      where: { id: investmentId },
    });

    if (!investment) {
      throw new Error("Investment not found");
    }

    // On maturity, make full amount (principal + all accrued profit) available for withdrawal
    const totalAvailable = investment.amount + investment.totalAccruedProfit;

    const updated = await prisma.investment.update({
      where: { id: investmentId },
      data: {
        status: "MATURED",
        availableWithdrawable: totalAvailable,
        updatedAt: new Date(),
      },
      include: { package: true, user: true },
    });

    logger.info(`Investment marked as matured: ${investmentId}, Total available: ${totalAvailable}`);

    return updated;
  }

  /**
   * Complete investment (payout done)
   */
  static async completeInvestment(investmentId: string, proof?: string) {
    const investment = await prisma.investment.update({
      where: { id: investmentId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        completionProof: proof,
        updatedAt: new Date(),
      },
      include: { package: true, user: true },
    });

    // Update user stats
    await UserService.updateUserStats(investment.userId);

    logger.info(`Investment completed: ${investmentId}`);

    return investment;
  }

  /**
   * Check and mature investments
   */
  static async checkAndMatureInvestments() {
    const investments = await prisma.investment.findMany({
      where: {
        status: "ACTIVE",
        maturityDate: { lte: new Date() },
      },
    });

    for (const investment of investments) {
      await this.markMatured(investment.id);
    }

    logger.info(`Matured ${investments.length} investments`);

    return investments;
  }

  /**
   * Get pending investments
   */
  static async getPendingInvestments(limit = 100, offset = 0) {
    return await prisma.investment.findMany({
      where: { status: "PENDING" },
      include: { package: true, user: true },
      orderBy: { createdAt: "asc" },
      skip: offset,
      take: limit,
    });
  }

  /**
   * Count pending investments
   */
  static async countPendingInvestments() {
    return await prisma.investment.count({
      where: { status: "PENDING" },
    });
  }

  /**
   * Get investment stats
   */
  static async getInvestmentStats() {
    const investments = await prisma.investment.findMany();

    const totalAmount = investments.reduce((sum: number, inv: any) => sum + inv.amount, 0);
    const totalExpectedReturn = investments.reduce(
      (sum: number, inv: any) => sum + inv.expectedReturn,
      0
    );
    const totalEarned = totalExpectedReturn - totalAmount;

    const statusCounts = investments.reduce(
      (acc: Record<string, number>, inv: any) => {
        acc[inv.status] = (acc[inv.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalInvestments: investments.length,
      totalAmount,
      totalExpectedReturn,
      totalEarned,
      averageAmount: investments.length > 0 ? totalAmount / investments.length : 0,
      statusCounts,
    };
  }

  /**
   * Request payout
   */
  static async requestPayout(investmentId: string) {
    const investment = await prisma.investment.update({
      where: { id: investmentId },
      data: {
        status: "PAYOUT_REQUESTED",
        updatedAt: new Date(),
      },
      include: { package: true, user: true },
    });

    logger.info(`Payout requested: ${investmentId}`);

    return investment;
  }

  /**
   * Calculate daily accrual for an investment
   */
  static calculateDailyAccrual(investment: any) {
    if (!investment.maturityDate || investment.status !== "ACTIVE") {
      return {
        dailyAccrual: 0,
        daysRemaining: 0,
      };
    }

    // Calculate total profit
    const totalProfit = investment.expectedReturn - investment.amount;
    
    // Calculate days from activation to maturity (use activatedAt if available, otherwise createdAt)
    const startDate = investment.activatedAt ? new Date(investment.activatedAt) : new Date(investment.createdAt);
    const maturityDate = new Date(investment.maturityDate);
    const totalDays = Math.ceil(
      (maturityDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate daily accrual amount (profit distributed daily)
    const dailyProfit = totalProfit / Math.max(totalDays, 1);

    // Calculate days remaining
    const now = new Date();
    const daysRemaining = Math.ceil(
      (maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      dailyAccrual: dailyProfit,
      daysRemaining: Math.max(0, daysRemaining),
      totalProfit,
      totalDays,
    };
  }

  /**
   * Calculate real-time investment value (including live profit accrual)
   */
  static calculateRealTimeValue(investment: any) {
    if (!investment.maturityDate || investment.status !== "ACTIVE") {
      return {
        currentValue: investment.amount + investment.totalAccruedProfit,
        profitAccumulatedToday: 0,
        hourlyRate: 0,
        secondlyRate: 0,
        dailyRate: 0,
        daysRemaining: 0,
        daysElapsed: 0,
        percentComplete: 0,
        totalDays: 0,
      };
    }

    // Calculate total profit
    const totalProfit = investment.expectedReturn - investment.amount;
    
    // Calculate total days from activation to maturity (use activatedAt if available, otherwise createdAt)
    const startDate = investment.activatedAt ? new Date(investment.activatedAt) : new Date(investment.createdAt);
    const maturityDate = new Date(investment.maturityDate);
    const totalDays = Math.ceil(
      (maturityDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Daily rate
    const dailyRate = totalProfit / Math.max(totalDays, 1);

    // Calculate time elapsed since investment was activated (or created if not yet activated)
    const now = new Date();
    const msElapsed = now.getTime() - startDate.getTime();
    const daysElapsed = msElapsed / (1000 * 60 * 60 * 24);
    const hoursElapsed = msElapsed / (1000 * 60 * 60);
    const secondsElapsed = msElapsed / 1000;

    // Calculate profit accumulated since investment started
    const profitAccumulatedSinceStart = dailyRate * daysElapsed;

    // Combined current value
    const currentValue = investment.amount + investment.totalAccruedProfit + profitAccumulatedSinceStart;

    // Time remaining
    const msRemaining = maturityDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

    // Rates per time unit
    const hourlyRate = dailyRate / 24;
    const secondlyRate = dailyRate / (24 * 3600);

    // Profit accumulated today (since last midnight)
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const secSinceTodayStart = (now.getTime() - todayStart.getTime()) / 1000;
    const profitAccumulatedToday = secondlyRate * secSinceTodayStart;

    // Percent complete
    const percentComplete = (daysElapsed / totalDays) * 100;

    return {
      currentValue: Math.max(investment.amount, currentValue),
      profitAccumulatedToday,
      hourlyRate,
      secondlyRate,
      dailyRate,
      daysRemaining,
      daysElapsed: Math.floor(daysElapsed),
      percentComplete: Math.min(100, percentComplete),
      totalDays,
    };
  }

  /**
   * Get investment with daily tracking info
   */
  static async getInvestmentWithTracking(investmentId: string) {
    const investment = await this.getInvestmentById(investmentId);
    if (!investment) return null;

    const dailyInfo = this.calculateDailyAccrual(investment);
    const reinvestPercentage = config.DAILY_PROFIT_REINVEST_PERCENTAGE / 100;
    const withdrawPercentage = config.DAILY_PROFIT_WITHDRAWABLE_PERCENTAGE / 100;

    return {
      ...investment,
      currentValue: investment.amount + investment.totalAccruedProfit,
      dailyProfit: dailyInfo.dailyAccrual,
      dailyReinvest: dailyInfo.dailyAccrual * reinvestPercentage,
      dailyWithdrawable: dailyInfo.dailyAccrual * withdrawPercentage,
      daysRemaining: dailyInfo.daysRemaining,
      totalProfit: dailyInfo.totalProfit,
    };
  }

  /**
   * Apply daily accrual to all active investments
   */
  static async applyDailyAccrual() {
    const activeInvestments = await prisma.investment.findMany({
      where: {
        status: "ACTIVE",
        maturityDate: { gt: new Date() },
      },
    });

    let processedCount = 0;
    const reinvestPercentage = config.DAILY_PROFIT_REINVEST_PERCENTAGE / 100;
    const withdrawPercentage = config.DAILY_PROFIT_WITHDRAWABLE_PERCENTAGE / 100;
    const affectedUserIds = new Set<string>();

    for (const investment of activeInvestments) {
      try {
        const dailyInfo = this.calculateDailyAccrual(investment);
        if (dailyInfo.dailyAccrual <= 0) continue;

        // All daily profit is added to totalAccruedProfit (locked until maturity)
        // availableWithdrawable remains 0 until maturity date
        const totalAccrual = dailyInfo.dailyAccrual;

        // Update investment with new accrual
        await prisma.investment.update({
          where: { id: investment.id },
          data: {
            totalAccruedProfit: {
              increment: totalAccrual,
            },
            lastAccrualDate: new Date(),
          },
        });

        affectedUserIds.add(investment.userId);
        processedCount++;
      } catch (error) {
        logger.error(`Error applying daily accrual to investment ${investment.id}:`, error);
      }
    }

    // Update stats for all affected users
    for (const userId of affectedUserIds) {
      try {
        await UserService.updateUserStats(userId);
      } catch (error) {
        logger.error(`Error updating stats for user ${userId}:`, error);
      }
    }

    logger.info(`Applied daily accrual to ${processedCount} investments and updated ${affectedUserIds.size} users`);
    return processedCount;
  }

  /**
   * Withdraw from investment
   */
  static async withdrawFromInvestment(investmentId: string, amount: number) {
    const investment = await this.getInvestmentById(investmentId);
    if (!investment) {
      throw new Error("Investment not found");
    }

    if (amount > investment.availableWithdrawable) {
      throw new Error(
        `Insufficient withdrawable balance. Available: ${investment.availableWithdrawable}`
      );
    }

    const updated = await prisma.investment.update({
      where: { id: investmentId },
      data: {
        availableWithdrawable: {
          decrement: amount,
        },
        totalWithdrawn: {
          increment: amount,
        },
      },
      include: { package: true, user: true },
    });

    logger.info(`Withdrawal processed for investment ${investmentId}: ${amount}`);
    return updated;
  }

  /**
   * Create withdrawal request with email verification token
   */
  static async createWithdrawalRequest(investmentId: string, amount: number, userId: string, type: string = "INVESTMENT") {
    // For referral bonus withdrawals, skip investment validation
    if (type === "REFERRAL_BONUS") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { bankDetails: true, email: true, referralEarnings: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      if (!user.referralEarnings || user.referralEarnings < amount) {
        throw new Error("Insufficient referral earnings");
      }

      if (amount < config.MIN_WITHDRAWAL_AMOUNT || amount > config.MAX_WITHDRAWAL_AMOUNT) {
        throw new Error(
          `Invalid withdrawal amount. Must be between ${config.MIN_WITHDRAWAL_AMOUNT} and ${config.MAX_WITHDRAWAL_AMOUNT}`
        );
      }

      // Generate email verification token
      const { token, expiry } = UserService.generateVerificationToken();

      // Create withdrawal request for referral bonus
      const withdrawal = await prisma.withdrawalRequest.create({
        data: {
          investmentId: `REF_BONUS_${userId}_${Date.now()}`, // Unique ID for referral bonus
          userId,
          amount,
          status: "PENDING",
          emailVerified: false,
          emailVerificationToken: token,
          emailVerificationExpiry: expiry,
          bankDetails: user.bankDetails || "Not provided",
          notes: "Referral Bonus Withdrawal",
        },
      });

      logger.info(`✅ Referral bonus withdrawal request created: ${withdrawal.id} for user ${userId}`);
      return withdrawal;
    }

    // Original investment withdrawal logic
    const investment = await this.getInvestmentById(investmentId);
    if (!investment) {
      throw new Error("Investment not found");
    }

    if (investment.userId !== userId) {
      throw new Error("Unauthorized: Investment does not belong to this user");
    }

    if (amount > investment.availableWithdrawable) {
      throw new Error(
        `Insufficient withdrawable balance. Available: ${investment.availableWithdrawable}`
      );
    }

    if (amount < config.MIN_WITHDRAWAL_AMOUNT || amount > config.MAX_WITHDRAWAL_AMOUNT) {
      throw new Error(
        `Invalid withdrawal amount. Must be between ${config.MIN_WITHDRAWAL_AMOUNT} and ${config.MAX_WITHDRAWAL_AMOUNT}`
      );
    }

    // Check if user has any pending withdrawal across all investments
    const anyPendingWithdrawal = await prisma.withdrawalRequest.findFirst({
      where: {
        userId,
        status: { in: ["PENDING", "PROCESSING", "APPROVED"] },
      },
    });

    if (anyPendingWithdrawal) {
      throw new Error("You already have a pending withdrawal. Please wait for approval or rejection before initiating a new withdrawal.");
    }

    // Get user for bank details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { bankDetails: true, email: true },
    });

    // Check for existing withdrawal request
    const existingWithdrawal = await prisma.withdrawalRequest.findUnique({
      where: { investmentId },
    });

    // Handle existing withdrawal requests
    if (existingWithdrawal) {
      if (existingWithdrawal.status === "PENDING" && !existingWithdrawal.emailVerified) {
        // If unverified pending exists, delete it to allow retry with new token
        logger.info(`Deleting duplicate unverified withdrawal request ${existingWithdrawal.id} for investment ${investmentId}`);
        await prisma.withdrawalRequest.delete({
          where: { id: existingWithdrawal.id },
        });
      } else if (existingWithdrawal.status === "PENDING" && existingWithdrawal.emailVerified) {
        // If already email verified and pending admin approval, don't allow creating another
        throw new Error("A withdrawal request for this investment is already pending admin approval. Please wait for approval or rejection.");
      } else if (existingWithdrawal.status === "APPROVED") {
        // If approved but not yet completed, don't allow another
        throw new Error("A withdrawal request for this investment is currently being processed. Please wait for completion.");
      } else if (existingWithdrawal.status === "COMPLETED" || existingWithdrawal.status === "REJECTED" || existingWithdrawal.status === "REWORK") {
        // If already completed, rejected, or needs rework, delete it to allow a new withdrawal request
        // This enables users to withdraw again as more profits accrue
        logger.info(`Deleting completed/archived withdrawal request ${existingWithdrawal.id} for investment ${investmentId} to allow new withdrawal`);
        await prisma.withdrawalRequest.delete({
          where: { id: existingWithdrawal.id },
        });
      }
    }

    // Generate verification token
    const token = randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + config.WITHDRAWAL_VERIFICATION_TOKEN_EXPIRY_MINUTES * 60000);

    logger.info(`Generated withdrawal verification token: ${token.substring(0, 8)}... (expiry: ${expiry.toISOString()})`);

    // Create withdrawal request
    const withdrawalRequest = await prisma.withdrawalRequest.create({
      data: {
        investmentId,
        userId,
        amount,
        bankDetails: user?.bankDetails,
        status: "PENDING",
        emailVerificationToken: token,
        emailVerificationExpiry: expiry,
        emailVerified: false,
      },
      include: { user: true, investment: { include: { package: true } } },
    });

    logger.info(`Withdrawal request created: ${withdrawalRequest.id} for amount ${amount}, token stored: ${withdrawalRequest.emailVerificationToken ? "yes" : "NO"}`);
    return withdrawalRequest;
  }

  /**
   * Verify withdrawal email token
   */
  static async verifyWithdrawalToken(token: string) {
    if (!token) {
      throw new Error("Verification token is required");
    }

    const withdrawalRequest = await prisma.withdrawalRequest.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpiry: { gt: new Date() },
      },
      include: { user: true, investment: { include: { package: true } } },
    });

    if (!withdrawalRequest) {
      logger.warn(`Withdrawal token verification failed - token: ${token.substring(0, 8)}...`);
      throw new Error("Invalid or expired verification token");
    }

    // Mark as email verified
    const updated = await prisma.withdrawalRequest.update({
      where: { id: withdrawalRequest.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
      include: { user: true, investment: { include: { package: true } } },
    });

    logger.info(`Withdrawal email verified for request ${updated.id}`);
    return updated;
  }

  /**
   * Approve withdrawal request (admin action)
   */
  static async approveWithdrawalRequest(withdrawalId: string) {
    const withdrawalRequest = await prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
      include: { user: true, investment: true },
    });

    if (!withdrawalRequest) {
      throw new Error("Withdrawal request not found");
    }

    if (!withdrawalRequest.emailVerified) {
      throw new Error("Email not verified for this withdrawal");
    }

    // Update withdrawal request status
    const updated = await prisma.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
      },
      include: { user: true, investment: { include: { package: true } } },
    });

    logger.info(`Withdrawal request approved: ${withdrawalId}`);
    return updated;
  }

  /**
   * Complete withdrawal request (after payment made by admin)
   */
  static async completeWithdrawalRequest(withdrawalId: string) {
    const withdrawalRequest = await prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
      include: { user: true, investment: true },
    });

    if (!withdrawalRequest) {
      throw new Error("Withdrawal request not found");
    }

    if (withdrawalRequest.status !== "APPROVED") {
      throw new Error("Withdrawal must be approved before completion");
    }

    if (!withdrawalRequest.investmentId) {
      throw new Error("Withdrawal request is missing investment ID");
    }

    // Update investment totalWithdrawn and decrement availableWithdrawable
    await prisma.investment.update({
      where: { id: withdrawalRequest.investmentId },
      data: {
        totalWithdrawn: {
          increment: withdrawalRequest.amount,
        },
        availableWithdrawable: {
          decrement: withdrawalRequest.amount,
        },
      },
    });

    // Mark withdrawal as completed
    const updated = await prisma.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
      include: { user: true, investment: { include: { package: true } } },
    });

    // Update user stats to reflect the withdrawal
    await UserService.updateUserStats(withdrawalRequest.userId);

    logger.info(`Withdrawal request completed: ${withdrawalId}`);
    return updated;
  }

  /**
   * Reject withdrawal request (admin action)
   */
  static async rejectWithdrawalRequest(withdrawalId: string, reason: string) {
    const updated = await prisma.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
      },
      include: { user: true, investment: true },
    });

    // Restore available withdrawable balance if it was deducted
    if (updated.investmentId) {
      await prisma.investment.update({
        where: { id: updated.investmentId },
        data: {
          availableWithdrawable: {
            increment: updated.amount,
          },
        },
      });
    }

    logger.info(`Withdrawal request rejected: ${withdrawalId}`);
    return updated;
  }

  /**
   * Get pending withdrawal requests
   */
  static async getPendingWithdrawalRequests(limit = 50, offset = 0) {
    return await prisma.withdrawalRequest.findMany({
      where: { status: "PENDING" },
      include: { user: true, investment: { include: { package: true } } },
      orderBy: { createdAt: "asc" },
      skip: offset,
      take: limit,
    });
  }

  /**
   * Count pending withdrawal requests
   */
  static async countPendingWithdrawalRequests() {
    return await prisma.withdrawalRequest.count({
      where: { status: "PENDING" },
    });
  }

  /**
   * Get user's withdrawals
   */
  static async getUserWithdrawals(userId: string, status?: string, limit = 50, offset = 0) {
    const where: any = { userId };
    if (status) where.status = status;

    return await prisma.withdrawalRequest.findMany({
      where,
      include: { investment: { include: { package: true } } },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    });
  }

  /**
   * Calculate available withdrawal balance for an investment
   * Deducts pending withdrawal amounts
   */
  static async calculateAvailableBalance(investmentId: string): Promise<number> {
    const investment = await prisma.investment.findUnique({
      where: { id: investmentId },
    });

    if (!investment) {
      throw new Error("Investment not found");
    }

    // Get pending withdrawal amount (PENDING or PROCESSING status)
    const pendingWithdrawals = await prisma.withdrawalRequest.aggregate({
      where: {
        investmentId,
        status: {
          in: ["PENDING", "PROCESSING"],
        },
      },
      _sum: {
        amount: true,
      },
    });

    const pendingAmount = pendingWithdrawals._sum.amount || 0;

    // Available balance = total accrued - pending withdrawals
    const availableBalance = Math.max(
      0,
      investment.availableWithdrawable - pendingAmount
    );

    return availableBalance;
  }

  /**
   * Get pending withdrawal amount for an investment
   */
  static async getPendingWithdrawalAmount(investmentId: string): Promise<number> {
    const pendingWithdrawals = await prisma.withdrawalRequest.aggregate({
      where: {
        investmentId,
        status: {
          in: ["PENDING", "PROCESSING"],
        },
      },
      _sum: {
        amount: true,
      },
    });

    return pendingWithdrawals._sum.amount || 0;
  }

  /**
   * Get all withdrawal requests for user
   */
  static async getUserWithdrawalRequests(userId: string) {
    return await prisma.withdrawalRequest.findMany({
      where: { userId },
      include: {
        investment: true,
        user: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Check if user has any pending withdrawal (blocks new withdrawals)
   */
  static async hasPendingWithdrawal(userId: string) {
    const pendingWithdrawal = await prisma.withdrawalRequest.findFirst({
      where: {
        userId,
        status: {
          in: ["PENDING", "PROCESSING", "APPROVED"],
        },
      },
    });

    return !!pendingWithdrawal;
  }

  /**
   * Get pending withdrawal details for user (if exists)
   */
  static async getPendingWithdrawalDetails(userId: string) {
    const pendingWithdrawal = await prisma.withdrawalRequest.findFirst({
      where: {
        userId,
        status: {
          in: ["PENDING", "PROCESSING", "APPROVED"],
        },
      },
      include: {
        investment: { include: { package: true } },
        user: true,
      },
    });

    return pendingWithdrawal;
  }
}

export default InvestmentService;
