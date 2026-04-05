import logger from "../config/logger.js";
import AboutService from "../services/about.js";
import { formatCurrency } from "../lib/helpers.js";

type SessionContext = any;

/**
 * Show admin settings panel
 */
export async function handleAdminSettings(ctx: SessionContext): Promise<void> {
  try {
    const about = await AboutService.getAbout();

    let message = `<b>⚙️ Platform Settings</b>\n\n`;
    message += `<b>Current Settings:</b>\n\n`;
    message += `<b>Platform Name:</b>\n`;
    message += `<code>${about.platformName}</code>\n\n`;
    message += `<b>Platform About:</b>\n`;
    message += `<code>${about.about || "Not set"}</code>\n\n`;
    message += `<b>Website:</b>\n`;
    message += `<code>${about.website || "Not set"}</code>\n\n`;
    message += `<b>Support Email:</b>\n`;
    message += `<code>${about.supportEmail || "Not set"}</code>\n\n`;
    message += `<b>Mission:</b>\n`;
    message += `<code>${about.mission || "Not set"}</code>\n\n`;
    message += `<b>Vision:</b>\n`;
    message += `<code>${about.vision || "Not set"}</code>\n\n`;

    message += `\nChoose what you want to edit:`;

    const keyboard = [
      [
        {
          text: "📝 Edit Platform Name",
          callback_data: "edit_platform_name",
        },
        {
          text: "📄 Edit About",
          callback_data: "edit_platform_about",
        },
      ],
      [
        {
          text: "🌐 Edit Website",
          callback_data: "edit_platform_website",
        },
        {
          text: "📧 Edit Support Email",
          callback_data: "edit_platform_support_email",
        },
      ],
      [
        {
          text: "🎯 Edit Mission",
          callback_data: "edit_platform_mission",
        },
        {
          text: "👁️ Edit Vision",
          callback_data: "edit_platform_vision",
        },
      ],
      [
        {
          text: "🔗 Edit Terms URL",
          callback_data: "edit_platform_terms_url",
        },
        {
          text: "🔐 Edit Privacy URL",
          callback_data: "edit_platform_privacy_url",
        },
      ],
      [
        {
          text: "🎁 Bonus Settings",
          callback_data: "bonus_settings",
        },
        {
          text: "🔔 Bonus Reminders",
          callback_data: "bonus_reminder_settings",
        },
      ],
      [
        {
          text: "⬅️ Back to Admin",
          callback_data: "back_to_admin",
        },
      ],
    ];

    // Use editMessageText if it's a callback query, otherwise use reply
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: keyboard,
        },
      });
    } else {
      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: keyboard,
        },
      });
    }

    logger.info(`[SETTINGS] Admin accessed settings panel`);
  } catch (error) {
    logger.error("Error in handleAdminSettings:", error);
    await ctx.reply("Error loading settings. Please try again.");
  }
}

/**
 * Initiate platform name edit
 */
export async function handleEditPlatformName(ctx: SessionContext): Promise<void> {
  try {
    ctx.session.settingsEditingField = "platform_name";

    const message = `<b>📝 Edit Platform Name</b>\n\n`;
    const message2 = `Enter the new platform name:`;

    await ctx.editMessageText(message + message2, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "❌ Cancel",
              callback_data: "admin_settings",
            },
          ],
        ],
      },
    });

    logger.info(`[SETTINGS] Admin initiated platform name edit`);
  } catch (error) {
    logger.error("Error in handleEditPlatformName:", error);
    await ctx.reply("Error. Please try again.");
  }
}

/**
 * Initiate about edit
 */
export async function handleEditPlatformAbout(ctx: SessionContext): Promise<void> {
  try {
    ctx.session.settingsEditingField = "platform_about";

    const message = `<b>📄 Edit About</b>\n\n`;
    const message2 = `Enter the new about/description text:`;

    await ctx.editMessageText(message + message2, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "❌ Cancel",
              callback_data: "admin_settings",
            },
          ],
        ],
      },
    });

    logger.info(`[SETTINGS] Admin initiated about edit`);
  } catch (error) {
    logger.error("Error in handleEditPlatformAbout:", error);
    await ctx.reply("Error. Please try again.");
  }
}

/**
 * Initiate website edit
 */
export async function handleEditPlatformWebsite(ctx: SessionContext): Promise<void> {
  try {
    ctx.session.settingsEditingField = "platform_website";

    const message = `<b>🌐 Edit Website</b>\n\n`;
    const message2 = `Enter the platform website URL:`;

    await ctx.editMessageText(message + message2, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "❌ Cancel",
              callback_data: "admin_settings",
            },
          ],
        ],
      },
    });

    logger.info(`[SETTINGS] Admin initiated website edit`);
  } catch (error) {
    logger.error("Error in handleEditPlatformWebsite:", error);
    await ctx.reply("Error. Please try again.");
  }
}

/**
 * Initiate support email edit
 */
export async function handleEditPlatformSupportEmail(ctx: SessionContext): Promise<void> {
  try {
    ctx.session.settingsEditingField = "platform_support_email";

    const message = `<b>📧 Edit Support Email</b>\n\n`;
    const message2 = `Enter the support email address:`;

    await ctx.editMessageText(message + message2, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "❌ Cancel",
              callback_data: "admin_settings",
            },
          ],
        ],
      },
    });

    logger.info(`[SETTINGS] Admin initiated support email edit`);
  } catch (error) {
    logger.error("Error in handleEditPlatformSupportEmail:", error);
    await ctx.reply("Error. Please try again.");
  }
}

/**
 * Initiate mission edit
 */
export async function handleEditPlatformMission(ctx: SessionContext): Promise<void> {
  try {
    ctx.session.settingsEditingField = "platform_mission";

    const message = `<b>🎯 Edit Mission</b>\n\n`;
    const message2 = `Enter the platform mission statement:`;

    await ctx.editMessageText(message + message2, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "❌ Cancel",
              callback_data: "admin_settings",
            },
          ],
        ],
      },
    });

    logger.info(`[SETTINGS] Admin initiated mission edit`);
  } catch (error) {
    logger.error("Error in handleEditPlatformMission:", error);
    await ctx.reply("Error. Please try again.");
  }
}

/**
 * Initiate vision edit
 */
export async function handleEditPlatformVision(ctx: SessionContext): Promise<void> {
  try {
    ctx.session.settingsEditingField = "platform_vision";

    const message = `<b>👁️ Edit Vision</b>\n\n`;
    const message2 = `Enter the platform vision statement:`;

    await ctx.editMessageText(message + message2, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "❌ Cancel",
              callback_data: "admin_settings",
            },
          ],
        ],
      },
    });

    logger.info(`[SETTINGS] Admin initiated vision edit`);
  } catch (error) {
    logger.error("Error in handleEditPlatformVision:", error);
    await ctx.reply("Error. Please try again.");
  }
}

/**
 * Initiate terms URL edit
 */
export async function handleEditPlatformTermsUrl(ctx: SessionContext): Promise<void> {
  try {
    ctx.session.settingsEditingField = "platform_terms_url";

    const message = `<b>🔗 Edit Terms URL</b>\n\n`;
    const message2 = `Enter the URL to terms and conditions:`;

    await ctx.editMessageText(message + message2, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "❌ Cancel",
              callback_data: "admin_settings",
            },
          ],
        ],
      },
    });

    logger.info(`[SETTINGS] Admin initiated terms URL edit`);
  } catch (error) {
    logger.error("Error in handleEditPlatformTermsUrl:", error);
    await ctx.reply("Error. Please try again.");
  }
}

/**
 * Initiate privacy URL edit
 */
export async function handleEditPlatformPrivacyUrl(ctx: SessionContext): Promise<void> {
  try {
    ctx.session.settingsEditingField = "platform_privacy_url";

    const message = `<b>🔐 Edit Privacy URL</b>\n\n`;
    const message2 = `Enter the URL to privacy policy:`;

    await ctx.editMessageText(message + message2, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "❌ Cancel",
              callback_data: "admin_settings",
            },
          ],
        ],
      },
    });

    logger.info(`[SETTINGS] Admin initiated privacy URL edit`);
  } catch (error) {
    logger.error("Error in handleEditPlatformPrivacyUrl:", error);
    await ctx.reply("Error. Please try again.");
  }
}

/**
 * Process settings input (handles all field types)
 */
export async function handleProcessSettingsInput(
  ctx: SessionContext,
  value: string
): Promise<void> {
  try {
    const field = ctx.session.settingsEditingField;

    if (!field) {
      await ctx.reply("Error: No field selected for editing.");
      return;
    }

    // Trim and validate input
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      await ctx.reply("❌ Input cannot be empty. Please try again.");
      return;
    }

    // Additional validation for email
    if (field === "platform_support_email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedValue)) {
        await ctx.reply("❌ Invalid email format. Please enter a valid email address.");
        return;
      }
    }

    // Additional validation for URLs
    if (field === "platform_website" || field === "platform_terms_url" || field === "platform_privacy_url") {
      try {
        new URL(trimmedValue);
      } catch {
        await ctx.reply("❌ Invalid URL format. Please enter a valid URL (e.g., https://example.com)");
        return;
      }
    }

    // Map field to service method
    let confirmMessage = "";
    switch (field) {
      case "platform_name":
        await AboutService.setPlatformName(trimmedValue);
        confirmMessage = `✅ Platform name updated to: <b>${trimmedValue}</b>`;
        break;
      case "platform_about":
        await AboutService.setAbout(trimmedValue);
        confirmMessage = `✅ Platform about updated`;
        break;
      case "platform_website":
        await AboutService.setWebsite(trimmedValue);
        confirmMessage = `✅ Website updated to: <b>${trimmedValue}</b>`;
        break;
      case "platform_support_email":
        await AboutService.setSupportEmail(trimmedValue);
        confirmMessage = `✅ Support email updated to: <b>${trimmedValue}</b>`;
        break;
      case "platform_mission":
        await AboutService.setMission(trimmedValue);
        confirmMessage = `✅ Mission updated`;
        break;
      case "platform_vision":
        await AboutService.setVision(trimmedValue);
        confirmMessage = `✅ Vision updated`;
        break;
      case "platform_terms_url":
        await AboutService.setTermsUrl(trimmedValue);
        confirmMessage = `✅ Terms URL updated to: <b>${trimmedValue}</b>`;
        break;
      case "platform_privacy_url":
        await AboutService.setPrivacyUrl(trimmedValue);
        confirmMessage = `✅ Privacy URL updated to: <b>${trimmedValue}</b>`;
        break;
      default:
        await ctx.reply("❌ Unknown field. Please try again.");
        return;
    }

    // Clear the editing field
    ctx.session.settingsEditingField = null;

    // Show confirmation and return to settings
    await ctx.reply(confirmMessage, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "⬅️ Back to Settings",
              callback_data: "admin_settings",
            },
          ],
        ],
      },
    });

    logger.info(`[SETTINGS] Field ${field} updated to: ${trimmedValue.substring(0, 50)}...`);
  } catch (error) {
    logger.error("Error processing settings input:", error);
    await ctx.reply("❌ Error saving setting. Please try again.");
  }
}
