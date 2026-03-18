import { Context } from "grammy";
import PayoutProofService from "../services/payoutProof.js";
import BotVisitorService from "../services/botVisitor.js";
import TelegramNotificationService from "../services/telegramNotification.js";
import logger from "../config/logger.js";
import {
  adminMenuKeyboard,
  confirmationKeyboard,
} from "../utils/keyboard.js";

type SessionContext = Context & { session: any };

/**
 * Show admin payout proofs menu
 */
export async function handlePayoutProofsMenu(
  ctx: SessionContext
): Promise<void> {
  logger.info(`[ADMIN] 📄 Payout Proofs Menu`);

  const stats = await BotVisitorService.getVisitorStats();

  const message = `💸 <b>Payout Proofs Management</b>

This system displays withdrawal proofs to prospective users, building trust and converting visitors into sign-ups.

📊 <b>Current Stats:</b>
👥 Total Visitors: ${stats.total}
✅ Registered Users: ${stats.registered}
🔄 Unregistered: ${stats.unregistered}

<b>What would you like to do?</b>`;

  await ctx.reply(message, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "➕ Add New Proof", callback_data: "admin_add_payout_proof" },
        ],
        [
          {
            text: "📋 View All Proofs",
            callback_data: "admin_view_all_proofs_page_1",
          },
        ],
        [{ text: "🏠 Back to Admin", callback_data: "admin_menu" }],
      ],
    },
  });
}

/**
 * Start adding a new payout proof - ask for wallet address
 */
export async function handleStartAddPayoutProof(
  ctx: SessionContext
): Promise<void> {
  logger.info(`[ADMIN] Starting new payout proof submission`);

  ctx.session.payoutProofData = {};

  await ctx.reply(
    `💸 <b>Add New Payout Proof</b>\n\n
Let's add a new withdrawal proof to boost user confidence!\n
<b>Step 1: Enter the wallet address</b>\n
Please provide the blockchain wallet address where the withdrawal was sent (e.g., 0x742d35Cc6634C0532925a3b844Bc92d426e6b456):`,
    {
      parse_mode: "HTML",
      reply_markup: { remove_keyboard: true },
    }
  );

  ctx.session.awaitingInput = "payout_proof_wallet";
}

/**
 * Process wallet address input
 */
export async function handlePayoutProofWalletInput(
  ctx: SessionContext
): Promise<void> {
  const walletAddress = ctx.message?.text?.trim();

  if (!walletAddress) {
    await ctx.reply("❌ Please provide a valid wallet address");
    return;
  }

  // Basic validation
  if (walletAddress.length < 20) {
    await ctx.reply("❌ Wallet address seems too short. Please try again.");
    return;
  }

  ctx.session.payoutProofData.walletAddress = walletAddress;
  ctx.session.awaitingInput = "payout_proof_blockchain";

  logger.info(`[ADMIN] Wallet address set: ${walletAddress.substring(0, 10)}...`);

  await ctx.reply(
    `✅ Wallet saved!\n\n
<b>Step 2: Select the blockchain</b>\n
Which blockchain was this withdrawal sent on?`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Bitcoin (BTC)", callback_data: "proof_blockchain_bitcoin" },
            {
              text: "Ethereum (ETH)",
              callback_data: "proof_blockchain_ethereum",
            },
          ],
          [
            {
              text: "Binance Smart Chain (BSC)",
              callback_data: "proof_blockchain_bsc",
            },
            {
              text: "Solana (SOL)",
              callback_data: "proof_blockchain_solana",
            },
          ],
          [
            { text: "Ripple (XRP)", callback_data: "proof_blockchain_xrp" },
            { text: "Other", callback_data: "proof_blockchain_other" },
          ],
        ],
      },
    }
  );
}

const blockchainMap: Record<string, string> = {
  bitcoin: "Bitcoin (BTC)",
  ethereum: "Ethereum (ETH)",
  bsc: "Binance Smart Chain (BSC)",
  solana: "Solana (SOL)",
  xrp: "Ripple (XRP)",
};

/**
 * Process blockchain selection
 */
export async function handlePayoutProofBlockchainSelect(
  ctx: SessionContext,
  blockchain: string
): Promise<void> {
  if (blockchain === "other") {
    ctx.session.awaitingInput = "payout_proof_blockchain_custom";
    await ctx.reply(
      "Please enter the blockchain name (e.g., Polygon, Fantom, Avalanche):",
      {
        reply_markup: { remove_keyboard: true },
      }
    );
  } else {
    ctx.session.payoutProofData.blockchain =
      blockchainMap[blockchain] || blockchain;
    ctx.session.awaitingInput = "payout_proof_transaction_link";

    logger.info(
      `[ADMIN] Blockchain selected: ${ctx.session.payoutProofData.blockchain}`
    );

    await ctx.reply(
      `✅ Blockchain: ${ctx.session.payoutProofData.blockchain}\n\n
<b>Step 3: Enter the transaction link</b>\n
Please provide the transaction link on the blockchain explorer (e.g., https://etherscan.io/tx/0x123...):`,
      {
        parse_mode: "HTML",
        reply_markup: { remove_keyboard: true },
      }
    );
  }
}

/**
 * Process custom blockchain name
 */
export async function handlePayoutProofBlockchainCustomInput(
  ctx: SessionContext
): Promise<void> {
  const blockchain = ctx.message?.text?.trim();

  if (!blockchain) {
    await ctx.reply("❌ Please provide a blockchain name");
    return;
  }

  ctx.session.payoutProofData.blockchain = blockchain;
  ctx.session.awaitingInput = "payout_proof_transaction_link";

  logger.info(`[ADMIN] Custom blockchain set: ${blockchain}`);

  await ctx.reply(
    `✅ Blockchain: ${blockchain}\n\n
<b>Step 3: Enter the transaction link</b>\n
Please provide the transaction link on the blockchain explorer:`,
    {
      parse_mode: "HTML",
      reply_markup: { remove_keyboard: true },
    }
  );
}

/**
 * Process transaction link input
 */
export async function handlePayoutProofTransactionLinkInput(
  ctx: SessionContext
): Promise<void> {
  const transactionLink = ctx.message?.text?.trim();

  if (
    !transactionLink ||
    (!transactionLink.startsWith("http://") &&
      !transactionLink.startsWith("https://"))
  ) {
    await ctx.reply('❌ Please provide a valid URL (starting with http:// or https://)');
    return;
  }

  ctx.session.payoutProofData.transactionLink = transactionLink;
  ctx.session.awaitingInput = "payout_proof_amount";

  logger.info(`[ADMIN] Transaction link set`);

  await ctx.reply(
    `✅ Transaction link saved!\n\n
<b>Step 4 (Optional): Enter the withdrawal amount</b>\n
How much was withdrawn? (e.g., 5000, 15500.50)\n\n
Or type "skip" to continue without specifying an amount:`,
    {
      parse_mode: "HTML",
      reply_markup: { remove_keyboard: true },
    }
  );
}

/**
 * Process withdrawal amount input
 */
export async function handlePayoutProofAmountInput(
  ctx: SessionContext
): Promise<void> {
  const input = ctx.message?.text?.trim();

  if (!input) {
    await ctx.reply("❌ Please provide an amount or type 'skip'");
    return;
  }

  if (input.toLowerCase() !== "skip") {
    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(
        "❌ Please provide a valid positive number (e.g., 5000, 15500.50)"
      );
      return;
    }
    ctx.session.payoutProofData.amount = amount.toString();
  }

  ctx.session.awaitingInput = "payout_proof_date";

  logger.info(`[ADMIN] Amount set: ${ctx.session.payoutProofData.amount || "skipped"}`);

  await ctx.reply(
    `✅ ${ctx.session.payoutProofData.amount ? `Amount: $${ctx.session.payoutProofData.amount}` : "Amount skipped"}\n\n
<b>Step 5 (Optional): Enter the date</b>\n
When was this withdrawal processed? (e.g., 2025-03-20, today)\n\n
Or type "today" to use today's date, or "skip" to continue:`,
    {
      parse_mode: "HTML",
      reply_markup: { remove_keyboard: true },
    }
  );
}

/**
 * Process date input and ask for description
 */
export async function handlePayoutProofDateInput(
  ctx: SessionContext
): Promise<void> {
  const input = ctx.message?.text?.trim();

  if (!input) {
    await ctx.reply("❌ Please provide a date or type 'skip'");
    return;
  }

  let date: Date | undefined;

  if (input.toLowerCase() === "skip") {
    date = new Date(); // Use today
  } else if (input.toLowerCase() === "today") {
    date = new Date();
  } else {
    try {
      date = new Date(input);
      if (isNaN(date.getTime())) {
        throw new Error("Invalid date");
      }
    } catch (error) {
      await ctx.reply("❌ Please provide a valid date (e.g., 2025-03-20) or type 'today'");
      return;
    }
  }

  ctx.session.payoutProofData.proofDate = date;
  ctx.session.awaitingInput = "payout_proof_description";

  logger.info(
    `[ADMIN] Date set: ${date.toISOString().split("T")[0]}`
  );

  await ctx.reply(
    `✅ Date: ${date.toISOString().split("T")[0]}\n\n
<b>Step 6 (Optional): Add a description</b>\n
Any additional details about this withdrawal? (e.g., "Monthly dividends payout", "Q1 2025 returns")\n\n
Or type "skip" to finish:`,
    {
      parse_mode: "HTML",
      reply_markup: { remove_keyboard: true },
    }
  );
}

/**
 * Process description and show confirmation
 */
export async function handlePayoutProofDescriptionInput(
  ctx: SessionContext
): Promise<void> {
  const input = ctx.message?.text?.trim();

  if (input && input.toLowerCase() !== "skip") {
    ctx.session.payoutProofData.description = input;
  }

  ctx.session.awaitingInput = null;

  logger.info(`[ADMIN] Description set, showing confirmation`);

  // Show confirmation
  const { walletAddress, blockchain, transactionLink, amount, proofDate, description } =
    ctx.session.payoutProofData;

  const displayWallet = `${walletAddress.substring(0, 10)}...${walletAddress.substring(walletAddress.length - 8)}`;
  const dateStr = proofDate
    ? new Date(proofDate).toISOString().split("T")[0]
    : "Not specified";

  const confirmMessage = `📋 <b>Review Payout Proof</b>\n\n
<b>Blockchain:</b> ${blockchain}
<b>Wallet:</b> <code>${displayWallet}</code>
<b>Amount:</b> ${amount ? `$${amount}` : "Not specified"}
<b>Date:</b> ${dateStr}
<b>Transaction:</b> <a href="${transactionLink}">View</a>
${description ? `<b>Description:</b> ${description}` : ""}

<b>Ready to publish this proof to all ${(await BotVisitorService.getVisitorStats()).total} visitors?</b>`;

  await ctx.reply(confirmMessage, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "✅ Publish Proof",
            callback_data: "confirm_publish_payout_proof",
          },
        ],
        [{ text: "❌ Cancel", callback_data: "admin_payout_proofs" }],
      ],
    },
  });
}

/**
 * Publish the payout proof and broadcast to all visitors
 */
export async function handlePublishPayoutProof(
  ctx: SessionContext
): Promise<void> {
  try {
    const { walletAddress, blockchain, transactionLink, amount, proofDate, description } =
      ctx.session.payoutProofData;

    if (!walletAddress || !blockchain) {
      await ctx.reply(
        "❌ Missing required data. Please try adding a proof again.",
        {
          reply_markup: { inline_keyboard: [[{ text: "Back", callback_data: "admin_payout_proofs" }]] },
        }
      );
      return;
    }

    logger.info("[ADMIN] Publishing payout proof...");
    await ctx.answerCallbackQuery("📤 Publishing proof to all visitors...");

    // Create payout proof in database
    const proof = await PayoutProofService.createPayoutProof(
      walletAddress,
      transactionLink,
      blockchain,
      ctx.session.userId,
      amount ? parseFloat(amount) : undefined,
      "USDT",
      description,
      proofDate
    );

    logger.info(`[ADMIN] ✅ Payout proof created: ${proof.id}`);

    // Broadcast notification to all visitors
    const { successful, failed } =
      await TelegramNotificationService.broadcastPayoutProof(
        walletAddress,
        blockchain,
        amount,
        transactionLink
      );

    // Show confirmation
    const message = `✅ <b>Payout Proof Published!</b>\n\n
📊 <b>Broadcast Results:</b>
✅ Sent to: ${successful} users
❌ Failed: ${failed} users

💾 <b>Proof Details:</b>
🏦 Blockchain: ${blockchain}
💰 Amount: ${amount ? `$${amount}` : "Not specified"}
🔗 <a href="${transactionLink}">View Transaction</a>

The proof is now visible in the Payout Proofs section!`;

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📋 View All Proofs",
              callback_data: "admin_view_all_proofs_page_1",
            },
          ],
          [
            {
              text: "💸 Payout Proofs Menu",
              callback_data: "admin_payout_proofs",
            },
          ],
          [{ text: "🏠 Back to Admin", callback_data: "admin_menu" }],
        ],
      },
    });

    // Clear session data
    delete ctx.session.payoutProofData;
  } catch (error) {
    logger.error("[ADMIN] Error publishing payout proof:", error);
    await ctx.reply("❌ Error publishing proof. Please try again.", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "💸 Payout Proofs Menu",
              callback_data: "admin_payout_proofs",
            },
          ],
        ],
      },
    });
  }
}

/**
 * View all payout proofs for admin (paginated)
 */
export async function handleAdminViewAllProofs(
  ctx: SessionContext,
  page: number = 1
): Promise<void> {
  try {
    const pageSize = 5;
    const { proofs, total, pages } = await PayoutProofService.getProofsForAdmin(
      page,
      pageSize
    );

    if (total === 0) {
      await ctx.editMessageText(
        "📋 <b>All Payout Proofs</b>\n\n❌ No proofs submitted yet.",
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "➕ Add New Proof",
                  callback_data: "admin_add_payout_proof",
                },
              ],
              [
                {
                  text: "💸 Payout Proofs Menu",
                  callback_data: "admin_payout_proofs",
                },
              ],
            ],
          },
        }
      );
      return;
    }

    let message = `📋 <b>All Payout Proofs</b> (Page ${page}/${pages})\n\n`;

    const keyboard: any[] = [];

    proofs.forEach((proof, index) => {
      const num = (page - 1) * pageSize + index + 1;
      const displayWallet = `${proof.walletAddress.substring(0, 8)}...${proof.walletAddress.substring(proof.walletAddress.length - 6)}`;
      const status = proof.isVerified ? "✅" : "⏳";

      message += `${num}. ${status} <b>${proof.blockchain}</b>\n`;
      message += `   💰 ${proof.amount ? `$${proof.amount}` : "Amount TBD"}\n`;
      message += `   👛 <code>${displayWallet}</code>\n`;
      message += `   📅 ${new Date(proof.createdAt).toLocaleDateString()}\n\n`;

      // Add delete button for each proof
      keyboard.push([
        {
          text: `🗑️ Delete #${num}`,
          callback_data: `admin_delete_proof_${proof.id}`,
        },
      ]);
    });

    // Pagination buttons
    if (pages > 1) {
      const paginationRow = [];
      if (page > 1) {
        paginationRow.push({
          text: "⬅️ Previous",
          callback_data: `admin_view_all_proofs_page_${page - 1}`,
        });
      }
      paginationRow.push({ text: `${page}/${pages}`, callback_data: "noop" });
      if (page < pages) {
        paginationRow.push({
          text: "Next ➡️",
          callback_data: `admin_view_all_proofs_page_${page + 1}`,
        });
      }
      keyboard.push(paginationRow);
    }

    keyboard.push([
      {
        text: "➕ Add New Proof",
        callback_data: "admin_add_payout_proof",
      },
    ]);
    keyboard.push([
      {
        text: "💸 Payout Proofs Menu",
        callback_data: "admin_payout_proofs",
      },
    ]);

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error("[ADMIN] Error viewing proofs:", error);
    await ctx.reply("❌ Error loading proofs. Please try again.", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "💸 Payout Proofs Menu",
              callback_data: "admin_payout_proofs",
            },
          ],
        ],
      },
    });
  }
}

/**
 * Handle delete proof - show confirmation
 */
export async function handleDeletePayoutProof(
  ctx: SessionContext,
  proofId: string
): Promise<void> {
  try {
    const proof = await PayoutProofService.getProofById(proofId);

    if (!proof) {
      await ctx.answerCallbackQuery("❌ Proof not found");
      return;
    }

    const message = `🗑️ <b>Delete Payout Proof?</b>\n\n⚠️ Are you sure you want to delete this proof?\n\n<b>Blockchain:</b> ${proof.blockchain}\n<b>Amount:</b> $${proof.amount || 0}\n<b>Wallet:</b> <code>${proof.walletAddress.substring(0, 16)}...</code>\n\n<b>This action cannot be undone!</b>`;

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "❌ Delete", callback_data: `confirm_delete_proof_${proofId}` },
            { text: "✅ Cancel", callback_data: "admin_view_all_proofs_page_1" },
          ],
        ],
      },
    });
  } catch (error) {
    logger.error("[ADMIN] Error preparing delete:", error);
    await ctx.answerCallbackQuery("❌ Error loading proof");
  }
}

/**
 * Confirm and execute proof deletion
 */
export async function handleConfirmDeletePayoutProof(
  ctx: SessionContext,
  proofId: string
): Promise<void> {
  try {
    await PayoutProofService.deleteProof(proofId);

    logger.info(`[ADMIN] ✅ Proof deleted: ${proofId}`);

    await ctx.editMessageText(
      "✅ <b>Proof Deleted Successfully</b>\n\nThe payout proof has been removed.",
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📋 View All Proofs",
                callback_data: "admin_view_all_proofs_page_1",
              },
            ],
            [
              {
                text: "💸 Payout Proofs Menu",
                callback_data: "admin_payout_proofs",
              },
            ],
          ],
        },
      }
    );
  } catch (error) {
    logger.error("[ADMIN] Error deleting proof:", error);
    await ctx.editMessageText(
      "❌ <b>Error Deleting Proof</b>\n\nPlease try again.",
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📋 View All Proofs",
                callback_data: "admin_view_all_proofs_page_1",
              },
            ],
          ],
        },
      }
    );
  }
}
