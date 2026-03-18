import { Context } from "grammy";
import ReferralService from "../services/referral.js";
import logger from "../config/logger.js";
import {
  formatCurrency,
  formatDate,
  getUserDisplayName,
} from "../lib/helpers.js";
import prisma from "../db/client.js";

type SessionContext = Context & { session: any };

/**
 * View failed referral bonuses
 */
export async function handleViewFailedBonuses(ctx: SessionContext): Promise<void> {
  try {
    logger.info(`[ADMIN-REFERRAL] View failed bonuses requested by ${ctx.from?.id}`);

    // Get all failed bonus records
    const failedBonuses = await prisma.referralBonus.findMany({
      where: { status: "FAILED" },
      include: {
        investment: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    if (failedBonuses.length === 0) {
      await ctx.reply(
        `<b>✅ Good News!</b>\n\nNo failed referral bonuses found. All investments are being credited properly! 🎉`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Back", callback_data: "back_to_admin" }],
            ],
          },
        }
      );
      return;
    }

    let message = `<b>⚠️ Failed Referral Bonuses (${failedBonuses.length} total)</b>\n\n`;

    for (const bonus of failedBonuses) {
      const investment = bonus.investment;
      message += `<b>Investment #${investment.id.slice(0, 8)}</b>\n`;
      message += `User: ${getUserDisplayName(investment.user)}\n`;
      message += `Amount: ${formatCurrency(investment.amount)}\n`;
      message += `Expected Bonus: ${bonus.bonusPercentage}% = ${formatCurrency(bonus.bonusAmount || 0)}\n`;
      message += `Reason: User has no referrer (referredBy = NULL)\n`;
      message += `Date: ${formatDate(bonus.createdAt)}\n`;
      message += `<code>ID: ${bonus.id}</code>\n\n`;
    }

    message += `💡 <b>How to fix:</b>\n`;
    message += `Use /link_referrer_manual to connect the user to their referrer, then the bonus will be automatically credited.\n`;

    // Paginate if more than 5
    const page = ctx.session.failedBonusPage || 1;
    const pageSize = 5;
    const totalPages = Math.ceil(failedBonuses.length / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginated = failedBonuses.slice(start, end);

    if (totalPages > 1) {
      message = `<b>⚠️ Failed Referral Bonuses (${failedBonuses.length} total) - Page ${page}/${totalPages}</b>\n\n`;

      for (const bonus of paginated) {
        const investment = bonus.investment;
        message += `<b>Investment #${investment.id.slice(0, 8)}</b>\n`;
        message += `User: ${getUserDisplayName(investment.user)}\n`;
        message += `Amount: ${formatCurrency(investment.amount)}\n`;
        message += `Expected Bonus: ${bonus.bonusPercentage}% = ${formatCurrency(bonus.bonusAmount || 0)}\n`;
        message += `Date: ${formatDate(bonus.createdAt)}\n\n`;
      }
    }

    const keyboard: any = [
      [{ text: "📊 View Details", callback_data: "view_failed_bonus_details" }],
    ];

    if (page > 1) {
      keyboard.push([
        { text: "⬅️ Previous", callback_data: "failed_bonus_prev" },
        { text: "Next ➡️", callback_data: "failed_bonus_next" },
      ]);
    } else if (page < totalPages) {
      keyboard.push([{ text: "Next ➡️", callback_data: "failed_bonus_next" }]);
    }

    keyboard.push([{ text: "🔙 Back", callback_data: "back_to_admin" }]);

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error(`[ADMIN-REFERRAL] Error viewing failed bonuses:`, error);
    await ctx.reply(
      `<b>❌ Error</b>\n\nFailed to fetch failed bonuses. Check logs for details.`,
      { parse_mode: "HTML" }
    );
  }
}

/**
 * Start the process to manually link a user to a referrer
 */
export async function handleLinkReferrerManual(ctx: SessionContext): Promise<void> {
  try {
    logger.info(`[ADMIN-REFERRAL] Manual referrer linking initiated by ${ctx.from?.id}`);

    ctx.session.linkReferrerStep = 1;

    await ctx.reply(
      `<b>🔗 Link User to Referrer (Manual)</b>\n\n` +
      `This allows you to retroactively connect a user to their referrer and credit bonuses.\n\n` +
      `<b>Step 1:</b> Enter the <b>Telegram ID</b> or <b>email</b> of the user who should have a referrer.\n\n` +
      `Example:\n` +
      `• <code>1234567890</code> (Telegram ID)\n` +
      `• <code>user@example.com</code> (email)\n\n` +
      `Or type /cancel to exit.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          force_reply: true,
          selective: true,
        },
      }
    );

    ctx.session.linkReferrerStep = "waiting_for_referrer_user";
  } catch (error) {
    logger.error(`[ADMIN-REFERRAL] Error starting manual referrer linking:`, error);
    await ctx.reply(`<b>❌ Error</b>\n\nCould not start the linking process.`, {
      parse_mode: "HTML",
    });
  }
}

/**
 * Process the user input for manual referrer linking
 */
export async function handleLinkReferrerInput(ctx: SessionContext, userInput: string): Promise<void> {
  try {
    if (!ctx.session.linkReferrerStep) {
      return;
    }

    if (ctx.session.linkReferrerStep === "waiting_for_referrer_user") {
      // Find the user by email or Telegram ID
      let user = null;

      if (userInput.includes("@")) {
        user = await prisma.user.findFirst({
          where: { email: userInput },
          select: { id: true, email: true, firstName: true, lastName: true, telegramId: true },
        });
      } else {
        // Try to find by Telegram ID
        const telegramId = BigInt(userInput);
        user = await prisma.user.findUnique({
          where: { telegramId },
          select: { id: true, email: true, firstName: true, lastName: true, telegramId: true },
        });
      }

      if (!user) {
        await ctx.reply(
          `<b>❌ User not found</b>\n\nTry searching by:\n• Email: <code>user@example.com</code>\n• Telegram ID: <code>1234567890</code>\n\nOr /cancel to exit.`,
          { parse_mode: "HTML", reply_markup: { force_reply: true, selective: true } }
        );
        return;
      }

      ctx.session.linkReferrerUser = user;
      ctx.session.linkReferrerStep = "waiting_for_referrer_code";

      await ctx.reply(
        `<b>✅ Found User</b>\n\n` +
        `Name: ${user.firstName} ${user.lastName}\n` +
        `Email: ${user.email}\n\n` +
        `<b>Step 2:</b> Now enter the <b>referral code</b> of their referrer (the person who referred them).\n\n` +
        `Example: <code>REF_7227777071_MMC57O6G</code>\n\n` +
        `Or /cancel to exit.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            force_reply: true,
            selective: true,
          },
        }
      );
      return;
    }

    if (ctx.session.linkReferrerStep === "waiting_for_referrer_code") {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: userInput },
        select: { id: true, referralCode: true, firstName: true, lastName: true, email: true },
      });

      if (!referrer) {
        await ctx.reply(
          `<b>❌ Referrer not found</b>\n\nReferral code does not exist: <code>${userInput}</code>\n\nTry again or /cancel.`,
          { parse_mode: "HTML", reply_markup: { force_reply: true, selective: true } }
        );
        return;
      }

      const user = ctx.session.linkReferrerUser;

      // Show confirmation
      await ctx.reply(
        `<b>🔗 Confirm Linking</b>\n\n` +
        `User: <b>${user.firstName} ${user.lastName}</b> (${user.email})\n` +
        `Referrer: <b>${referrer.firstName} ${referrer.lastName}</b> (${referrer.referralCode})\n\n` +
        `Proceed with linking? This will:\n` +
        `1️⃣ Set ${user.firstName}'s referredBy to ${referrer.referralCode}\n` +
        `2️⃣ Automatically credit any FAILED bonuses from their investments\n`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Yes, Link", callback_data: `confirm_link_${user.id}_${referrer.id}` }],
              [{ text: "❌ Cancel", callback_data: "cancel_link" }],
            ],
          },
        }
      );

      ctx.session.linkReferrerStep = "waiting_for_confirmation";
    }
  } catch (error) {
    logger.error(`[ADMIN-REFERRAL] Error processing referrer linking input:`, error);
    await ctx.reply(`<b>❌ Error</b>\n\nCould not process your input.`, { parse_mode: "HTML" });
    delete ctx.session.linkReferrerStep;
  }
}

/**
 * Confirm and execute the referrer linking
 */
export async function handleConfirmLinkReferrer(
  ctx: SessionContext,
  userId: string,
  referrerId: string
): Promise<void> {
  try {
    logger.info(
      `[ADMIN-REFERRAL] Confirming referrer link: user=${userId}, referrer=${referrerId} by admin ${ctx.from?.id}`
    );

    // Get referrer's code
    const referrer = await prisma.user.findUnique({
      where: { id: referrerId },
      select: { referralCode: true, firstName: true, lastName: true, email: true },
    });

    if (!referrer?.referralCode) {
      throw new Error(`Referrer ${referrerId} not found or has no referral code`);
    }

    // Update user's referredBy
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { referredBy: referrer.referralCode },
      select: { id: true, email: true, firstName: true, lastName: true, referredBy: true },
    });

    if (!updatedUser.referredBy || updatedUser.referredBy !== referrer.referralCode) {
      throw new Error(`Failed to update referredBy for user ${userId}`);
    }

    logger.info(
      `[ADMIN-REFERRAL] ✅ User ${userId} linked to referrer ${referrerId} (code: ${referrer.referralCode})`
    );

    // Find all FAILED bonuses for this user's investments and retry crediting
    const failedBonuses = await prisma.referralBonus.findMany({
      where: {
        referredUserId: userId,
        status: "FAILED",
      },
      include: { investment: true },
    });

    let creditedCount = 0;

    for (const failedBonus of failedBonuses) {
      try {
        logger.info(
          `[ADMIN-REFERRAL] Retrying credit for failed bonus: ${failedBonus.id} (investment: ${failedBonus.investment.id})`
        );

        // Retry crediting the bonus
        await ReferralService.creditReferralBonus(
          failedBonus.investment.id,
          failedBonus.investment.amount,
          userId
        );

        creditedCount++;
      } catch (creditError) {
        logger.error(`[ADMIN-REFERRAL] Could not credit bonus ${failedBonus.id}:`, creditError);
      }
    }

    let message =
      `<b>✅ Linking Successful!</b>\n\n` +
      `User: <b>${updatedUser.firstName} ${updatedUser.lastName}</b> (${updatedUser.email})\n` +
      `Referrer: <b>${referrer.firstName} ${referrer.lastName}</b> (${referrer.referralCode})\n` +
      `Status: Linked ✅\n\n`;

    if (creditedCount > 0) {
      message +=
        `🎁 <b>${creditedCount} previously failed bonuses were credited!</b>\n\n`;
    } else {
      message += `📝 No failed bonuses to retry.\n\n`;
    }

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 Back", callback_data: "back_to_admin" }],
        ],
      },
    });

    delete ctx.session.linkReferrerStep;
    delete ctx.session.linkReferrerUser;
  } catch (error) {
    logger.error(`[ADMIN-REFERRAL] Error confirming referrer link:`, error);
    await ctx.reply(
      `<b>❌ Error linking referrer</b>\n\n${(error as Error).message}\n\nCheck logs for details.`,
      { parse_mode: "HTML" }
    );
    delete ctx.session.linkReferrerStep;
  }
}

/**
 * Cancel the referrer linking process
 */
export async function handleCancelLinkReferrer(ctx: SessionContext): Promise<void> {
  delete ctx.session.linkReferrerStep;
  delete ctx.session.linkReferrerUser;

  await ctx.reply(`<b>Cancelled</b>\n\nReferrer linking process ended.`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back", callback_data: "back_to_admin" }],
      ],
    },
  });
}

/**
 * Show referral system statistics
 */
export async function handleReferralStats(ctx: SessionContext): Promise<void> {
  try {
    logger.info(`[ADMIN-REFERRAL] Referral stats requested by ${ctx.from?.id}`);

    // Get statistics
    const [
      totalUsers,
      usersWithReferrer,
      totalReferrals,
      totalReferralEarnings,
      creditedBonuses,
      failedBonuses,
      totalBonusAmount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { referredBy: { not: null } } }),
      prisma.user.aggregate({
        _sum: { referralCount: true },
      }),
      prisma.user.aggregate({
        _sum: { referralEarnings: true },
      }),
      prisma.referralBonus.count({ where: { status: "CREDITED" } }),
      prisma.referralBonus.count({ where: { status: "FAILED" } }),
      prisma.referralBonus.aggregate({
        _sum: { bonusAmount: true },
        where: { status: "CREDITED" },
      }),
    ]);

    const message =
      `<b>📊 Referral System Statistics</b>\n\n` +
      `<b>Users:</b>\n` +
      `• Total Users: ${totalUsers}\n` +
      `• Users with Referrer: ${usersWithReferrer} (${usersWithReferrer > 0 ? Math.round((usersWithReferrer / totalUsers) * 100) : 0}%)\n\n` +
      `<b>Referrals:</b>\n` +
      `• Total Referral Links: ${totalReferrals._sum.referralCount || 0}\n` +
      `• Avg per Referrer: ${totalReferrals._sum.referralCount ? ((totalReferrals._sum.referralCount || 0) / (usersWithReferrer === 0 ? 1 : usersWithReferrer)).toFixed(1) : 0}\n\n` +
      `<b>Bonuses:</b>\n` +
      `• Credited: ${creditedBonuses}\n` +
      `• Failed: ${failedBonuses}\n` +
      `• Total Amount: ${formatCurrency(totalBonusAmount._sum.bonusAmount || 0)}\n` +
      `• Total Earnings: ${formatCurrency(totalReferralEarnings._sum.referralEarnings || 0)}\n\n` +
      `<b>System Status:</b>\n${
        failedBonuses === 0
          ? `✅ All bonuses are being credited successfully!`
          : `⚠️ ${failedBonuses} failed bonuses detected`
      }`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "⚠️ View Failed Bonuses", callback_data: "view_failed_bonuses" }],
          [{ text: "🔗 Link Referrer", callback_data: "link_referrer_manual" }],
          [{ text: "🔙 Back", callback_data: "back_to_admin" }],
        ],
      },
    });
  } catch (error) {
    logger.error(`[ADMIN-REFERRAL] Error fetching referral stats:`, error);
    await ctx.reply(
      `<b>❌ Error</b>\n\nCould not fetch referral statistics.`,
      { parse_mode: "HTML" }
    );
  }
}
