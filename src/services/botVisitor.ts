import prisma from "../db/client.js";
import logger from "../config/logger.js";

class BotVisitorService {
  /**
   * Track or update a bot visitor (called on /start)
   */
  static async trackVisitor(
    telegramId: bigint,
    username?: string,
    firstName?: string,
    lastName?: string
  ): Promise<any> {
    try {
      const visitor = await prisma.botVisitor.upsert({
        where: { telegramId },
        update: {
          lastVisitedAt: new Date(),
          username: username || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        },
        create: {
          telegramId,
          username,
          firstName,
          lastName,
          firstVisitedAt: new Date(),
          lastVisitedAt: new Date(),
        },
      });

      logger.info(`[VISITOR] Tracked visitor: ${telegramId}`);
      return visitor;
    } catch (error) {
      logger.error("[VISITOR] Error tracking visitor:", error);
      throw error;
    }
  }

  /**
   * Mark visitor as registered
   */
  static async markAsRegistered(
    telegramId: bigint,
    registeredUserId: string
  ): Promise<any> {
    try {
      const visitor = await prisma.botVisitor.update({
        where: { telegramId },
        data: {
          hasRegistered: true,
          registeredUserId,
        },
      });

      logger.info(`[VISITOR] Marked as registered: ${telegramId}`);
      return visitor;
    } catch (error) {
      logger.error("[VISITOR] Error marking visitor as registered:", error);
      throw error;
    }
  }

  /**
   * Get all visitor chat IDs (for broadcast notifications)
   */
  static async getAllVisitorChatIds(): Promise<string[]> {
    try {
      const visitors = await prisma.botVisitor.findMany({
        select: { telegramId: true },
      });

      return visitors.map((v) => v.telegramId.toString());
    } catch (error) {
      logger.error("[VISITOR] Error fetching all chat IDs:", error);
      throw error;
    }
  }

  /**
   * Get visitor count
   */
  static async getVisitorStats(): Promise<{
    total: number;
    registered: number;
    unregistered: number;
  }> {
    try {
      const [total, registered] = await Promise.all([
        prisma.botVisitor.count(),
        prisma.botVisitor.count({ where: { hasRegistered: true } }),
      ]);

      return {
        total,
        registered,
        unregistered: total - registered,
      };
    } catch (error) {
      logger.error("[VISITOR] Error fetching visitor stats:", error);
      throw error;
    }
  }

  /**
   * Get a specific visitor
   */
  static async getVisitor(telegramId: bigint): Promise<any> {
    try {
      const visitor = await prisma.botVisitor.findUnique({
        where: { telegramId },
      });

      return visitor;
    } catch (error) {
      logger.error("[VISITOR] Error fetching visitor:", error);
      throw error;
    }
  }
}

export default BotVisitorService;
