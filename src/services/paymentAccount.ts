import prisma from "../db/client.js";
import logger from "../config/logger.js";

class PaymentAccountService {
  /**
   * Get all active payment accounts
   */
  static async getAllPaymentAccounts() {
    try {
      // @ts-ignore - Prisma types not yet regenerated with PaymentAccount model
      return await (prisma as any).paymentAccount.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      logger.error("Failed to fetch payment accounts:", error);
      throw error;
    }
  }

  /**
   * Get single payment account
   */
  static async getPaymentAccountById(id: string) {
    try {
      // @ts-ignore - Prisma types not yet regenerated with PaymentAccount model
      return await (prisma as any).paymentAccount.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error(`Failed to fetch payment account ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create new payment account
   */
  static async createPaymentAccount(data: {
    accountNumber: string;
    bankName: string;
    accountName: string;
    instructions?: string;
  }) {
    try {
      // @ts-ignore - Prisma types not yet regenerated with PaymentAccount model
      const account = await (prisma as any).paymentAccount.create({
        data: {
          ...data,
          isActive: true,
        },
      });
      logger.info(`Payment account created: ${account.id}`);
      return account;
    } catch (error) {
      logger.error("Failed to create payment account:", error);
      throw error;
    }
  }

  /**
   * Update payment account
   */
  static async updatePaymentAccount(
    id: string,
    data: {
      accountNumber?: string;
      bankName?: string;
      accountName?: string;
      instructions?: string;
      isActive?: boolean;
    }
  ) {
    try {
      // @ts-ignore - Prisma types not yet regenerated with PaymentAccount model
      const account = await (prisma as any).paymentAccount.update({
        where: { id },
        data,
      });
      logger.info(`Payment account updated: ${id}`);
      return account;
    } catch (error) {
      logger.error(`Failed to update payment account ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete/deactivate payment account
   */
  static async deletePaymentAccount(id: string) {
    try {
      // @ts-ignore - Prisma types not yet regenerated with PaymentAccount model
      const account = await (prisma as any).paymentAccount.update({
        where: { id },
        data: { isActive: false },
      });
      logger.info(`Payment account deactivated: ${id}`);
      return account;
    } catch (error) {
      logger.error(`Failed to delete payment account ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get default payment account (first active one)
   */
  static async getDefaultPaymentAccount() {
    try {
      // @ts-ignore - Prisma types not yet regenerated with PaymentAccount model
      return await (prisma as any).paymentAccount.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      });
    } catch (error) {
      logger.error("Failed to fetch default payment account:", error);
      throw error;
    }
  }
}

export default PaymentAccountService;
