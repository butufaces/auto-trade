import { Context } from "grammy";
import logger from "../config/logger.js";
import CurrencyService from "../services/currency.js";

type SessionContext = Context & { session: any };

/**
 * Main currency management menu
 */
export async function handleManageCurrency(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Manage Currency`);

  try {
    const message = `<b>💱 Manage Cryptocurrency Support</b>\n\n`;
    const helpText = `Select which currencies to manage:\n\n`;
    const subtext = `💰 Deposit: Currencies users can invest with\n`;
    const subtext2 = `💸 Withdrawal: Currencies users can withdraw to`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "💰 Manage Deposit Currencies",
            callback_data: "manage_deposit_currencies",
          },
        ],
        [
          {
            text: "💸 Manage Withdrawal Currencies",
            callback_data: "manage_withdrawal_currencies",
          },
        ],
        [{ text: "🔙 Back to Admin", callback_data: "back_to_admin" }],
      ],
    };

    await ctx.reply(message + helpText + subtext + "\n" + subtext2, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error("Error in handleManageCurrency:", error);
    await ctx.reply("❌ Error loading currency management. Please try again.");
  }
}

/**
 * Show deposit currencies with multi-select toggles
 */
export async function handleManageDepositCurrencies(
  ctx: SessionContext
): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Manage Deposit Currencies`);

  try {
    const allCryptos = await CurrencyService.getAllCryptocurrencies();
    const settings = await CurrencyService.getAllCurrencySettings();
    const depositSettings = settings.deposit;

    let message = `<b>💰 Manage Deposit Cryptocurrencies</b>\n\n`;
    message += `Select which cryptocurrencies users can use to invest:\n\n`;

    // Build list with status indicators
    depositSettings.forEach((setting: any) => {
      const status = setting.isEnabled ? "✅" : "❌";
      message += `${status} ${setting.cryptocurrency}\n`;
    });

    message += `\nTap any cryptocurrency to toggle it on/off`;

    // Build keyboard with toggles
    const keyboard = {
      inline_keyboard: depositSettings.map((setting: any) => [
        {
          text: `${setting.isEnabled ? "✅" : "❌"} ${setting.cryptocurrency}`,
          callback_data: `toggle_deposit_${setting.cryptocurrency}`,
        },
      ]),
    };

    // Add additional cryptos that aren't in settings yet
    const settingCryptos = depositSettings.map((s: any) => s.cryptocurrency);
    const newCryptos = allCryptos.filter((c) => !settingCryptos.includes(c));

    if (newCryptos.length > 0) {
      message += `\n\n<b>Available to add:</b>`;
      newCryptos.forEach((crypto) => {
        message += `\n❌ ${crypto}`;
      });

      newCryptos.forEach((crypto) => {
        keyboard.inline_keyboard.push([
          {
            text: `❌ ${crypto}`,
            callback_data: `toggle_deposit_${crypto}`,
          },
        ]);
      });
    }

    keyboard.inline_keyboard.push([
      { text: "🔙 Back", callback_data: "manage_currency" },
    ]);

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error("Error in handleManageDepositCurrencies:", error);
    await ctx.reply("❌ Error loading deposit currencies. Please try again.");
  }
}

/**
 * Show withdrawal currencies with multi-select toggles
 */
export async function handleManageWithdrawalCurrencies(
  ctx: SessionContext
): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Manage Withdrawal Currencies`);

  try {
    const allCryptos = await CurrencyService.getAllCryptocurrencies();
    const settings = await CurrencyService.getAllCurrencySettings();
    const withdrawalSettings = settings.withdrawal;

    let message = `<b>💸 Manage Withdrawal Cryptocurrencies</b>\n\n`;
    message += `Select which cryptocurrencies users can withdraw:\n\n`;

    // Build list with status indicators
    withdrawalSettings.forEach((setting: any) => {
      const status = setting.isEnabled ? "✅" : "❌";
      message += `${status} ${setting.cryptocurrency}\n`;
    });

    message += `\nTap any cryptocurrency to toggle it on/off`;

    // Build keyboard with toggles
    const keyboard = {
      inline_keyboard: withdrawalSettings.map((setting: any) => [
        {
          text: `${setting.isEnabled ? "✅" : "❌"} ${setting.cryptocurrency}`,
          callback_data: `toggle_withdrawal_${setting.cryptocurrency}`,
        },
      ]),
    };

    // Add additional cryptos that aren't in settings yet
    const settingCryptos = withdrawalSettings.map((s: any) => s.cryptocurrency);
    const newCryptos = allCryptos.filter((c) => !settingCryptos.includes(c));

    if (newCryptos.length > 0) {
      message += `\n\n<b>Available to add:</b>`;
      newCryptos.forEach((crypto) => {
        message += `\n❌ ${crypto}`;
      });

      newCryptos.forEach((crypto) => {
        keyboard.inline_keyboard.push([
          {
            text: `❌ ${crypto}`,
            callback_data: `toggle_withdrawal_${crypto}`,
          },
        ]);
      });
    }

    keyboard.inline_keyboard.push([
      { text: "🔙 Back", callback_data: "manage_currency" },
    ]);

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error("Error in handleManageWithdrawalCurrencies:", error);
    await ctx.reply("❌ Error loading withdrawal currencies. Please try again.");
  }
}

/**
 * Toggle deposit currency enabled/disabled
 */
export async function handleToggleDepositCurrency(
  ctx: SessionContext,
  cryptocurrency: string
): Promise<void> {
  try {
    const newStatus = await CurrencyService.toggleCurrency(
      "DEPOSIT",
      cryptocurrency
    );

    const statusText = newStatus ? "✅ Enabled" : "❌ Disabled";
    const message = `${statusText} ${cryptocurrency} for deposits`;

    await ctx.answerCallbackQuery(message);

    // Refresh the page
    return handleManageDepositCurrencies(ctx);
  } catch (error) {
    logger.error("Error toggling deposit currency:", error);
    await ctx.answerCallbackQuery("❌ Error updating currency settings");
  }
}

/**
 * Toggle withdrawal currency enabled/disabled
 */
export async function handleToggleWithdrawalCurrency(
  ctx: SessionContext,
  cryptocurrency: string
): Promise<void> {
  try {
    const newStatus = await CurrencyService.toggleCurrency(
      "WITHDRAWAL",
      cryptocurrency
    );

    const statusText = newStatus ? "✅ Enabled" : "❌ Disabled";
    const message = `${statusText} ${cryptocurrency} for withdrawals`;

    await ctx.answerCallbackQuery(message);

    // Refresh the page
    return handleManageWithdrawalCurrencies(ctx);
  } catch (error) {
    logger.error("Error toggling withdrawal currency:", error);
    await ctx.answerCallbackQuery("❌ Error updating currency settings");
  }
}
