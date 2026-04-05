import logger from "../config/logger.js";
import { BonusService } from "../services/bonus.js";
import { formatCurrency } from "../lib/helpers.js";

type SessionContext = any;

/**
 * Show bonus settings panel
 */
export async function handleBonusSettings(ctx: SessionContext): Promise<void> {
  try {
    const settings = await BonusService.getBonusSettings();

    let message = `<b>🎁 Registration Bonus Settings</b>\n\n`;
    message += `<b>Current Settings:</b>\n\n`;
    message += `💰 <b>Bonus Amount:</b> $${settings.registrationBonusAmount}\n`;
    message += `📅 <b>Expiry Days:</b> ${settings.registrationBonusExpiryDays} days\n`;
    message += `🔄 <b>Status:</b> ${settings.enabled ? "✅ Enabled" : "❌ Disabled"}\n\n`;
    message += `Choose what you want to edit:`;

    const keyboard = [
      [
        {
          text: "💵 Edit Bonus Amount",
          callback_data: "edit_bonus_amount",
        },
        {
          text: "📆 Edit Expiry Days",
          callback_data: "edit_bonus_expiry",
        },
      ],
      [
        {
          text: settings.enabled ? "🔴 Disable Bonus" : "🟢 Enable Bonus",
          callback_data: "toggle_bonus_status",
        },
      ],
      [
        {
          text: "⬅️ Back to Settings",
          callback_data: "admin_settings",
        },
      ],
    ];

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });

    logger.info(`[BONUS] Admin accessed bonus settings`);
  } catch (error) {
    logger.error("Error in handleBonusSettings:", error);
    await ctx.editMessageText("Error loading bonus settings. Please try again.");
  }
}

/**
 * Initiate bonus amount edit
 */
export async function handleEditBonusAmount(ctx: SessionContext): Promise<void> {
  try {
    ctx.session.bonusSettingsEditingField = "amount";
    ctx.session.awaitingInput = "bonus_settings_input";

    let message = `<b>💵 Edit Registration Bonus Amount</b>\n\n`;
    message += `Current Amount: <b>$${(await BonusService.getBonusSettings()).registrationBonusAmount}</b>\n\n`;
    message += `<b><u><i>Enter the new bonus amount (in USD)</i></u></b>\n\n`;
    message += `💡 <i>Example: 10 for $10 bonus</i>`;

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🏠 Back to Menu",
              callback_data: "bonus_settings",
            },
          ],
        ],
      },
    });

    logger.info(`[BONUS] Admin entering bonus amount edit mode`);
  } catch (error) {
    logger.error("Error in handleEditBonusAmount:", error);
    await ctx.reply("Error loading bonus settings. Please try again.");
  }
}

/**
 * Initiate bonus expiry days edit
 */
export async function handleEditBonusExpiry(ctx: SessionContext): Promise<void> {
  try {
    ctx.session.bonusSettingsEditingField = "expiry";
    ctx.session.awaitingInput = "bonus_settings_input";

    let message = `<b>📅 Edit Bonus Expiry Days</b>\n\n`;
    message += `Current Expiry: <b>${(await BonusService.getBonusSettings()).registrationBonusExpiryDays} days</b>\n\n`;
    message += `<b><u><i>Enter the number of days until bonus expires</i></u></b>\n\n`;
    message += `💡 <i>Example: 30 for 30 days expiry</i>`;

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🏠 Back to Menu",
              callback_data: "bonus_settings",
            },
          ],
        ],
      },
    });

    logger.info(`[BONUS] Admin entering bonus expiry edit mode`);
  } catch (error) {
    logger.error("Error in handleEditBonusExpiry:", error);
    await ctx.reply("Error loading bonus settings. Please try again.");
  }
}

/**
 * Toggle bonus enabled/disabled status
 */
export async function handleToggleBonusStatus(ctx: SessionContext): Promise<void> {
  try {
    const currentSettings = await BonusService.getBonusSettings();
    const newStatus = !currentSettings.enabled;

    await BonusService.updateBonusSettings(
      currentSettings.registrationBonusAmount,
      currentSettings.registrationBonusExpiryDays,
      newStatus
    );

    await ctx.answerCallbackQuery(
      `Bonus ${newStatus ? "enabled" : "disabled"} successfully!`,
      { show_alert: true }
    );

    // Show updated settings
    await handleBonusSettings(ctx);

    logger.info(`[BONUS] Admin toggled bonus status to: ${newStatus}`);
  } catch (error) {
    logger.error("Error in handleToggleBonusStatus:", error);
    await ctx.answerCallbackQuery("Error updating bonus status", { show_alert: true });
  }
}

/**
 * Process bonus settings input
 */
export async function handleProcessBonusSettingsInput(
  ctx: SessionContext,
  input: string
): Promise<void> {
  try {
    const field = ctx.session.bonusSettingsEditingField;

    if (!field) {
      await ctx.reply("Invalid operation. Please try again.");
      return;
    }

    const currentSettings = await BonusService.getBonusSettings();
    let amount = currentSettings.registrationBonusAmount;
    let expiryDays = currentSettings.registrationBonusExpiryDays;

    if (field === "amount") {
      const newAmount = parseFloat(input);
      if (isNaN(newAmount) || newAmount < 0) {
        await ctx.reply("❌ Invalid amount. Please enter a valid number.", {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🔄 Try Again",
                  callback_data: "edit_bonus_amount",
                },
              ],
            ],
          },
        });
        return;
      }
      amount = newAmount;
    } else if (field === "expiry") {
      const newExpiry = parseInt(input, 10);
      if (isNaN(newExpiry) || newExpiry <= 0) {
        await ctx.reply("❌ Invalid days. Please enter a valid number.", {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🔄 Try Again",
                  callback_data: "edit_bonus_expiry",
                },
              ],
            ],
          },
        });
        return;
      }
      expiryDays = newExpiry;
    }

    // Update settings
    await BonusService.updateBonusSettings(amount, expiryDays, currentSettings.enabled);

    const message = field === "amount" 
      ? `✅ Bonus amount updated to <b>$${amount}</b>`
      : `✅ Bonus expiry updated to <b>${expiryDays} days</b>`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "⚙️ Bonus Settings",
              callback_data: "bonus_settings",
            },
          ],
        ],
      },
    });

    // Clean up session
    delete ctx.session.bonusSettingsEditingField;
    delete ctx.session.awaitingInput;

    logger.info(`[BONUS] Admin updated ${field} to ${field === "amount" ? "$" + amount : expiryDays + " days"}`);
  } catch (error) {
    logger.error("Error processing bonus settings input:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}
