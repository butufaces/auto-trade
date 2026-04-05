import logger from "../config/logger.js";
import { BonusReminderService } from "../services/bonus-reminder.js";

type SessionContext = any;

/**
 * Show bonus reminder settings panel
 */
export async function handleBonusReminderSettings(ctx: SessionContext): Promise<void> {
  try {
    const settings = await BonusReminderService.getReminderSettings();

    let message = `<b>🔔 Bonus Reminder Settings</b>\n\n`;
    message += `<b>Current Settings:</b>\n\n`;
    message += `🔄 <b>Status:</b> ${settings.enabled ? "✅ Enabled" : "❌ Disabled"}\n`;
    message += `⏱️ <b>Reminder Frequency:</b> Every ${settings.frequencyHours} hours\n`;
    message += `📝 <b>Message Preview:</b>\n${settings.message.substring(0, 100)}...\n\n`;
    message += `Choose what you want to edit:`;

    const keyboard = [
      [
        {
          text: "⏱️ Edit Frequency",
          callback_data: "edit_reminder_frequency",
        },
      ],
      [
        {
          text: "📝 Edit Message",
          callback_data: "edit_reminder_message",
        },
      ],
      [
        {
          text: settings.enabled ? "🔴 Disable Reminders" : "🟢 Enable Reminders",
          callback_data: "toggle_reminder_status",
        },
      ],
      [
        {
          text: "⚡ Edit Escalation Settings",
          callback_data: "bonus_escalation_settings",
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

    logger.info(`[BONUS REMINDER] Admin accessed reminder settings`);
  } catch (error) {
    logger.error("Error in handleBonusReminderSettings:", error);
    await ctx.editMessageText("Error loading reminder settings. Please try again.");
  }
}

/**
 * Initiate reminder frequency edit
 */
export async function handleEditReminderFrequency(ctx: SessionContext): Promise<void> {
  try {
    ctx.session.reminderSettingsEditingField = "frequency";
    ctx.session.awaitingInput = "reminder_settings_input";

    let message = `<b>⏱️ Edit Reminder Frequency</b>\n\n`;
    message += `Current Frequency: <b>Every ${(await BonusReminderService.getReminderSettings()).frequencyHours} hours</b>\n\n`;
    message += `<b><u><i>Enter the new frequency in hours</i></u></b>\n\n`;
    message += `💡 <i>Examples: 1, 4, 6, 12, 24</i>`;

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🏠 Back to Menu",
              callback_data: "bonus_reminder_settings",
            },
          ],
        ],
      },
    });

    logger.info(`[BONUS REMINDER] Admin entering frequency edit mode`);
  } catch (error) {
    logger.error("Error in handleEditReminderFrequency:", error);
    await ctx.reply("Error loading settings. Please try again.");
  }
}

/**
 * Initiate reminder message edit
 */
export async function handleEditReminderMessage(ctx: SessionContext): Promise<void> {
  try {
    ctx.session.reminderSettingsEditingField = "message";
    ctx.session.awaitingInput = "reminder_settings_input";

    let message = `<b>📝 Edit Reminder Message</b>\n\n`;
    message += `<b>Current Message:</b>\n${(await BonusReminderService.getReminderSettings()).message}\n\n`;
    message += `<b><u><i>Enter the new reminder message</i></u></b>\n\n`;
    message += `<b>Available Variables:</b>\n`;
    message += `{bonusAmount} or {X} - Bonus amount (e.g., $10)\n`;
    message += `{daysLeft} or {Y} - Days remaining until expiry\n\n`;
    message += `💡 <i>Examples:\n• Your $X bonus expires in {Y} days!\n• You have {daysLeft} days to use your ${"{bonusAmount}"} bonus</i>`;

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🏠 Back to Menu",
              callback_data: "bonus_reminder_settings",
            },
          ],
        ],
      },
    });

    logger.info(`[BONUS REMINDER] Admin entering message edit mode`);
  } catch (error) {
    logger.error("Error in handleEditReminderMessage:", error);
    await ctx.reply("Error loading settings. Please try again.");
  }
}

/**
 * Toggle reminder enabled/disabled status
 */
export async function handleToggleReminderStatus(ctx: SessionContext): Promise<void> {
  try {
    const currentSettings = await BonusReminderService.getReminderSettings();
    const newStatus = !currentSettings.enabled;

    await BonusReminderService.updateReminderSettings(newStatus);

    let message = `<b>✅ Reminder Status Updated</b>\n\n`;
    message += `Reminders are now <b>${newStatus ? "✅ ENABLED" : "❌ DISABLED"}</b>\n\n`;
    message += `${
      newStatus
        ? "Users with active bonuses will now receive expiry reminders."
        : "Users will not receive reminder messages."
    }`;

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "⬅️ Back to Reminder Settings",
              callback_data: "bonus_reminder_settings",
            },
          ],
          [
            {
              text: "🏠 Back to Settings",
              callback_data: "admin_settings",
            },
          ],
        ],
      },
    });

    logger.info(
      `[BONUS REMINDER] Admin toggled reminder status to ${newStatus ? "enabled" : "disabled"}`
    );
  } catch (error) {
    logger.error("Error in handleToggleReminderStatus:", error);
    await ctx.editMessageText("Error updating status. Please try again.");
  }
}

/**
 * Process reminder settings input
 */
export async function handleProcessReminderSettingsInput(
  ctx: SessionContext,
  input: string
): Promise<void> {
  try {
    const field = ctx.session.reminderSettingsEditingField;

    if (!field) {
      await ctx.reply("Invalid state. Please try again.");
      return;
    }

    if (field === "frequency") {
      const frequency = parseInt(input, 10);

      if (isNaN(frequency)) {
        await ctx.reply("❌ Please enter a valid number.");
        ctx.session.awaitingInput = "reminder_settings_input";
        return;
      }

      await BonusReminderService.updateReminderSettings(undefined, frequency);

      let message = `<b>✅ Frequency Updated</b>\n\n`;
      message += `New reminder frequency: <b>Every ${frequency} hours</b>`;

      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "⬅️ Back to Reminder Settings",
                callback_data: "bonus_reminder_settings",
              },
            ],
          ],
        },
      });

      logger.info(`[BONUS REMINDER] Admin updated reminder frequency to ${frequency}h`);
    } else if (field === "message") {
      if (!input || input.trim().length === 0) {
        await ctx.reply("❌ Message cannot be empty. Please try again.");
        ctx.session.awaitingInput = "reminder_settings_input";
        return;
      }

      await BonusReminderService.updateReminderSettings(undefined, undefined, input);

      let message = `<b>✅ Message Updated</b>\n\n`;
      message += `<b>New Message Preview:</b>\n${input.substring(0, 150)}...`;

      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "⬅️ Back to Reminder Settings",
                callback_data: "bonus_reminder_settings",
              },
            ],
          ],
        },
      });

      logger.info(`[BONUS REMINDER] Admin updated reminder message`);
    }

    // Clear input mode
    ctx.session.awaitingInput = null;
    ctx.session.reminderSettingsEditingField = null;
  } catch (error) {
    logger.error("Error in handleProcessReminderSettingsInput:", error);
    await ctx.reply("❌ Error processing input. Please try again.");
  }
}

/**
 * Show escalation settings panel
 */
export async function handleBonusEscalationSettings(ctx: SessionContext): Promise<void> {
  try {
    const settings = await BonusReminderService.getEscalationSettings();

    let message = `<b>⚡ Escalation Settings</b>\n\n`;
    message += `<b>Current Configuration:</b>\n\n`;
    message += `⚠️ <b>URGENT Threshold:</b> When ≤ ${settings.urgentThresholdDays} days remain\n`;
    message += `   <i>Prefix: "${settings.urgentPrefix}"</i>\n\n`;
    message += `🔴 <b>CRITICAL Threshold:</b> When ≤ ${settings.criticalThresholdHours} hours remain\n`;
    message += `   <i>Prefix: "${settings.criticalPrefix}"</i>\n\n`;
    message += `Choose what you want to edit:`;

    const keyboard = [
      [
        {
          text: "⚠️ Edit URGENT Threshold",
          callback_data: "edit_escalation_urgent",
        },
      ],
      [
        {
          text: "🔴 Edit CRITICAL Threshold",
          callback_data: "edit_escalation_critical",
        },
      ],
      [
        {
          text: "🏷️ Edit Escalation Prefixes",
          callback_data: "edit_escalation_prefixes",
        },
      ],
      [
        {
          text: "⬅️ Back to Reminder Settings",
          callback_data: "bonus_reminder_settings",
        },
      ],
    ];

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });

    logger.info(`[BONUS ESCALATION] Admin accessed escalation settings`);
  } catch (error) {
    logger.error("Error in handleBonusEscalationSettings:", error);
    await ctx.editMessageText("Error loading escalation settings. Please try again.");
  }
}

/**
 * Edit URGENT threshold
 */
export async function handleEditEscalationUrgent(ctx: SessionContext): Promise<void> {
  try {
    ctx.session.escalationEditingField = "urgent";
    ctx.session.awaitingInput = "escalation_settings_input";

    const settings = await BonusReminderService.getEscalationSettings();

    let message = `<b>⚠️ Edit URGENT Threshold</b>\n\n`;
    message += `Current: <b>${settings.urgentThresholdDays} days</b>\n\n`;
    message += `<b><u><i>Enter the number of days at which to trigger URGENT status</i></u></b>\n\n`;
    message += `💡 <i>Example: 3 means when bonus has 3 days or less remaining.</i>`;

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🏠 Back to Escalation",
              callback_data: "bonus_escalation_settings",
            },
          ],
        ],
      },
    });

    logger.info(`[BONUS ESCALATION] Admin entering URGENT threshold edit`);
  } catch (error) {
    logger.error("Error in handleEditEscalationUrgent:", error);
    await ctx.reply("Error loading settings. Please try again.");
  }
}

/**
 * Edit CRITICAL threshold
 */
export async function handleEditEscalationCritical(ctx: SessionContext): Promise<void> {
  try {
    ctx.session.escalationEditingField = "critical";
    ctx.session.awaitingInput = "escalation_settings_input";

    const settings = await BonusReminderService.getEscalationSettings();

    let message = `<b>🔴 Edit CRITICAL Threshold</b>\n\n`;
    message += `Current: <b>${settings.criticalThresholdHours} hours</b>\n\n`;
    message += `<b><u><i>Enter the number of hours at which to trigger CRITICAL status</i></u></b>\n\n`;
    message += `💡 <i>Example: 24 means when bonus has 24 hours or less remaining.</i>`;

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🏠 Back to Escalation",
              callback_data: "bonus_escalation_settings",
            },
          ],
        ],
      },
    });

    logger.info(`[BONUS ESCALATION] Admin entering CRITICAL threshold edit`);
  } catch (error) {
    logger.error("Error in handleEditEscalationCritical:", error);
    await ctx.reply("Error loading settings. Please try again.");
  }
}

/**
 * Edit escalation prefixes
 */
export async function handleEditEscalationPrefixes(ctx: SessionContext): Promise<void> {
  try {
    ctx.session.escalationEditingField = "prefixes";
    ctx.session.awaitingInput = "escalation_settings_input";

    const settings = await BonusReminderService.getEscalationSettings();

    let message = `<b>🏷️ Edit Escalation Prefixes</b>\n\n`;
    message += `Current Prefixes:\n`;
    message += `• Regular: <b>"${settings.regularPrefix}"</b>\n`;
    message += `• Urgent: <b>"${settings.urgentPrefix}"</b>\n`;
    message += `• Critical: <b>"${settings.criticalPrefix}"</b>\n\n`;
    message += `<b><u><i>Enter new prefixes separated by | (pipe)</i></u></b>\n\n`;
    message += `💡 <i>Format: regular | urgent | critical\n\nExample: ⏰ | ⚠️ WARNING | 🚨 ALERT!</i>`;

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🏠 Back to Escalation",
              callback_data: "bonus_escalation_settings",
            },
          ],
        ],
      },
    });

    logger.info(`[BONUS ESCALATION] Admin entering prefix edit`);
  } catch (error) {
    logger.error("Error in handleEditEscalationPrefixes:", error);
    await ctx.reply("Error loading settings. Please try again.");
  }
}

/**
 * Process escalation settings input
 */
export async function handleProcessEscalationSettingsInput(
  ctx: SessionContext,
  input: string
): Promise<void> {
  try {
    const field = ctx.session.escalationEditingField;

    if (!field) {
      await ctx.reply("Invalid state. Please try again.");
      return;
    }

    if (field === "urgent") {
      const days = parseInt(input, 10);

      if (isNaN(days)) {
        await ctx.reply("❌ Please enter a valid number.");
        ctx.session.awaitingInput = "escalation_settings_input";
        return;
      }

      await BonusReminderService.updateEscalationSettings(days);

      let message = `<b>✅ URGENT Threshold Updated</b>\n\n`;
      message += `New threshold: <b>${days} ${days === 1 ? "day" : "days"}</b>`;

      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "⬅️ Back to Escalation",
                callback_data: "bonus_escalation_settings",
              },
            ],
          ],
        },
      });

      logger.info(`[BONUS ESCALATION] Admin updated URGENT threshold to ${days}d`);
    } else if (field === "critical") {
      const hours = parseInt(input, 10);

      if (isNaN(hours)) {
        await ctx.reply("❌ Please enter a valid number.");
        ctx.session.awaitingInput = "escalation_settings_input";
        return;
      }

      await BonusReminderService.updateEscalationSettings(undefined, hours);

      let message = `<b>✅ CRITICAL Threshold Updated</b>\n\n`;
      message += `New threshold: <b>${hours} ${hours === 1 ? "hour" : "hours"}</b>`;

      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "⬅️ Back to Escalation",
                callback_data: "bonus_escalation_settings",
              },
            ],
          ],
        },
      });

      logger.info(`[BONUS ESCALATION] Admin updated CRITICAL threshold to ${hours}h`);
    } else if (field === "prefixes") {
      const parts = input.split("|").map((p) => p.trim());

      if (parts.length !== 3) {
        await ctx.reply(
          "❌ Please provide exactly 3 prefixes separated by | (pipe).\n\nExample: ⏰ | ⚠️ WARNING | 🚨 ALERT"
        );
        ctx.session.awaitingInput = "escalation_settings_input";
        return;
      }

      const [regularPrefix, urgentPrefix, criticalPrefix] = parts;

      if (!regularPrefix || !urgentPrefix || !criticalPrefix) {
        await ctx.reply("❌ No prefix can be empty. Please try again.");
        ctx.session.awaitingInput = "escalation_settings_input";
        return;
      }

      await BonusReminderService.updateEscalationSettings(
        undefined,
        undefined,
        regularPrefix,
        urgentPrefix,
        criticalPrefix
      );

      let message = `<b>✅ Escalation Prefixes Updated</b>\n\n`;
      message += `<b>New Prefixes:</b>\n`;
      message += `• Regular: <b>"${regularPrefix}"</b>\n`;
      message += `• Urgent: <b>"${urgentPrefix}"</b>\n`;
      message += `• Critical: <b>"${criticalPrefix}"</b>`;

      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "⬅️ Back to Escalation",
                callback_data: "bonus_escalation_settings",
              },
            ],
          ],
        },
      });

      logger.info(`[BONUS ESCALATION] Admin updated escalation prefixes`);
    }

    // Clear input mode
    ctx.session.awaitingInput = null;
    ctx.session.escalationEditingField = null;
  } catch (error) {
    logger.error("Error in handleProcessEscalationSettingsInput:", error);
    await ctx.reply("❌ Error processing input. Please try again.");
  }
}
