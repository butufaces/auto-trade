import { Context } from "grammy";
import PayoutProofService from "../services/payoutProof.js";
import logger from "../config/logger.js";

type SessionContext = Context & { session: any };

/**
 * View payout proofs - paginated list with proof buttons
 */
export async function handleViewPayoutProofs(
  ctx: SessionContext,
  page: number = 1
): Promise<void> {
  logger.info(`[PAYOUTS] User viewing payout proofs page ${page}`);

  try {
    const pageSize = 5;
    const { proofs, total, pages } = await PayoutProofService.getAllProofs(
      page,
      pageSize
    );

    if (total === 0) {
      await ctx.reply(
        `📊 <b>Payout Proofs</b>\n\n
❌ No payout proofs available yet.\n
Check back soon to see our withdrawal transactions!`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🏠 Main Menu", callback_data: "main_menu" }],
            ],
          },
        }
      );
      return;
    }

    let message = `💸 <b>Payout Proofs</b>\n\n`;
    message += `📊 Verified Real Withdrawals\n`;
    message += `Page ${page}/${pages}\n\n`;
    message += `Click any proof to see full details:\n\n`;

    const keyboard: any[] = [];

    // Add each proof as a button with blockchain + date + amount
    proofs.forEach((proof) => {
      const date = new Date(proof.proofDate || proof.createdAt);
      const dateStr = date.toISOString().split("T")[0];
      const buttonText = `${proof.blockchain} • ${dateStr} • $${proof.amount || 0}`;

      keyboard.push([
        {
          text: buttonText,
          callback_data: `view_payout_proof_${proof.id}`,
        },
      ]);
    });

    // Pagination buttons
    if (pages > 1) {
      const paginationRow = [];
      if (page > 1) {
        paginationRow.push({
          text: "⬅️ Previous",
          callback_data: `view_payouts_page_${page - 1}`,
        });
      }
      paginationRow.push({ text: `${page}/${pages}`, callback_data: "noop" });
      if (page < pages) {
        paginationRow.push({
          text: "Next ➡️",
          callback_data: `view_payouts_page_${page + 1}`,
        });
      }
      keyboard.push(paginationRow);
    }

    keyboard.push([{ text: "🏠 Main Menu", callback_data: "main_menu" }]);

    // Check if this is an edit or initial message
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: keyboard },
      });
    } else {
      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: keyboard },
      });
    }
  } catch (error) {
    logger.error("[PAYOUTS] Error loading proofs:", error);
    await ctx.reply(
      "❌ Error loading payout proofs. Please try again later.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Main Menu", callback_data: "main_menu" }],
          ],
        },
      }
    );
  }
}

/**
 * View single payout proof details with back button
 */
export async function handleViewProofDetails(
  ctx: SessionContext,
  proofId: string
): Promise<void> {
  logger.info(`[PAYOUTS] User viewing proof details: ${proofId}`);

  try {
    const proof = await PayoutProofService.getProofById(proofId);

    if (!proof) {
      await ctx.reply("❌ Proof not found.", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📊 View All Proofs",
                callback_data: "view_payout_proofs",
              },
            ],
            [{ text: "🏠 Main Menu", callback_data: "main_menu" }],
          ],
        },
      });
      return;
    }

    const date = new Date(proof.proofDate || proof.createdAt);
    const dateStr = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    let message = `💸 <b>Withdrawal Proof</b>\n\n`;
    message += `<b>Blockchain:</b> ${proof.blockchain}\n`;
    message += `<b>Amount:</b> $${proof.amount || 0}\n`;
    message += `<b>Wallet Address:</b>\n<code>${proof.walletAddress}</code>\n\n`;
    message += `<b>Date:</b> ${dateStr}\n`;
    if (proof.description) {
      message += `<b>Description:</b> ${proof.description}\n`;
    }
    message += `\n✅ <b>Status:</b> ${proof.isVerified ? "Verified ✅" : "Pending Verification ⏳"}\n`;

    const keyboard = [];

    // Add transaction link button if available
    if (proof.transactionLink) {
      keyboard.push([
        {
          text: "🔗 View Transaction",
          url: proof.transactionLink,
        },
      ]);
    }

    // Add back button to return to proof list
    keyboard.push([
      {
        text: "⬅️ Back to Proofs",
        callback_data: "view_payout_proofs",
      },
    ]);
    keyboard.push([{ text: "🏠 Main Menu", callback_data: "main_menu" }]);

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: keyboard },
      });
    } else {
      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: keyboard },
      });
    }
  } catch (error) {
    logger.error("[PAYOUTS] Error loading proof details:", error);
    await ctx.reply("❌ Error loading proof details. Please try again.", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📊 View All Proofs",
              callback_data: "view_payout_proofs",
            },
          ],
          [{ text: "🏠 Main Menu", callback_data: "main_menu" }],
        ],
      },
    });
  }
}
