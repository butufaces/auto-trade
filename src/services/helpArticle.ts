import prisma from "../db/client.js";
import logger from "../config/logger.js";

export default class HelpArticleService {
  /**
   * Get all active help articles ordered by display order
   */
  static async getAllActiveArticles() {
    try {
      const articles = await prisma.helpArticle.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
      });
      return articles;
    } catch (error) {
      logger.error("Error fetching active help articles:", error);
      throw error;
    }
  }

  /**
   * Get all help articles (including inactive ones) - for admin
   */
  static async getAllArticles() {
    try {
      const articles = await prisma.helpArticle.findMany({
        orderBy: { order: "asc" },
      });
      return articles;
    } catch (error) {
      logger.error("Error fetching all help articles:", error);
      throw error;
    }
  }

  /**
   * Get a single help article by ID
   */
  static async getArticleById(id: string) {
    try {
      const article = await prisma.helpArticle.findUnique({
        where: { id },
      });
      return article;
    } catch (error) {
      logger.error("Error fetching help article:", error);
      throw error;
    }
  }

  /**
   * Create a new help article
   */
  static async createArticle(
    title: string,
    content: string,
    icon: string = "📋",
    category?: string,
    order: number = 0
  ) {
    try {
      const article = await prisma.helpArticle.create({
        data: {
          title,
          content,
          icon,
          category,
          order,
          isActive: true,
        },
      });
      logger.info(`Help article created: ${article.id} - ${title}`);
      return article;
    } catch (error) {
      logger.error("Error creating help article:", error);
      throw error;
    }
  }

  /**
   * Update a help article
   */
  static async updateArticle(
    id: string,
    data: {
      title?: string;
      content?: string;
      icon?: string;
      category?: string;
      order?: number;
      isActive?: boolean;
    }
  ) {
    try {
      const article = await prisma.helpArticle.update({
        where: { id },
        data,
      });
      logger.info(`Help article updated: ${id}`);
      return article;
    } catch (error) {
      logger.error("Error updating help article:", error);
      throw error;
    }
  }

  /**
   * Delete a help article
   */
  static async deleteArticle(id: string) {
    try {
      await prisma.helpArticle.delete({
        where: { id },
      });
      logger.info(`Help article deleted: ${id}`);
      return true;
    } catch (error) {
      logger.error("Error deleting help article:", error);
      throw error;
    }
  }

  /**
   * Toggle article active status
   */
  static async toggleArticleStatus(id: string) {
    try {
      const article = await prisma.helpArticle.findUnique({
        where: { id },
        select: { isActive: true },
      });

      if (!article) {
        throw new Error("Article not found");
      }

      const updated = await prisma.helpArticle.update({
        where: { id },
        data: { isActive: !article.isActive },
      });

      logger.info(`Help article status toggled: ${id} - ${updated.isActive}`);
      return updated;
    } catch (error) {
      logger.error("Error toggling help article status:", error);
      throw error;
    }
  }

  /**
   * Reorder articles - update order for multiple articles
   */
  static async reorderArticles(
    items: Array<{ id: string; order: number }>
  ) {
    try {
      const updates = items.map((item) =>
        prisma.helpArticle.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      );

      await Promise.all(updates);
      logger.info(`Help articles reordered`);
      return true;
    } catch (error) {
      logger.error("Error reordering help articles:", error);
      throw error;
    }
  }

  /**
   * Get articles by category
   */
  static async getArticlesByCategory(category: string) {
    try {
      const articles = await prisma.helpArticle.findMany({
        where: { category, isActive: true },
        orderBy: { order: "asc" },
      });
      return articles;
    } catch (error) {
      logger.error("Error fetching articles by category:", error);
      throw error;
    }
  }

  /**
   * Create default help articles if none exist
   */
  static async initializeDefaultArticles() {
    try {
      const count = await prisma.helpArticle.count();

      if (count === 0) {
        const defaults = [
          {
            title: "How to Trade",
            icon: "🎓",
            content:
              "Click '🚀 Begin Trading' → Select a package → Enter amount → Confirm\n\n" +
              "1. Choose your trading package (Starter, Growth, Premium)\n" +
              "2. Enter investment amount (within min/max limits)\n" +
              "3. Confirm your trade\n" +
              "4. Choose payment method (Crypto or Bank Transfer)\n" +
              "5. Complete payment\n" +
              "6. Admin approves and your trade becomes ACTIVE\n" +
              "7. Enjoy your daily profit!\n\n" +
              "Minimum: $100 | Maximum: $50,000",
            category: "Getting Started",
            order: 1,
          },
          {
            title: "How to Withdraw",
            icon: "💸",
            content:
              "Withdraw your earnings anytime!\n\n" +
              "1. Go to 'My Portfolio'\n" +
              "2. Click your matured trade\n" +
              "3. Click '🏦 Withdraw' button\n" +
              "4. Select your wallet or add a new one\n" +
              "5. Enter withdrawal amount\n" +
              "6. Confirm withdrawal\n" +
              "7. Verify via email (link sent to your email)\n" +
              "8. Admin approves and sends payment\n\n" +
              "Typical processing time: 1-24 hours",
            category: "Withdrawals",
            order: 2,
          },
          {
            title: "Payment Methods",
            icon: "💳",
            content:
              "We accept multiple payment methods:\n\n" +
              "🪙 CRYPTOCURRENCY (Recommended)\n" +
              "Bitcoin, Ethereum, USDT, Litecoin\n" +
              "Instant payment verification\n\n" +
              "🏦 BANK TRANSFER\n" +
              "Direct bank deposits\n" +
              "Requires admin verification\n\n" +
              "All payments are secure and verified!",
            category: "Payments",
            order: 3,
          },
          {
            title: "Security Tips",
            icon: "🔒",
            content:
              "Keep your account safe:\n\n" +
              "✅ Enable email verification\n" +
              "✅ Use strong password\n" +
              "✅ Don't share your referral code carelessly\n" +
              "✅ Verify wallet addresses before sending crypto\n" +
              "✅ Enable 2FA if available\n" +
              "✅ Report suspicious activity immediately\n\n" +
              "Your security is our priority!",
            category: "Security",
            order: 4,
          },
          {
            title: "FAQ",
            icon: "❓",
            content:
              "Q: Why is my trade pending?\n" +
              "A: Admin is verifying your payment proof\n\n" +
              "Q: Can I withdraw before maturity?\n" +
              "A: Contact support for early withdrawal options\n\n" +
              "Q: How long until I see my profit?\n" +
              "A: Profit accrues daily from activation date\n\n" +
              "Q: What if my payment fails?\n" +
              "A: Contact support with transaction details\n\n" +
              "Need more help? Contact support!",
            category: "FAQ",
            order: 5,
          },
          {
            title: "Account & Wallet",
            icon: "💰",
            content:
              "Account Settings:\n" +
              "• Update profile information\n" +
              "• Manage email & phone\n" +
              "• View security options\n\n" +
              "Wallet Management:\n" +
              "• Add multiple withdrawal wallets\n" +
              "• Set default wallet\n" +
              "• Remove wallets\n\n" +
              "Portfolio Tracking:\n" +
              "• View all your trades\n" +
              "• Monitor daily profit\n" +
              "• Track maturity dates",
            category: "Account",
            order: 6,
          },
        ];

        await Promise.all(
          defaults.map((article) =>
            prisma.helpArticle.create({ data: article })
          )
        );

        logger.info("Default help articles initialized");
      }
    } catch (error) {
      logger.error("Error initializing default help articles:", error);
    }
  }
}
