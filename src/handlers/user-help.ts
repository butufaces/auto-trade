import { Context } from "grammy";
import logger from "../config/logger.js";

type SessionContext = Context & { session: any };

/**
 * Show help menu to user
 */
export async function handleUserHelp(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: User Help Menu`);

  const HelpArticleService = (await import(
    "../services/helpArticle.js"
  )).default;

  try {
    const articles = await HelpArticleService.getAllActiveArticles();

    if (articles.length === 0) {
      await ctx.reply("📭 No help articles available right now. Please contact support.");
      return;
    }

    let message = `<b>📚 Help & Support</b>\n\n`;
    message += `Choose a topic below to learn more:\n\n`;

    // Group articles by category
    const categories = new Map();
    for (const article of articles) {
      const cat = article.category || "Other";
      if (!categories.has(cat)) {
        categories.set(cat, []);
      }
      categories.get(cat).push(article);
    }

    // Show category summary
    for (const [category, items] of categories) {
      message += `${items[0]?.icon || "📋"} <b>${category}</b> (${items.length})\n`;
    }

    message += `\n💬 Can't find what you need?`;

    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();

    // Add buttons for each article
    for (const article of articles) {
      keyboard.text(
        `${article.icon} ${article.title}`,
        `user_help_view_${article.id}`
      );
      keyboard.row();
    }

    keyboard.text("💬 Contact Support", "open_support_chat");
    keyboard.row();
    keyboard.text("🔙 Back to Menu", "back_to_main_menu");

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } catch (error) {
    logger.error("Error showing help menu:", error);
    await ctx.reply("❌ Failed to load help articles");
  }
}

/**
 * Show a specific help article
 */
export async function handleViewHelpArticle(
  ctx: SessionContext,
  articleId: string
): Promise<void> {
  logger.info(`📄 PAGE SHOWN: View Help Article - ${articleId}`);

  const HelpArticleService = (await import(
    "../services/helpArticle.js"
  )).default;

  try {
    const article = await HelpArticleService.getArticleById(articleId);

    if (!article || !article.isActive) {
      await ctx.reply("❌ Article not found or unavailable");
      return;
    }

    let message = `<b>${article.icon} ${article.title}</b>\n\n`;

    if (article.category) {
      message += `<i>Category: ${article.category}</i>\n\n`;
    }

    message += `${article.content}`;

    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();

    // Navigation buttons
    keyboard.text("💬 Get Help", "open_support_chat");
    keyboard.row();

    const articles = await HelpArticleService.getAllActiveArticles();
    const currentIndex = articles.findIndex((a: any) => a.id === articleId);

    // Previous/Next buttons if there are multiple articles
    if (articles.length > 1) {
      if (currentIndex > 0) {
        const prevArticle = articles[currentIndex - 1];
        keyboard.text(`← ${prevArticle.title}`, `user_help_view_${prevArticle.id}`);
      }

      if (currentIndex < articles.length - 1) {
        const nextArticle = articles[currentIndex + 1];
        keyboard.text(`${nextArticle.title} →`, `user_help_view_${nextArticle.id}`);
      }
      keyboard.row();
    }

    keyboard.text("📚 Back to Help", "user_help_menu");
    keyboard.row();
    keyboard.text("🏠 Main Menu", "back_to_main_menu");

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } catch (error) {
    logger.error("Error loading help article:", error);
    await ctx.reply("❌ Failed to load article");
  }
}

/**
 * Open support chat from help menu
 */
export async function handleSupportFromHelp(
  ctx: SessionContext
): Promise<void> {
  logger.info(`📞 User opening support chat from help menu`);

  const { InlineKeyboard } = await import("grammy");
  const keyboard = new InlineKeyboard();

  keyboard.text("🆕 New Ticket", "create_support_ticket");
  keyboard.row();
  keyboard.text("📋 View My Tickets", "view_my_tickets");
  keyboard.row();
  keyboard.text("🔙 Back to Help", "user_help_menu");

  await ctx.reply(
    `<b>💬 Support & Help</b>\n\n` +
      `How can we help you today?`,
    {
      reply_markup: keyboard,
      parse_mode: "HTML",
    }
  );
}
