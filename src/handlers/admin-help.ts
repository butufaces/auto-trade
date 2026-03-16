import { Context } from "grammy";
import logger from "../config/logger.js";

type SessionContext = Context & { session: any };

/**
 * Show admin help article management menu
 */
export async function handleManageHelpArticles(
  ctx: SessionContext
): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Manage Help Articles`);

  const HelpArticleService = (await import(
    "../services/helpArticle.js"
  )).default;

  try {
    const articles = await HelpArticleService.getAllArticles();

    let message = `<b>📚 Manage Help Articles</b>\n\n`;
    message += `Total Articles: ${articles.length}\n`;
    message += `Active: ${articles.filter((a: any) => a.isActive).length}\n`;
    message += `Inactive: ${articles.filter((a: any) => !a.isActive).length}\n\n`;

    message += `Choose an option:`;

    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();

    keyboard.text("➕ Add New Article", "help_add_new");
    keyboard.row();
    keyboard.text("📋 View All Articles", "help_view_all");
    keyboard.row();
    keyboard.text("🔄 Reorder Articles", "help_reorder");
    keyboard.row();
    keyboard.text("🔙 Back to Dashboard", "back_to_admin");

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } catch (error) {
    logger.error("Error showing help articles management:", error);
    await ctx.reply("❌ Failed to load help articles management");
  }
}

/**
 * Show list of all articles for admin
 */
export async function handleViewAllHelpArticles(
  ctx: SessionContext
): Promise<void> {
  logger.info(`📄 PAGE SHOWN: View All Help Articles`);

  const HelpArticleService = (await import(
    "../services/helpArticle.js"
  )).default;

  try {
    const articles = await HelpArticleService.getAllArticles();

    if (articles.length === 0) {
      await ctx.reply("📭 No help articles yet.", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "➕ Create Article", callback_data: "help_add_new" },
              { text: "🔙 Back", callback_data: "manage_help_articles" },
            ],
          ],
        },
      });
      return;
    }

    let message = `<b>📚 All Help Articles</b>\n\n`;

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const status = article.isActive ? "✅" : "❌";
      message += `${i + 1}. ${status} ${article.icon} ${article.title}\n`;
      message += `   Category: ${article.category || "Uncategorized"} | Order: ${article.order}\n\n`;
    }

    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();

    // Add edit buttons for each article
    for (const article of articles) {
      keyboard.text(
        `✏️ Edit: ${article.title}`,
        `help_edit_${article.id}`
      );
      keyboard.row();
    }

    keyboard.text("➕ Add New", "help_add_new");
    keyboard.row();
    keyboard.text("🔙 Back", "manage_help_articles");

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } catch (error) {
    logger.error("Error showing all help articles:", error);
    await ctx.reply("❌ Failed to load articles");
  }
}

/**
 * Start adding new help article
 */
export async function handleAddHelpArticleStart(
  ctx: SessionContext
): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Add Help Article`);

  // Clear any other workflow states to prevent conflicts
  delete ctx.session.editingReferralThreshold;
  delete ctx.session.editingReferralBonus;
  delete ctx.session.approveInvestmentId;
  delete ctx.session.rejectInvestmentId;
  delete ctx.session.editingAccountId;

  ctx.session.helpArticleCreation = {
    step: "title",
  };

  await ctx.reply(
    `<b>➕ Create New Help Article</b>\n\n` +
      `Step 1/5: Enter article title\n` +
      `(e.g., "How to Trade", "Payment Methods")\n\n` +
      `Type the title:`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "❌ Cancel", callback_data: "manage_help_articles" }]],
      },
    }
  );
}

/**
 * Handle article creation steps
 */
export async function handleHelpArticleInput(
  ctx: SessionContext,
  text: string
): Promise<void> {
  const creation = ctx.session.helpArticleCreation;

  if (!creation) {
    return;
  }

  try {
    if (creation.step === "title") {
      creation.title = text;
      creation.step = "icon";

      await ctx.reply(
        `<b>Step 2/5: Choose an icon emoji</b>\n\n` +
          `Suggested:\n` +
          `🎓 = Learning/How-to\n` +
          `💸 = Money/Withdraw\n` +
          `💳 = Payment\n` +
          `🔒 = Security\n` +
          `❓ = FAQ/Questions\n` +
          `💰 = Account/Wallet\n\n` +
          `Type 1 emoji:`,
        { parse_mode: "HTML" }
      );
    } else if (creation.step === "icon") {
      creation.icon = text || "📋";
      creation.step = "content";

      await ctx.reply(
        `<b>Step 3/5: Enter article content</b>\n\n` +
          `Type the full article content.\n` +
          `(Use \\n for line breaks)\n\n` +
          `Example:\n` +
          `How to trade:\\n1. Click Begin Trading\\n2. Select package\\n3. Confirm`,
        { parse_mode: "HTML" }
      );
    } else if (creation.step === "content") {
      creation.content = text.replace(/\\n/g, "\n");
      creation.step = "category";

      await ctx.reply(
        `<b>Step 4/5: Enter category (optional)</b>\n\n` +
          `Examples: Getting Started, Payments, Security, FAQ, Account\n\n` +
          `Type category or skip:`,
        { parse_mode: "HTML" }
      );
    } else if (creation.step === "category") {
      creation.category = text || null;
      creation.step = "confirm";

      let confirmMsg = `<b>Step 5/5: Review Article</b>\n\n`;
      confirmMsg += `Title: ${creation.title}\n`;
      confirmMsg += `Icon: ${creation.icon}\n`;
      confirmMsg += `Category: ${creation.category || "Uncategorized"}\n\n`;
      confirmMsg += `Content:\n${creation.content}\n\n`;
      confirmMsg += `Looks good?`;

      const { InlineKeyboard } = await import("grammy");
      const keyboard = new InlineKeyboard();

      keyboard.text("✅ Save Article", "help_save_article");
      keyboard.row();
      keyboard.text("❌ Cancel", "manage_help_articles");

      await ctx.reply(confirmMsg, {
        reply_markup: keyboard,
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    logger.error("Error in help article creation flow:", error);
    delete ctx.session.helpArticleCreation;
    await ctx.reply("❌ Error in creation process. Starting over...");
    return handleAddHelpArticleStart(ctx);
  }
}

/**
 * Save newly created help article
 */
export async function handleSaveHelpArticle(
  ctx: SessionContext
): Promise<void> {
  const HelpArticleService = (await import(
    "../services/helpArticle.js"
  )).default;

  const creation = ctx.session.helpArticleCreation;

  if (!creation || !creation.title || !creation.content) {
    await ctx.reply("❌ Invalid article data");
    return;
  }

  try {
    const article = await HelpArticleService.createArticle(
      creation.title,
      creation.content,
      creation.icon,
      creation.category
    );

    delete ctx.session.helpArticleCreation;

    await ctx.reply(
      `<b>✅ Article Created!</b>\n\n` +
        `Title: ${article.title}\n` +
        `ID: <code>${article.id}</code>\n\n` +
        `Article is now active and visible to users!`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📚 View All",
                callback_data: "help_view_all",
              },
              { text: "🔙 Back", callback_data: "manage_help_articles" },
            ],
          ],
        },
      }
    );

    logger.info(`Help article created by admin: ${article.id}`);
  } catch (error) {
    logger.error("Error saving help article:", error);
    await ctx.reply("❌ Failed to save article");
    delete ctx.session.helpArticleCreation;
  }
}

/**
 * Edit existing help article
 */
export async function handleEditHelpArticle(
  ctx: SessionContext,
  articleId: string
): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Edit Help Article`);

  const HelpArticleService = (await import(
    "../services/helpArticle.js"
  )).default;

  try {
    const article = await HelpArticleService.getArticleById(articleId);

    if (!article) {
      await ctx.reply("❌ Article not found");
      return;
    }

    let message = `<b>✏️ Edit Article</b>\n\n`;
    message += `Title: ${article.title}\n`;
    message += `Icon: ${article.icon}\n`;
    message += `Category: ${article.category || "Uncategorized"}\n`;
    message += `Status: ${article.isActive ? "✅ Active" : "❌ Inactive"}\n\n`;

    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();

    keyboard.text("✏️ Edit Title", `help_edit_field_${articleId}_title`);
    keyboard.row();
    keyboard.text(
      "✏️ Edit Content",
      `help_edit_field_${articleId}_content`
    );
    keyboard.row();
    keyboard.text("✏️ Edit Icon", `help_edit_field_${articleId}_icon`);
    keyboard.row();
    keyboard.text(
      "✏️ Edit Category",
      `help_edit_field_${articleId}_category`
    );
    keyboard.row();
    keyboard.text(
      article.isActive ? "🔴 Deactivate" : "🟢 Activate",
      `help_toggle_${articleId}`
    );
    keyboard.row();
    keyboard.text("🗑️ Delete", `help_delete_confirm_${articleId}`);
    keyboard.row();
    keyboard.text("🔙 Back", "help_view_all");

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } catch (error) {
    logger.error("Error loading article for editing:", error);
    await ctx.reply("❌ Failed to load article");
  }
}

/**
 * Start editing a specific field of a help article
 */
export async function handleStartEditHelpArticleField(
  ctx: SessionContext,
  articleId: string,
  fieldName: string
): Promise<void> {
  logger.info(`📝 Starting to edit field: ${fieldName} for article: ${articleId}`);

  // Clear any other workflow states to prevent conflicts
  delete ctx.session.editingReferralThreshold;
  delete ctx.session.editingReferralBonus;
  delete ctx.session.approveInvestmentId;
  delete ctx.session.rejectInvestmentId;
  delete ctx.session.editingAccountId;

  const HelpArticleService = (await import(
    "../services/helpArticle.js"
  )).default;

  try {
    const article = await HelpArticleService.getArticleById(articleId);

    if (!article) {
      await ctx.reply("❌ Article not found");
      return;
    }

    const fieldLabels: any = {
      title: "Title",
      content: "Content",
      icon: "Icon",
      category: "Category",
    };

    ctx.session.editingHelpArticle = {
      articleId,
      field: fieldName,
    };

    let prompt = `<b>✏️ Edit ${fieldLabels[fieldName]}</b>\n\n`;
    
    if (fieldName === "title") {
      prompt += `Current: ${article.title}\n\nEnter new title:`;
    } else if (fieldName === "content") {
      prompt += `Current content:\n${article.content}\n\nEnter new content:\n(Use \\n for line breaks)`;
    } else if (fieldName === "icon") {
      prompt += `Current: ${article.icon}\n\nChoose a new icon emoji:\n` +
        `🎓 = Learning/How-to\n` +
        `💸 = Money/Withdraw\n` +
        `💳 = Payment\n` +
        `🔒 = Security\n` +
        `❓ = FAQ/Questions\n` +
        `💰 = Account/Wallet`;
    } else if (fieldName === "category") {
      prompt += `Current: ${article.category || "Uncategorized"}\n\nEnter new category (or leave blank for Uncategorized):`;
    }

    await ctx.reply(prompt, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "❌ Cancel", callback_data: `help_edit_${articleId}` }]],
      },
    });
  } catch (error) {
    logger.error("Error starting field edit:", error);
    await ctx.reply("❌ Failed to start editing");
  }
}

/**
 * Process field edit input for help articles
 */
export async function handleEditHelpArticleFieldInput(
  ctx: SessionContext,
  newValue: string
): Promise<void> {
  const editing = ctx.session.editingHelpArticle;

  if (!editing) {
    return;
  }

  const HelpArticleService = (await import(
    "../services/helpArticle.js"
  )).default;

  try {
    const { articleId, field } = editing;
    
    const updateData: any = {};
    
    if (field === "title") {
      updateData.title = newValue.trim();
    } else if (field === "content") {
      updateData.content = newValue.replace(/\\n/g, "\n");
    } else if (field === "icon") {
      updateData.icon = newValue.trim() || "📋";
    } else if (field === "category") {
      updateData.category = newValue.trim() || null;
    }

    const article = await HelpArticleService.updateArticle(articleId, updateData);

    delete ctx.session.editingHelpArticle;

    const fieldLabels: any = {
      title: "Title",
      content: "Content",
      icon: "Icon",
      category: "Category",
    };

    await ctx.reply(
      `<b>✅ ${fieldLabels[field]} Updated!</b>\n\n` +
      `Article: ${article.title}\n\n` +
      `Changes saved.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✏️ Continue Editing", callback_data: `help_edit_${articleId}` }],
            [{ text: "📚 View All", callback_data: "help_view_all" }],
          ],
        },
      }
    );

    logger.info(`Help article field updated: ${articleId} - ${field}`);
  } catch (error) {
    logger.error("Error updating help article field:", error);
    delete ctx.session.editingHelpArticle;
    await ctx.reply("❌ Failed to update field");
  }
}

/**
 * Delete help article with confirmation
 */
export async function handleDeleteHelpArticleConfirm(
  ctx: SessionContext,
  articleId: string
): Promise<void> {
  const HelpArticleService = (await import(
    "../services/helpArticle.js"
  )).default;

  try {
    const article = await HelpArticleService.getArticleById(articleId);

    if (!article) {
      await ctx.reply("❌ Article not found");
      return;
    }

    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();

    keyboard.text("✅ Yes, Delete", `help_delete_confirm_yes_${articleId}`);
    keyboard.row();
    keyboard.text("❌ Cancel", `help_edit_${articleId}`);

    await ctx.reply(
      `<b>⚠️ Delete Article?</b>\n\n` +
        `"${article.title}"\n\n` +
        `This cannot be undone!`,
      {
        reply_markup: keyboard,
        parse_mode: "HTML",
      }
    );
  } catch (error) {
    logger.error("Error confirming article deletion:", error);
    await ctx.reply("❌ Error loading article");
  }
}

/**
 * Delete help article
 */
export async function handleDeleteHelpArticle(
  ctx: SessionContext,
  articleId: string
): Promise<void> {
  const HelpArticleService = (await import(
    "../services/helpArticle.js"
  )).default;

  try {
    await HelpArticleService.deleteArticle(articleId);

    await ctx.reply(
      `<b>✅ Article Deleted</b>\n\n` +
        `The article has been removed from the system.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📚 View Articles",
                callback_data: "help_view_all",
              },
              {
                text: "🔙 Back",
                callback_data: "manage_help_articles",
              },
            ],
          ],
        },
      }
    );

    logger.info(`Help article deleted: ${articleId}`);
  } catch (error) {
    logger.error("Error deleting help article:", error);
    await ctx.reply("❌ Failed to delete article");
  }
}

/**
 * Toggle article active status
 */
export async function handleToggleHelpArticleStatus(
  ctx: SessionContext,
  articleId: string
): Promise<void> {
  const HelpArticleService = (await import(
    "../services/helpArticle.js"
  )).default;

  try {
    const article = await HelpArticleService.toggleArticleStatus(articleId);

    const status = article.isActive ? "✅ Activated" : "❌ Deactivated";

    await ctx.reply(`<b>${status}</b>\n\n"${article.title}"`, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✏️ Edit", callback_data: `help_edit_${articleId}` }],
          [{ text: "🔙 Back", callback_data: "help_view_all" }],
        ],
      },
    });

    logger.info(`Help article status toggled: ${articleId}`);
  } catch (error) {
    logger.error("Error toggling article status:", error);
    await ctx.reply("❌ Failed to update article");
  }
}
