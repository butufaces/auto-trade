import { Context } from "grammy";
import AboutService from "../services/about.js";
import logger from "../config/logger.js";
import { adminMenuKeyboard } from "../utils/keyboard.js";

type SessionContext = Context & { session: any };

/**
 * Manage platform about information
 */
export async function handleManageAbout(ctx: SessionContext): Promise<void> {
  try {
    const about = await AboutService.getAbout();

    const message = `<b>✨ Platform About Settings</b>\n\n
<b>📛 Platform Name:</b> ${about.platformName}\n
<b>📖 About:</b> ${about.about.substring(0, 50)}${about.about.length > 50 ? "..." : ""}\n<b>👋 Welcome Text:</b> ${about.welcomeText ? about.welcomeText.substring(0, 50) + "..." : "Not set"}\n<b>🌐 Website:</b> ${about.website || "Not set"}\n
<b>📧 Support Email:</b> ${about.supportEmail || "Not set"}\n
<b>🎯 Mission:</b> ${about.mission ? about.mission.substring(0, 40) + "..." : "Not set"}\n
<b>🔭 Vision:</b> ${about.vision ? about.vision.substring(0, 40) + "..." : "Not set"}\n
<b>📜 Terms URL:</b> ${about.termsUrl || "Not set"}\n
<b>🔒 Privacy URL:</b> ${about.privacyUrl || "Not set"}\n\n
What would you like to edit?`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📛 Platform Name", callback_data: "edit_about_platformName" }],
          [{ text: "📖 About Text", callback_data: "edit_about_about" }],
          [{ text: "👋 Welcome Text", callback_data: "edit_about_welcomeText" }],
          [{ text: "🌐 Website", callback_data: "edit_about_website" }],
          [{ text: "📧 Support Email", callback_data: "edit_about_supportEmail" }],
          [{ text: "🎯 Mission", callback_data: "edit_about_mission" }],
          [{ text: "🔭 Vision", callback_data: "edit_about_vision" }],
          [{ text: "📜 Terms URL", callback_data: "edit_about_termsUrl" }],
          [{ text: "🔒 Privacy URL", callback_data: "edit_about_privacyUrl" }],
          [{ text: "🔙 Back to Dashboard", callback_data: "back_to_admin" }],
        ],
      },
    });
  } catch (error) {
    logger.error("Error managing about:", error);
    await ctx.reply("❌ Error loading about settings", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Start editing about field
 */
export async function handleEditAboutStart(
  ctx: SessionContext,
  field: string
): Promise<void> {
  try {
    ctx.session.editAboutField = field;
    ctx.session.editAboutStep = "enter_value";

    const fieldLabels: any = {
      platformName: "📛 Platform Name",
      about: "📖 About Text",
      welcomeText: "👋 Welcome Text",
      website: "🌐 Website",
      supportEmail: "📧 Support Email",
      mission: "🎯 Mission Statement",
      vision: "🔭 Vision Statement",
      termsUrl: "📜 Terms & Conditions URL",
      privacyUrl: "🔒 Privacy Policy URL",
    };

    const about = await AboutService.getAbout();
    const currentValue = (about as any)[field];

    const placeholder = field === "about" ? "Describe your platform..." : undefined;
    const hint = field === "termsUrl" || field === "privacyUrl" ? "(e.g., https://example.com/terms)" : "";

    await ctx.reply(
      `<b>Edit ${fieldLabels[field] || field}</b>\n\n
<b>Current value:</b> ${currentValue || "Not set"}\n\n
Enter new value ${hint}\n(or send /cancel to skip):`,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    logger.error("Error starting about edit:", error);
    await ctx.reply("❌ Error", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Confirm about update
 */
export async function handleConfirmAboutUpdate(
  ctx: SessionContext,
  value: string
): Promise<void> {
  try {
    const { editAboutField } = ctx.session;
    const trimmedValue = value.toString().trim();

    if (!trimmedValue) {
      await ctx.reply("❌ Please enter a valid value");
      return;
    }

    // Validate URLs for URL fields
    if ((editAboutField === "termsUrl" || editAboutField === "privacyUrl") && trimmedValue) {
      try {
        new URL(trimmedValue);
      } catch {
        await ctx.reply("❌ Please enter a valid URL (e.g., https://example.com/terms)");
        return;
      }
    }

    // Validate email for support email
    if (editAboutField === "supportEmail" && trimmedValue) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedValue)) {
        await ctx.reply("❌ Please enter a valid email address");
        return;
      }
    }

    const fieldLabels: any = {
      platformName: "📛 Platform Name",
      about: "📖 About Text",
      welcomeText: "👋 Welcome Text",
      website: "🌐 Website",
      supportEmail: "📧 Support Email",
      mission: "🎯 Mission Statement",
      vision: "🔭 Vision Statement",
      termsUrl: "📜 Terms & Conditions URL",
      privacyUrl: "🔒 Privacy Policy URL",
    };

    // Update based on field
    let updated;
    switch (editAboutField) {
      case "platformName":
        updated = await AboutService.setPlatformName(trimmedValue);
        break;
      case "about":
        updated = await AboutService.setAbout(trimmedValue);
        break;
      case "welcomeText":
        updated = await AboutService.setWelcomeText(trimmedValue);
        break;
      case "website":
        updated = await AboutService.setWebsite(trimmedValue);
        break;
      case "supportEmail":
        updated = await AboutService.setSupportEmail(trimmedValue);
        break;
      case "mission":
        updated = await AboutService.setMission(trimmedValue);
        break;
      case "vision":
        updated = await AboutService.setVision(trimmedValue);
        break;
      case "termsUrl":
        updated = await AboutService.setTermsUrl(trimmedValue);
        break;
      case "privacyUrl":
        updated = await AboutService.setPrivacyUrl(trimmedValue);
        break;
      default:
        throw new Error("Unknown field");
    }

    await ctx.reply(
      `✅ <b>${fieldLabels[editAboutField]} Updated</b>\n\n
<b>New value:</b> ${trimmedValue.length > 100 ? trimmedValue.substring(0, 100) + "..." : trimmedValue}`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✏️ Edit More", callback_data: "manage_about" }],
            [{ text: "👁️ View About", callback_data: "view_about" }],
            [{ text: "🔙 Back to Dashboard", callback_data: "back_to_admin" }],
          ],
        },
      }
    );

    delete ctx.session.editAboutField;
    ctx.session.editAboutStep = undefined;
  } catch (error) {
    logger.error("Error confirming about update:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`, { reply_markup: adminMenuKeyboard });
  }
}

/**
 * View platform about (public command)
 */
export async function handleViewAbout(ctx: SessionContext): Promise<void> {
  try {
    const message = await AboutService.formatAboutMessage();
    await ctx.reply(message, { parse_mode: "HTML" });
  } catch (error) {
    logger.error("Error viewing about:", error);
    await ctx.reply("❌ Error loading platform information");
  }
}
