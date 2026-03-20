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

  /**
   * Get detailed admin stats including investor breakdown
   */
  static async getAdminStats(): Promise<{
    total: number;
    registered: number;
    unregistered: number;
    activeInvestors: number;
    inactiveInvestors: number;
    nonInvestors: number;
  }> {
    try {
      // Get total bot visitors (all who clicked /start)
      const total = await prisma.botVisitor.count();

      // Get all bot visitor telegram IDs
      const allVisitors = await prisma.botVisitor.findMany({
        select: { telegramId: true },
      });

      const allTelegramIds = allVisitors.map((v) => v.telegramId);

      // Get which visitors have User records (meaning they registered)
      const registeredUsers = await prisma.user.findMany({
        where: {
          telegramId: {
            in: allTelegramIds,
          },
        },
        include: {
          investments: {
            select: { status: true },
          },
        },
      });

      const registered = registeredUsers.length;
      const unregistered = total - registered;

      // Categorize registered users
      let activeInvestors = 0;
      let inactiveInvestors = 0;
      let nonInvestors = 0;

      for (const user of registeredUsers) {
        const hasActiveInvestment = user.investments.some(
          (inv) => inv.status === "ACTIVE"
        );
        const hasAnyInvestment = user.investments.length > 0;

        if (hasActiveInvestment) {
          activeInvestors++;
        } else if (hasAnyInvestment) {
          inactiveInvestors++;
        } else {
          nonInvestors++;
        }
      }

      logger.info(
        `[VISITOR] Admin stats: total=${total}, registered=${registered}, unregistered=${unregistered}, activeInvestors=${activeInvestors}, inactiveInvestors=${inactiveInvestors}, nonInvestors=${nonInvestors}`
      );

      return {
        total,
        registered,
        unregistered,
        activeInvestors,
        inactiveInvestors,
        nonInvestors,
      };
    } catch (error) {
      logger.error("[VISITOR] Error fetching admin stats:", error);
      throw error;
    }
  }
}

export default BotVisitorService;
