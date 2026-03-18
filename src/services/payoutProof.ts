import prisma from "../db/client.js";
import logger from "../config/logger.js";

class PayoutProofService {
  /**
   * Create a new payout proof
   */
  static async createPayoutProof(
    walletAddress: string,
    transactionLink: string,
    blockchain: string,
    submittedBy: string,
    amount?: number,
    cryptocurrency: string = "USDT",
    description?: string,
    proofDate?: Date
  ): Promise<any> {
    try {
      const proof = await prisma.payoutProof.create({
        data: {
          walletAddress,
          transactionLink,
          blockchain,
          cryptocurrency,
          submittedBy,
          description,
          amount,
          proofDate: proofDate || new Date(),
          isVerified: true,
        },
      });

      logger.info(`[PAYOUT] New proof created: ${proof.id}`, {
        blockchain,
        amount,
        walletAddress: walletAddress.substring(0, 10) + "...",
      });

      return proof;
    } catch (error) {
      logger.error("[PAYOUT] Error creating payout proof:", error);
      throw error;
    }
  }

  /**
   * Get all payout proofs with pagination
   */
  static async getAllProofs(page: number = 1, pageSize: number = 10): Promise<{
    proofs: any[];
    total: number;
    pages: number;
    currentPage: number;
  }> {
    try {
      const skip = (page - 1) * pageSize;
      
      const [proofs, total] = await Promise.all([
        prisma.payoutProof.findMany({
          where: { isVerified: true },
          orderBy: { createdAt: "desc" },
          skip,
          take: pageSize,
        }),
        prisma.payoutProof.count({
          where: { isVerified: true },
        }),
      ]);

      const pages = Math.ceil(total / pageSize);

      return {
        proofs,
        total,
        pages,
        currentPage: page,
      };
    } catch (error) {
      logger.error("[PAYOUT] Error fetching proofs:", error);
      throw error;
    }
  }

  /**
   * Get a single proof by ID
   */
  static async getProofById(proofId: string): Promise<any> {
    try {
      const proof = await prisma.payoutProof.findUnique({
        where: { id: proofId },
      });

      if (!proof) {
        throw new Error("Payout proof not found");
      }

      return proof;
    } catch (error) {
      logger.error("[PAYOUT] Error fetching proof:", error);
      throw error;
    }
  }

  /**
   * Get latest proofs for broadcast notification
   */
  static async getLatestProofs(count: number = 1): Promise<any[]> {
    try {
      const proofs = await prisma.payoutProof.findMany({
        where: { isVerified: true },
        orderBy: { createdAt: "desc" },
        take: count,
      });

      return proofs;
    } catch (error) {
      logger.error("[PAYOUT] Error fetching latest proofs:", error);
      throw error;
    }
  }

  /**
   * Delete a payout proof
   */
  static async deleteProof(proofId: string): Promise<void> {
    try {
      await prisma.payoutProof.delete({
        where: { id: proofId },
      });

      logger.info(`[PAYOUT] Proof deleted: ${proofId}`);
    } catch (error) {
      logger.error("[PAYOUT] Error deleting proof:", error);
      throw error;
    }
  }

  /**
   * Get all proofs for admin panel with filters
   */
  static async getProofsForAdmin(
    page: number = 1,
    pageSize: number = 20
  ): Promise<{
    proofs: any[];
    total: number;
    pages: number;
  }> {
    try {
      const skip = (page - 1) * pageSize;

      const [proofs, total] = await Promise.all([
        prisma.payoutProof.findMany({
          orderBy: { createdAt: "desc" },
          skip,
          take: pageSize,
        }),
        prisma.payoutProof.count(),
      ]);

      const pages = Math.ceil(total / pageSize);

      return { proofs, total, pages };
    } catch (error) {
      logger.error("[PAYOUT] Error fetching proofs for admin:", error);
      throw error;
    }
  }
}

export default PayoutProofService;
