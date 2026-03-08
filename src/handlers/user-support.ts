import { Context } from "grammy";
import SupportService from "../services/support.js";
import { NotificationService } from "../services/notification.js";
import prisma from "../db/client.js";
import logger from "../config/logger.js";
import { config } from "../config/env.js";
import { mainMenuKeyboard } from "../utils/keyboard.js";

type SessionContext = Context & { session: any };

/**
 * Show support menu - main entry point for users
 */
export async function handleSupportMenu(ctx: SessionContext): Promise<void> {
  try {
    const userId = ctx.session.userId;
    if (!userId) {
      await ctx.reply("❌ User not found");
      return;
    }

    const message = `<b>📞 Support Center</b>

How can we help you?`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📝 New Complaint", callback_data: "support_new_complaint" }],
          [{ text: "📋 My Tickets", callback_data: "support_my_tickets_page_1" }],
          [{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }],
        ],
      },
    });
  } catch (error) {
    logger.error("Error showing support menu:", error);
    await ctx.reply("❌ Error loading support menu", { reply_markup: mainMenuKeyboard });
  }
}

/**
 * Start new complaint
 */
export async function handleNewComplaint(ctx: SessionContext): Promise<void> {
  try {
    ctx.session.supportStep = "enter_subject";

    await ctx.reply(
      `<b>📝 Create Support Ticket</b>

Please enter the <b>subject/title</b> of your complaint:`,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    logger.error("Error starting complaint:", error);
    await ctx.reply("❌ Error", { reply_markup: mainMenuKeyboard });
  }
}

/**
 * Handle complaint subject input
 */
export async function handleComplaintSubject(ctx: SessionContext, subject: string): Promise<void> {
  try {
    if (!subject || subject.trim().length === 0) {
      await ctx.reply("❌ Subject cannot be empty. Please try again.");
      return;
    }

    if (subject.length > 100) {
      await ctx.reply("❌ Subject is too long (max 100 characters). Please try again.");
      return;
    }

    ctx.session.supportData = {
      subject: subject.trim(),
    };
    ctx.session.supportStep = "enter_description";
    logger.info(`Support ticket subject set: ${subject.substring(0, 50)}`);

    await ctx.reply(
      `<b>📝 Create Support Ticket</b>

Now describe your issue in detail:`,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    logger.error("Error processing complaint subject:", error);
    await ctx.reply("❌ Error", { reply_markup: mainMenuKeyboard });
  }
}

/**
 * Handle complaint description input
 */
export async function handleComplaintDescription(ctx: SessionContext, description: string): Promise<void> {
  try {
    if (!description || description.trim().length === 0) {
      await ctx.reply("❌ Description cannot be empty. Please try again.");
      return;
    }

    if (description.length > 1000) {
      await ctx.reply("❌ Description is too long (max 1000 characters). Please try again.");
      return;
    }

    if (!ctx.session.supportData) {
      logger.warn("Warning: supportData not found when entering description");
      ctx.session.supportData = { subject: "Untitled" };
    }

    ctx.session.supportData!.description = description.trim();
    ctx.session.supportStep = "select_priority";
    logger.info(`Support ticket description set: ${description.substring(0, 50)}...`);

    await ctx.reply(
      `<b>📝 Create Support Ticket</b>

What is the priority of your issue?`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📗 Low", callback_data: "support_priority_LOW" }],
            [{ text: "📙 Medium", callback_data: "support_priority_MEDIUM" }],
            [{ text: "📕 High", callback_data: "support_priority_HIGH" }],
          ],
        },
      }
    );
  } catch (error) {
    logger.error("Error processing complaint description:", error);
    await ctx.reply("❌ Error", { reply_markup: mainMenuKeyboard });
  }
}

/**
 * Handle priority selection
 */
export async function handleComplaintPriority(ctx: SessionContext, priority: string): Promise<void> {
  try {
    ctx.session.supportData!.priority = priority;
    ctx.session.supportData!.attachmentUrls = []; // Initialize file array
    ctx.session.supportStep = "upload_files";

    const { subject, description } = ctx.session.supportData;
    logger.info(`Support ticket priority selected: ${priority} for subject "${subject}"`);

    await ctx.reply(
      `<b>📝 Attach Files (Optional)</b>

You can now attach files to your complaint:
• Documents
• Photos
• Videos

Simply send files by tapping the attachment icon, or say <b>done</b> to continue without files.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Continue to Submit", callback_data: "support_skip_files" }],
            [{ text: "❌ Cancel", callback_data: "support_cancel" }],
          ],
        },
      }
    );
  } catch (error) {
    logger.error("Error processing priority:", error);
    await ctx.reply("❌ Error", { reply_markup: mainMenuKeyboard });
  }
}

/**
 * Handle skipping files or ready to confirm after uploads
 */
export async function handleReadyToConfirm(ctx: SessionContext): Promise<void> {
  try {
    ctx.session.supportStep = "confirm_before_submit";

    const { subject, description, priority, attachmentUrls } = ctx.session.supportData;
    const fileCount = attachmentUrls?.length || 0;
    const fileInfo = fileCount > 0 ? `\n<b>Files Attached:</b> ${fileCount} file(s)` : "\n<i>No files attached</i>";

    logger.info(`Support ticket ready for submission: ${subject}, files=${fileCount}`);

    await ctx.reply(
      `<b>📝 Review Your Complaint</b>

<b>Subject:</b> ${subject}

<b>Description:</b> ${description}

<b>Priority:</b> ${priority}${fileInfo}

Ready to submit?`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Submit Complaint", callback_data: "support_confirm_submit" }],
            [{ text: "❌ Cancel", callback_data: "support_cancel" }],
          ],
        },
      }
    );
  } catch (error) {
    logger.error("Error preparing confirmation:", error);
    await ctx.reply("❌ Error", { reply_markup: mainMenuKeyboard });
  }
}

/**
 * Handle file uploads during complaint creation
 */
export async function handleComplaintFileUpload(ctx: SessionContext): Promise<void> {
  try {
    if (!ctx.session.supportData) {
      ctx.session.supportData = { attachmentUrls: [] };
    }

    if (!ctx.session.supportData.attachmentUrls) {
      ctx.session.supportData.attachmentUrls = [];
    }

    let fileId: string | null = null;
    let fileName: string | null = null;

    // Handle different file types
    if (ctx.message?.document) {
      fileId = ctx.message.document.file_id;
      fileName = ctx.message.document.file_name || "document";
      logger.info(`Document attached: ${fileName}`);
    } else if (ctx.message?.photo && ctx.message.photo.length > 0) {
      // Use the highest resolution photo
      fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      fileName = "photo.jpg";
      logger.info("Photo attached");
    } else if (ctx.message?.video) {
      fileId = ctx.message.video.file_id;
      fileName = ctx.message.video.file_name || "video.mp4";
      logger.info(`Video attached: ${fileName}`);
    } else if (ctx.message?.audio) {
      fileId = ctx.message.audio.file_id;
      fileName = ctx.message.audio.file_name || "audio.mp3";
      logger.info(`Audio attached: ${fileName}`);
    }

    if (fileId) {
      ctx.session.supportData.attachmentUrls.push(fileId);
      const totalFiles = ctx.session.supportData.attachmentUrls.length;
      
      await ctx.reply(
        `✅ File attached! <b>(${totalFiles} file${totalFiles > 1 ? "s" : ""})</b>\n\nYou can attach more files or continue.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Continue to Submit", callback_data: "support_skip_files" }],
              [{ text: "❌ Cancel", callback_data: "support_cancel" }],
            ],
          },
        }
      );
    } else {
      await ctx.reply(
        "❌ Unsupported file type. Please send documents, photos, videos, or audio files."
      );
    }
  } catch (error) {
    logger.error("Error handling file upload:", error);
    await ctx.reply(
      "❌ Error uploading file. Please try again.",
      { reply_markup: mainMenuKeyboard }
    );
  }
}

/**
 * Handle submit complaint confirmation
 */
export async function handleSubmitComplaint(ctx: SessionContext): Promise<void> {
  try {
    const userId = ctx.session.userId;
    
    if (!userId || !ctx.session.supportData) {
      logger.warn("Invalid session data for complaint submission");
      await ctx.reply("❌ Error: Invalid session data. Please start over.", { reply_markup: mainMenuKeyboard });
      return;
    }

    const { subject, description, priority, attachmentUrls } = ctx.session.supportData;

    if (!subject || !description) {
      logger.warn(`Missing complaint fields: subject=${!!subject}, description=${!!description}`);
      await ctx.reply("❌ Error: Subject and description are required.", { reply_markup: mainMenuKeyboard });
      return;
    }

    logger.info(`Creating support ticket for user ${userId}: subject="${subject}", priority="${priority}", files=${attachmentUrls?.length || 0}`);
    const ticket = await SupportService.createTicket(userId, subject, description, attachmentUrls || [], priority || "MEDIUM");
    logger.info(`Support ticket created successfully: ID=${ticket.id}`);

    // Get user info for Telegram message
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // Send Telegram message to user
    try {
      if (user?.telegramId) {
        await ctx.api.sendMessage(
          Number(user.telegramId),
          `✅ <b>Ticket Created Successfully</b>\n\n<b>Ticket ID:</b> <code>${ticket.id}</code>\n<b>Subject:</b> ${subject}\n<b>Status:</b> OPEN\n\nAdmins will review your complaint shortly.`,
          { 
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "👁️ View Ticket", callback_data: `support_view_ticket_${ticket.id}` }],
                [{ text: "🏠 Back to Menu", callback_data: "back_to_menu" }]
              ]
            }
          }
        );
        logger.info(`Sent Telegram message to user ${userId} about ticket creation`);
      }
    } catch (error) {
      logger.error("Error sending Telegram message to user:", error);
    }

    // Notify user about successful submission (in-app)
    try {
      await NotificationService.createNotification(
        userId,
        "✅ Complaint Submitted",
        `Your support ticket \"${subject}\" has been submitted. Admins will review it shortly.`,
        "SUPPORT",
        undefined,
        undefined,
        ticket.id
      );
      logger.info(`Notified user ${userId} about complaint submission to ticket ${ticket.id}`);
    } catch (error) {
      logger.error("Error notifying user about complaint submission:", error);
    }

    // Send Telegram message to all admins (DB admins + fallback to ADMIN_IDS / ADMIN_CHAT_ID)
    try {
      const targets = new Set<string>();

      // Add admins from DB who have telegramId
      try {
        const admins = await prisma.user.findMany({ where: { isAdmin: true } });
        for (const admin of admins) {
          if (admin.telegramId) targets.add(admin.telegramId.toString());
        }
      } catch (err) {
        logger.warn("Could not load admins from DB for notifications:", err);
      }

      // Add ADMIN_IDS from env (comma-separated list)
      try {
        const envAdminIds = (config.ADMIN_IDS || "").split(",").map((s: string) => s.trim()).filter(Boolean);
        for (const id of envAdminIds) targets.add(id);
        if (envAdminIds.length > 0) {
          logger.info(`Loaded ${envAdminIds.length} admin IDs from environment`);
        }
      } catch (err) {
        logger.error("Error loading ADMIN_IDS from config:", err);
      }

      // Add ADMIN_CHAT_ID if configured
      try {
        const adminChatId = config.ADMIN_CHAT_ID;
        if (adminChatId) {
          targets.add(adminChatId.toString());
          logger.info(`Loaded ADMIN_CHAT_ID from environment: ${adminChatId}`);
        }
      } catch (err) {
        logger.error("Error loading ADMIN_CHAT_ID from config:", err);
      }

      if (targets.size === 0) {
        logger.warn("No admin targets configured - skipping Telegram admin notifications for support ticket");
      } else {
        const messageText = `📞 <b>New Support Ticket</b>\n\n<b>From:</b> ${user?.firstName} ${user?.lastName || ""}\n<b>Ticket ID:</b> <code>${ticket.id}</code>\n<b>Subject:</b> ${subject}\n<b>Priority:</b> ${priority || "MEDIUM"}`;

        for (const target of Array.from(targets)) {
          try {
            const chatId = Number(target);
            await ctx.api.sendMessage(
              chatId,
              messageText,
              {
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "👁️ View Ticket", callback_data: `admin_support_view_${ticket.id}` }],
                    [{ text: "📞 Support Panel", callback_data: "admin_support_dashboard" }]
                  ]
                }
              }
            );
            logger.info(`Sent Telegram support notification to admin chat ${target}`);
          } catch (err) {
            logger.error(`Failed to send Telegram support notification to ${target}:`, err);
          }
        }
      }
    } catch (error) {
      logger.error("Error sending Telegram messages to admins:", error);
    }

    // Notify all admins about new complaint (in-app)
    try {
      const admins = await prisma.user.findMany({ where: { isAdmin: true } });
      for (const admin of admins) {
        await NotificationService.createNotification(
          admin.id,
          "📞 New Support Ticket",
          `New complaint from user: \"${subject}\"`,
          "SUPPORT",
          undefined,
          undefined,
          ticket.id
        );
      }
      logger.info(`Notified ${admins.length} admin(s) about new support ticket ${ticket.id}`);
    } catch (error) {
      logger.error("Error notifying admins about new ticket:", error);
    }

    await ctx.reply(
      `✅ <b>Complaint Submitted Successfully</b>

<b>Ticket ID:</b> <code>${ticket.id}</code>

We will review your complaint and get back to you soon.
You will be notified when an admin responds.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📋 View My Tickets", callback_data: "support_my_tickets_page_1" }],
            [{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }],
          ],
        },
      }
    );

    delete ctx.session.supportData;
    delete ctx.session.supportStep;
  } catch (error) {
    logger.error("Error submitting complaint:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    await ctx.reply(
      `❌ Error submitting complaint:\n${errorMsg}\n\nPlease try again or contact support.`,
      { reply_markup: mainMenuKeyboard }
    );
  }
}

/**
 * View user's support tickets (with pagination)
 */
export async function handleMyTickets(ctx: SessionContext, page: number = 1): Promise<void> {
  try {
    const userId = ctx.session.userId;
    const limit = 5;
    const offset = (page - 1) * limit;

    const tickets = await SupportService.getTicketsByUser(userId, limit, offset);
    const totalCount = await SupportService.countUserTickets(userId);
    const totalPages = Math.ceil(totalCount / limit);

    if (tickets.length === 0) {
      await ctx.reply(
        `<b>📋 My Support Tickets</b>

You have no support tickets yet.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📝 Create New", callback_data: "support_new_complaint" }],
              [{ text: "🔙 Back", callback_data: "back_to_menu" }],
            ],
          },
        }
      );
      return;
    }

    let message = `<b>📋 My Support Tickets</b> (${totalCount} total)\n\n`;

    tickets.forEach((ticket, index) => {
      const statusEmoji = {
        OPEN: "🟢",
        IN_PROGRESS: "🟡",
        RESOLVED: "🟢",
        CLOSED: "⚫",
      };

      const status = statusEmoji[ticket.status as keyof typeof statusEmoji] || "❓";
      message += `${index + 1}. ${status} <b>${ticket.subject}</b>\n`;
      message += `   Status: ${ticket.status} | Messages: ${ticket.messageCount || 0}\n`;
      message += `   Created: ${new Date(ticket.createdAt).toLocaleDateString()}\n\n`;
    });

    const keyboard: any = [];

    // Add ticket buttons
    tickets.forEach((ticket) => {
      keyboard.push([
        {
          text: `${ticket.subject.substring(0, 30)}...`,
          callback_data: `support_view_ticket_${ticket.id}`,
        },
      ]);
    });

    // Add pagination
    if (totalPages > 1) {
      const paginationRow = [];
      if (page > 1) {
        paginationRow.push({
          text: "⬅️ Previous",
          callback_data: `support_my_tickets_page_${page - 1}`,
        });
      }
      paginationRow.push({
        text: `${page}/${totalPages}`,
        callback_data: "noop",
      });
      if (page < totalPages) {
        paginationRow.push({
          text: "Next ➡️",
          callback_data: `support_my_tickets_page_${page + 1}`,
        });
      }
      keyboard.push(paginationRow);
    }

    keyboard.push([{ text: "📝 New Ticket", callback_data: "support_new_complaint" }]);
    keyboard.push([{ text: "🔙 Back", callback_data: "back_to_menu" }]);

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error("Error fetching user tickets:", error);
    await ctx.reply("❌ Error loading tickets", { reply_markup: mainMenuKeyboard });
  }
}

/**
 * View specific ticket with conversation
 */
export async function handleViewTicket(ctx: SessionContext, ticketId: string): Promise<void> {
  try {
    const ticket = await SupportService.getTicketWithMessages(ticketId);

    if (!ticket) {
      await ctx.reply("❌ Ticket not found");
      return;
    }

    // Show ticket details
    let message = `<b>📌 Support Ticket</b>\n\n`;
    message += `<b>ID:</b> <code>${ticket.id}</code>\n`;
    message += `<b>Subject:</b> ${ticket.subject}\n`;
    message += `<b>Status:</b> ${ticket.status}\n`;
    message += `<b>Priority:</b> ${ticket.priority}\n`;
    message += `<b>Created:</b> ${new Date(ticket.createdAt).toLocaleDateString()}\n\n`;
    message += `<b>Description:</b>\n${ticket.description}\n\n`;
    message += `<b>Messages (${ticket.messages.length})</b>:\n`;
    message += "═".repeat(40) + "\n\n";

    // Show messages
    ticket.messages.forEach((msg: any) => {
      const senderLabel = msg.isAdminMessage ? "👨‍💼 Admin" : "👤 You";
      message += `<b>${msg.senderName || senderLabel}</b>\n`;
      message += `<i>${new Date(msg.createdAt).toLocaleString()}</i>\n`;
      message += `${msg.message}\n\n`;

      if (msg.attachmentUrls && msg.attachmentUrls.length > 0) {
        message += `📎 ${msg.attachmentUrls.length} file(s)\n\n`;
      }
    });

    ctx.session.viewingTicketId = ticketId;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📎 View Files", callback_data: `support_view_files_${ticketId}` },
            { text: "💬 Reply", callback_data: `support_reply_${ticketId}` },
          ],
          [{ text: "📋 Back to Tickets", callback_data: "support_my_tickets_page_1" }],
        ],
      },
    });
  } catch (error) {
    logger.error("Error viewing ticket:", error);
    await ctx.reply("❌ Error loading ticket", { reply_markup: mainMenuKeyboard });
  }
}

/**
 * Start reply to ticket
 */
export async function handleReplyToTicket(ctx: SessionContext, ticketId: string): Promise<void> {
  try {
    ctx.session.replyingToTicketId = ticketId;
    ctx.session.supportStep = "reply_message";

    await ctx.reply(
      `<b>💬 Reply to Support Ticket</b>

Type your message:`,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    logger.error("Error starting reply:", error);
    await ctx.reply("❌ Error", { reply_markup: mainMenuKeyboard });
  }
}

/**
 * Handle reply message submission
 */
export async function handleReplyMessage(ctx: SessionContext, message: string): Promise<void> {
  try {
    if (!message || message.trim().length === 0) {
      await ctx.reply("❌ Message cannot be empty. Please try again.");
      return;
    }

    const ticketId = ctx.session.replyingToTicketId;
    const userId = ctx.session.userId;

    if (!ticketId) {
      await ctx.reply("❌ Error: Ticket not found");
      return;
    }

    const ticket = await SupportService.getTicketWithMessages(ticketId);
    await SupportService.addMessage(ticketId, userId, "USER", message.trim());

    // Get user info
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // Send Telegram message to user
    try {
      if (user?.telegramId) {
        await ctx.api.sendMessage(
          Number(user.telegramId),
          `✅ <b>Your Reply Was Sent</b>\n\n<b>Ticket:</b> ${ticket.subject}\n<b>Ticket ID:</b> <code>${ticketId}</code>\n\nAdmins will review your reply shortly.`,
          { 
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "👁️ View Ticket", callback_data: `support_view_ticket_${ticketId}` }],
                [{ text: "🏠 Back to Menu", callback_data: "back_to_menu" }]
              ]
            }
          }
        );
        logger.info(`Sent Telegram message to user ${userId} about reply submission`);
      }
    } catch (error) {
      logger.error("Error sending Telegram message to user:", error);
    }

    // Notify user about successful reply (in-app)
    try {
      await NotificationService.createNotification(
        userId,
        "✅ Reply Sent",
        `Your reply to ticket \"${ticket.subject}\" has been submitted successfully.`,
        "SUPPORT",
        undefined,
        undefined,
        ticketId
      );
      logger.info(`Notified user ${userId} about reply submission to ticket ${ticketId}`);
    } catch (error) {
      logger.error("Error notifying user about reply submission:", error);
    }

    // Send Telegram message to all admins
    try {
      const admins = await prisma.user.findMany({ where: { isAdmin: true } });
      for (const admin of admins) {
        if (admin.telegramId) {
          try {
            await ctx.api.sendMessage(
              Number(admin.telegramId),
              `💬 <b>User Reply Received</b>\n\n<b>From:</b> ${user?.firstName} ${user?.lastName || ""}\n<b>Ticket ID:</b> <code>${ticketId}</code>\n<b>Subject:</b> ${ticket.subject}`,
              { 
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "👁️ View Ticket", callback_data: `admin_support_view_${ticketId}` }],
                    [{ text: "📞 Support Panel", callback_data: "admin_support_dashboard" }]
                  ]
                }
              }
            );
            logger.info(`Sent Telegram message to admin ${admin.id} about user reply`);
          } catch (error) {
            logger.error(`Failed to send Telegram message to admin ${admin.id}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error("Error sending Telegram messages to admins:", error);
    }

    // Notify all admins about user reply (in-app)
    try {
      const admins = await prisma.user.findMany({ where: { isAdmin: true } });
      for (const admin of admins) {
        await NotificationService.createNotification(
          admin.id,
          "💬 User Reply",
          `User replied to ticket: \"${ticket.subject}\"`,
          "SUPPORT",
          undefined,
          undefined,
          ticketId
        );
      }
      logger.info(`Notified ${admins.length} admin(s) about user reply to ticket ${ticketId}`);
    } catch (error) {
      logger.error("Error notifying admins about user reply:", error);
    }

    await ctx.reply(
      `✅ <b>Reply Sent</b>

Your message has been sent to the support team.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "👁️ View Ticket", callback_data: `support_view_ticket_${ticketId}` }],
            [{ text: "📋 Back to Tickets", callback_data: "support_my_tickets_page_1" }],
          ],
        },
      }
    );

    delete ctx.session.replyingToTicketId;
    delete ctx.session.supportStep;
  } catch (error) {
    logger.error("Error submitting reply:", error);
    await ctx.reply("❌ Error submitting reply. Please try again.", { reply_markup: mainMenuKeyboard });
  }
}

/**
 * Cancel support process
 */
export async function handleSupportCancel(ctx: SessionContext): Promise<void> {
  try {
    const subject = ctx.session.supportData?.subject || "Unknown";
    logger.info(`User cancelled support ticket creation for subject: "${subject}"`);
    
    delete ctx.session.supportData;
    delete ctx.session.supportStep;
    delete ctx.session.replyingToTicketId;
    delete ctx.session.viewingTicketId;

    await ctx.reply("❌ Cancelled. Returning to menu...", { reply_markup: mainMenuKeyboard });
  } catch (error) {
    logger.error("Error canceling support:", error);
    await ctx.reply("❌ Error", { reply_markup: mainMenuKeyboard });
  }
}

/**
 * View all files for user's ticket
 */
export async function handleViewUserTicketFiles(ctx: SessionContext, ticketId: string): Promise<void> {
  try {
    const ticket = await SupportService.getTicketWithMessages(ticketId);

    if (!ticket) {
      await ctx.reply("❌ Ticket not found");
      return;
    }

    // Count total files
    const complaintFileCount = ticket.attachmentUrls?.length || 0;
    let totalFiles = complaintFileCount;
    const messageFiles: any[] = [];

    for (const msg of ticket.messages) {
      const msgFiles = msg.attachmentUrls?.length || 0;
      if (msgFiles > 0) {
        messageFiles.push({
          message: msg,
          count: msgFiles,
        });
        totalFiles += msgFiles;
      }
    }

    if (totalFiles === 0) {
      await ctx.reply("📭 No files attached to this ticket", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Back to Ticket", callback_data: `support_view_ticket_${ticketId}` }],
          ],
        },
      });
      return;
    }

    let message = `<b>📎 Your Files</b>\n\n`;
    message += `<b>Total Files:</b> ${totalFiles}\n\n`;

    const keyboard: any = [];
    let fileIndex = 0;

    // Display initial complaint files
    if (complaintFileCount > 0) {
      message += `<b>📝 Your Complaint (${complaintFileCount} file${complaintFileCount > 1 ? "s" : ""}):</b>\n`;
      for (let i = 0; i < complaintFileCount; i++) {
        message += `  • File ${i + 1}\n`;
        keyboard.push([
          { text: `📥 File ${i + 1}`, callback_data: `support_file_${ticketId}_${fileIndex}` },
        ]);
        fileIndex++;
      }
      message += "\n";
    }

    // Display message attachment files
    for (const item of messageFiles) {
      const msg = item.message;
      const senderLabel = msg.isAdminMessage ? "👨‍💼 Admin Response" : "💬 Your Reply";
      message += `<b>${senderLabel} (${item.count} file${item.count > 1 ? "s" : ""}):</b>\n`;
      message += `<i>${new Date(msg.createdAt).toLocaleString()}</i>\n`;

      for (let i = 0; i < item.count; i++) {
        message += `  • File ${fileIndex + 1}\n`;
        keyboard.push([
          { text: `📥 File ${fileIndex + 1}`, callback_data: `support_file_${ticketId}_${fileIndex}` },
        ]);
        fileIndex++;
      }
      message += "\n";
    }

    keyboard.push([{ text: "💬 Reply", callback_data: `support_reply_${ticketId}` }]);
    keyboard.push([{ text: "🔙 Back to Ticket", callback_data: `support_view_ticket_${ticketId}` }]);

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } catch (error) {
    logger.error("Error viewing ticket files:", error);
    await ctx.reply("❌ Error loading files", { reply_markup: mainMenuKeyboard });
  }
}

/**
 * Helper to send a file using the appropriate method
 */
async function sendFile(ctx: any, fileId: string, caption: string): Promise<void> {
  const sendMethods = [
    () => ctx.replyWithDocument(fileId, { caption }),
    () => ctx.replyWithPhoto(fileId, { caption }),
    () => ctx.replyWithVideo(fileId, { caption }),
    () => ctx.replyWithAudio(fileId, { caption }),
    () => ctx.replyWithAnimation(fileId, { caption }),
    () => ctx.replyWithVoice(fileId, { caption }),
  ];

  let lastError: any = null;
  for (const sendMethod of sendMethods) {
    try {
      await sendMethod();
      return;
    } catch (error: any) {
      lastError = error;
      // Continue to next method
    }
  }
  
  // If all methods fail, throw the last error
  throw lastError;
}

/**
 * Download user ticket file
 */
export async function handleViewUserTicketFile(ctx: SessionContext, ticketId: string, fileIndex: string): Promise<void> {
  try {
    const ticket = await SupportService.getTicketWithMessages(ticketId);

    if (!ticket) {
      await ctx.reply("❌ Ticket not found");
      return;
    }

    const index = parseInt(fileIndex);
    
    // Check initial complaint files first
    if (index < (ticket.attachmentUrls?.length || 0)) {
      const fileId = ticket.attachmentUrls![index];
      try {
        await sendFile(ctx, fileId, `📎 File from your complaint (${index + 1}/${ticket.attachmentUrls?.length || 0})`);
      } catch (error) {
        logger.error(`Error sending file ${fileId}:`, error);
        await ctx.reply("❌ Error downloading file. File may have expired.");
      }
      return;
    }

    // Check message attachments
    let fileCount = ticket.attachmentUrls?.length || 0;
    for (const msg of ticket.messages) {
      const msgFileCount = msg.attachmentUrls?.length || 0;
      if (index < fileCount + msgFileCount) {
        const msgFileIndex = index - fileCount;
        const fileId = msg.attachmentUrls![msgFileIndex];
        try {
          const senderLabel = msg.isAdminMessage ? "Admin Response" : "Your Message";
          await sendFile(ctx, fileId, `📎 File from ${senderLabel} (${msgFileIndex + 1}/${msgFileCount})`);
        } catch (error) {
          logger.error(`Error sending file ${fileId}:`, error);
          await ctx.reply("❌ Error downloading file. File may have expired.");
        }
        return;
      }
      fileCount += msgFileCount;
    }

    await ctx.reply("❌ File not found");
  } catch (error) {
    logger.error("Error viewing ticket file:", error);
    await ctx.reply("❌ Error", { reply_markup: mainMenuKeyboard });
  }
}
