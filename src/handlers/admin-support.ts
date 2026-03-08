import { Context } from "grammy";
import SupportService from "../services/support.js";
import { NotificationService } from "../services/notification.js";
import prisma from "../db/client.js";
import logger from "../config/logger.js";
import { adminMenuKeyboard } from "../utils/keyboard.js";

type SessionContext = Context & { session: any };

/**
 * Show admin support dashboard
 */
export async function handleAdminSupportDashboard(ctx: SessionContext): Promise<void> {
  try {
    const openCount = await SupportService.countOpenTickets();
    const allCount = await SupportService.countAllTickets();

    const message = `<b>📞 Support Management</b>

<b>Tickets Overview:</b>
• Open: 🟢 ${openCount}
• Total: ${allCount}

Select an action:`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🟢 Open Tickets", callback_data: "admin_support_status_OPEN_page_1" }],
          [{ text: "🟡 In Progress", callback_data: "admin_support_status_IN_PROGRESS_page_1" }],
          [{ text: "✅ All Tickets", callback_data: "admin_support_all_page_1" }],
          [{ text: "🔙 Back to Dashboard", callback_data: "back_to_admin" }],
        ],
      },
    });
  } catch (error) {
    logger.error("Error showing support dashboard:", error);
    await ctx.reply("❌ Error loading support dashboard", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * View tickets with filter (status or all)
 */
export async function handleViewSupportTickets(
  ctx: SessionContext,
  status: string | null,
  page: number = 1
): Promise<void> {
  try {
    const limit = 5;
    const offset = (page - 1) * limit;

    let tickets;
    let totalCount;

    if (status) {
      tickets = await SupportService.getAllTickets(limit, offset, status);
      totalCount = await SupportService.countAllTickets(status);
    } else {
      tickets = await SupportService.getAllTickets(limit, offset);
      totalCount = await SupportService.countAllTickets();
    }

    const totalPages = Math.ceil(totalCount / limit);

    if (tickets.length === 0) {
      await ctx.reply(
        `<b>📋 Support Tickets</b>

No tickets found.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Back", callback_data: "admin_support_dashboard" }],
            ],
          },
        }
      );
      return;
    }

    let message = `<b>📋 Support Tickets</b>\n`;
    if (status) {
      message += `Status: ${status}\n`;
    }
    message += `(${(page - 1) * limit + 1}-${Math.min(page * limit, totalCount)} of ${totalCount})\n\n`;

    const keyboard: any = [];

    tickets.forEach((ticket) => {
      const statusEmoji = {
        OPEN: "🟢",
        IN_PROGRESS: "🟡",
        RESOLVED: "✅",
        CLOSED: "⚫",
      };

      const status = statusEmoji[ticket.status as keyof typeof statusEmoji] || "❓";
      message += `${status} <b>${ticket.subject}</b>\n`;
      message += `   User: ${ticket.userDetails?.firstName} ${ticket.userDetails?.lastName || ""}\n`;
      message += `   Messages: ${ticket.messageCount || 0}\n`;
      message += `   Created: ${new Date(ticket.createdAt).toLocaleDateString()}\n\n`;

      keyboard.push([
        {
          text: `${ticket.subject.substring(0, 25)}...`,
          callback_data: `admin_support_view_${ticket.id}`,
        },
      ]);
    });

    // Add pagination
    if (totalPages > 1) {
      const paginationRow = [];
      if (page > 1) {
        const statusPart = status ? `_status_${status}` : "";
        paginationRow.push({
          text: "⬅️ Previous",
          callback_data: `admin_support${statusPart}_page_${page - 1}`,
        });
      }
      paginationRow.push({
        text: `${page}/${totalPages}`,
        callback_data: "noop",
      });
      if (page < totalPages) {
        const statusPart = status ? `_status_${status}` : "";
        paginationRow.push({
          text: "Next ➡️",
          callback_data: `admin_support${statusPart}_page_${page + 1}`,
        });
      }
      keyboard.push(paginationRow);
    }

    keyboard.push([{ text: "🔙 Back", callback_data: "admin_support_dashboard" }]);

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error("Error fetching support tickets:", error);
    await ctx.reply("❌ Error loading tickets", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * View specific ticket for admin
 */
export async function handleAdminViewTicket(ctx: SessionContext, ticketId: string): Promise<void> {
  try {
    const ticket = await SupportService.getTicketWithMessages(ticketId);

    if (!ticket) {
      await ctx.reply("❌ Ticket not found");
      return;
    }

    let message = `<b>📌 Support Ticket</b>\n\n`;
    message += `<b>ID:</b> <code>${ticket.id}</code>\n`;
    message += `<b>User:</b> ${ticket.user.firstName} ${ticket.user.lastName || ""}\n`;
    message += `<b>Telegram ID:</b> <code>${ticket.user.telegramId}</code>\n`;
    message += `<b>Email:</b> ${ticket.user.email || "Not provided"}\n\n`;
    message += `<b>Subject:</b> ${ticket.subject}\n`;
    message += `<b>Status:</b> ${ticket.status}\n`;
    message += `<b>Priority:</b> ${ticket.priority}\n`;
    message += `<b>Created:</b> ${new Date(ticket.createdAt).toLocaleDateString()}\n\n`;
    message += `<b>Description:</b>\n${ticket.description}\n\n`;

    if (ticket.messages.length > 0) {
      message += `<b>Messages (${ticket.messages.length})</b>:\n`;
      message += "═".repeat(40) + "\n\n";

      ticket.messages.forEach((msg: any, index: number) => {
        const senderLabel = msg.isAdminMessage ? "👨‍💼 Admin" : "👤 User";
        message += `<b>${index + 1}. ${msg.senderName || senderLabel}</b>\n`;
        message += `<i>${new Date(msg.createdAt).toLocaleString()}</i>\n`;
        message += `${msg.message}\n`;

        if (msg.attachmentUrls && msg.attachmentUrls.length > 0) {
          message += `📎 <b>${msg.attachmentUrls.length} file(s) attached</b>\n`;
        }
        message += "\n";
      });
    }

    // Display initial complaint attachments if any
    if (ticket.attachmentUrls && ticket.attachmentUrls.length > 0) {
      message += `\n<b>📎 Initial Complaint Files:</b> ${ticket.attachmentUrls.length} file(s)\n`;
    }

    ctx.session.viewingTicketId = ticketId;

    // Build keyboard - only main action buttons
    const keyboard = [
      [
        { text: "📎 View Files", callback_data: `admin_support_files_${ticketId}` },
        { text: "📝 Reply", callback_data: `admin_support_reply_${ticketId}` },
      ],
      [
        { text: "🔄 Status", callback_data: `admin_support_edit_status_${ticketId}` },
        { text: "⚡ Priority", callback_data: `admin_support_edit_priority_${ticketId}` },
      ],
      [
        { text: "✅ Mark Resolved", callback_data: `admin_support_resolve_${ticketId}` },
        { text: "🔙 Back to Tickets", callback_data: "admin_support_dashboard" },
      ],
    ];

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } catch (error) {
    logger.error("Error viewing support ticket:", error);
    await ctx.reply("❌ Error loading ticket", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Start admin reply
 */
export async function handleAdminReplyStart(ctx: SessionContext, ticketId: string): Promise<void> {
  try {
    ctx.session.replyingToTicketId = ticketId;
    ctx.session.supportStep = "admin_reply_message";
    ctx.session.adminReplyData = { attachmentUrls: [] }; // Initialize file array

    await ctx.reply(
      `<b>💬 Reply to User</b>

Type your response:`,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    logger.error("Error starting admin reply:", error);
    await ctx.reply("❌ Error", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Store admin message and transition to file upload step
 */
export async function handleAdminReplyStoreMessage(ctx: SessionContext, message: string): Promise<void> {
  try {
    if (!message || message.trim().length === 0) {
      await ctx.reply("❌ Message cannot be empty. Please try again.");
      return;
    }

    ctx.session.adminReplyData!.message = message.trim();
    ctx.session.supportStep = "admin_reply_upload_files";

    logger.info(`Admin reply message stored: ${message.substring(0, 50)}...`);

    await ctx.reply(
      `<b>💬 Attach Files (Optional)</b>

You can now attach files to your response:
• Documents
• Photos  
• Videos

Simply send files, or say <b>done</b> to send the reply.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📤 Send Reply", callback_data: `admin_support_send_reply_${ctx.session.replyingToTicketId}` }],
            [{ text: "❌ Cancel", callback_data: "admin_support_dashboard" }],
          ],
        },
      }
    );
  } catch (error) {
    logger.error("Error storing admin reply:", error);
    await ctx.reply("❌ Error", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Handle admin reply file uploads

 */
export async function handleAdminReplyFileUpload(ctx: SessionContext): Promise<void> {
  try {
    if (!ctx.session.adminReplyData) {
      ctx.session.adminReplyData = { attachmentUrls: [] };
    }

    if (!ctx.session.adminReplyData.attachmentUrls) {
      ctx.session.adminReplyData.attachmentUrls = [];
    }

    let fileId: string | null = null;
    let fileName: string | null = null;

    // Handle different file types
    if (ctx.message?.document) {
      fileId = ctx.message.document.file_id;
      fileName = ctx.message.document.file_name || "document";
      logger.info(`Admin document attached: ${fileName}`);
    } else if (ctx.message?.photo && ctx.message.photo.length > 0) {
      fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      fileName = "photo.jpg";
      logger.info("Admin photo attached");
    } else if (ctx.message?.video) {
      fileId = ctx.message.video.file_id;
      fileName = ctx.message.video.file_name || "video.mp4";
      logger.info(`Admin video attached: ${fileName}`);
    } else if (ctx.message?.audio) {
      fileId = ctx.message.audio.file_id;
      fileName = ctx.message.audio.file_name || "audio.mp3";
      logger.info(`Admin audio attached: ${fileName}`);
    }

    if (fileId) {
      ctx.session.adminReplyData.attachmentUrls.push(fileId);
      const totalFiles = ctx.session.adminReplyData.attachmentUrls.length;
      
      await ctx.reply(
        `✅ File attached! <b>(${totalFiles} file${totalFiles > 1 ? "s" : ""})</b>\n\nYou can attach more files or send the reply.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📤 Send Reply", callback_data: `admin_support_send_reply_${ctx.session.replyingToTicketId}` }],
              [{ text: "❌ Cancel", callback_data: "admin_support_dashboard" }],
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
    logger.error("Error handling admin file upload:", error);
    await ctx.reply(
      "❌ Error uploading file. Please try again.",
      { reply_markup: adminMenuKeyboard }
    );
  }
}

/**
 * Handle admin reply submission
 */
export async function handleAdminReplySubmit(ctx: SessionContext, message: string): Promise<void> {
  try {
    if (!message || message.trim().length === 0) {
      await ctx.reply("❌ Message cannot be empty. Please try again.");
      return;
    }

    const ticketId = ctx.session.replyingToTicketId;
    const adminId = ctx.session.userId;
    const files = ctx.session.adminReplyData?.attachmentUrls || [];

    if (!ticketId) {
      logger.warn("Error: Ticket ID not found in session");
      await ctx.reply("❌ Error: Ticket not found");
      return;
    }

    logger.info(`Admin ${adminId} replying to ticket ${ticketId} with ${files.length} files`);
    await SupportService.addMessage(ticketId, adminId, "ADMIN", message.trim(), files);

    // Update ticket status to IN_PROGRESS if it's OPEN
    const ticket = await SupportService.getTicketWithMessages(ticketId);
    if (ticket.status === "OPEN") {
      await SupportService.updateTicketStatus(ticketId, "IN_PROGRESS");
    }

    // Get user info for Telegram message
    const ticketUser = await prisma.user.findUnique({ where: { id: ticket.userId } });

    // Send Telegram message to user
    try {
      if (ticketUser?.telegramId) {
        const fileCount = files.length > 0 ? ` with ${files.length} file(s)` : "";
        await ctx.api.sendMessage(
          Number(ticketUser.telegramId),
          `📞 <b>Admin Reply Received</b>\n\n<b>Ticket:</b> ${ticket.subject}\n<b>Ticket ID:</b> <code>${ticketId}</code>\n\n${fileCount}\n\nAdmins will review your reply shortly.`,
          { 
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "👁️ View Ticket", callback_data: `support_view_ticket_${ticketId}` }],                [{ text: "🚀 Begin Trading", callback_data: "start_new_investment" }],                [{ text: "🏠 Back to Menu", callback_data: "back_to_menu" }]
              ]
            }
          }
        );
        logger.info(`Sent Telegram message to user ${ticket.userId} about admin response`);
      }
    } catch (error) {
      logger.error("Error sending Telegram message to user:", error);
    }

    // Notify user about admin response (in-app)
    try {
      await NotificationService.createNotification(
        ticket.userId,
        "📞 Support Response",
        `You just got a response from admin on your ticket: \"${ticket.subject}\"`,
        "SUPPORT",
        undefined,
        undefined,
        ticketId
      );
      logger.info(`Notified user ${ticket.userId} about admin response to ticket ${ticketId}`);
    } catch (error) {
      logger.error("Error notifying user about admin response:", error);
    }

    const fileInfo = files.length > 0 ? ` with ${files.length} file(s)` : "";
    await ctx.reply(
      `✅ <b>Reply Sent to User</b>

Your response${fileInfo} has been recorded.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "👁️ View Ticket", callback_data: `admin_support_view_${ticketId}` }],
            [{ text: "🔙 Back to Tickets", callback_data: "admin_support_dashboard" }],
          ],
        },
      }
    );

    delete ctx.session.replyingToTicketId;
    delete ctx.session.supportStep;
    delete ctx.session.adminReplyData;
  } catch (error) {
    logger.error("Error submitting admin reply:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    await ctx.reply(
      `❌ Error submitting reply:\n${errorMsg}`,
      { reply_markup: adminMenuKeyboard }
    );
  }
}

/**
 * Edit ticket status
 */
export async function handleEditTicketStatus(ctx: SessionContext, ticketId: string): Promise<void> {
  try {
    const ticket = await SupportService.getTicketWithMessages(ticketId);

    const message = `<b>📊 Change Ticket Status</b>

Current Status: <b>${ticket.status}</b>

Select new status:`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🟢 Open", callback_data: `admin_support_set_status_OPEN_${ticketId}` }],
          [{ text: "🟡 In Progress", callback_data: `admin_support_set_status_IN_PROGRESS_${ticketId}` }],
          [{ text: "✅ Resolved", callback_data: `admin_support_set_status_RESOLVED_${ticketId}` }],
          [{ text: "⚫ Closed", callback_data: `admin_support_set_status_CLOSED_${ticketId}` }],
          [{ text: "🔙 Back", callback_data: `admin_support_view_${ticketId}` }],
        ],
      },
    });
  } catch (error) {
    logger.error("Error editing ticket status:", error);
    await ctx.reply("❌ Error", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Set ticket status
 */
export async function handleSetTicketStatus(ctx: SessionContext, status: string, ticketId: string): Promise<void> {
  try {
    const ticket = await SupportService.getTicketWithMessages(ticketId);
    await SupportService.updateTicketStatus(ticketId, status);

    // Get user info for Telegram message
    const ticketUser = await prisma.user.findUnique({ where: { id: ticket.userId } });

    // Send Telegram message to user
    try {
      if (ticketUser?.telegramId) {
        await ctx.api.sendMessage(
          Number(ticketUser.telegramId),
          `📊 <b>Ticket Status Updated</b>\n\n<b>Ticket:</b> ${ticket.subject}\n<b>Ticket ID:</b> <code>${ticketId}</code>\n<b>New Status:</b> <b>${status}</b>`,
          { 
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "👁️ View Ticket", callback_data: `support_view_ticket_${ticketId}` }],                [{ text: "🚀 Begin Trading", callback_data: "start_new_investment" }],                [{ text: "🏠 Back to Menu", callback_data: "back_to_menu" }]
              ]
            }
          }
        );
        logger.info(`Sent Telegram message to user ${ticket.userId} about status change`);
      }
    } catch (error) {
      logger.error("Error sending Telegram message to user:", error);
    }

    // Notify user about status change (in-app)
    try {
      await NotificationService.createNotification(
        ticket.userId,
        "📊 Ticket Status Updated",
        `Your support ticket \"${ticket.subject}\" status has been changed to: ${status}`,
        "SUPPORT",
        undefined,
        undefined,
        ticketId
      );
      logger.info(`Notified user ${ticket.userId} about status change for ticket ${ticketId}`);
    } catch (error) {
      logger.error("Error notifying user about status change:", error);
    }

    await ctx.reply(
      `✅ <b>Status Updated</b>

Ticket status changed to: <b>${status}</b>
User has been notified.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "👁️ View Ticket", callback_data: `admin_support_view_${ticketId}` }],
            [{ text: "🔙 Back to Tickets", callback_data: "admin_support_dashboard" }],
          ],
        },
      }
    );
  } catch (error) {
    logger.error("Error setting ticket status:", error);
    await ctx.reply("❌ Error updating status", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Edit ticket priority
 */
export async function handleEditTicketPriority(ctx: SessionContext, ticketId: string): Promise<void> {
  try {
    const ticket = await SupportService.getTicketWithMessages(ticketId);

    const message = `<b>⚡ Change Ticket Priority</b>

Current Priority: <b>${ticket.priority}</b>

Select new priority:`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📗 Low", callback_data: `admin_support_set_priority_LOW_${ticketId}` }],
          [{ text: "📙 Medium", callback_data: `admin_support_set_priority_MEDIUM_${ticketId}` }],
          [{ text: "📕 High", callback_data: `admin_support_set_priority_HIGH_${ticketId}` }],
          [{ text: "🔙 Back", callback_data: `admin_support_view_${ticketId}` }],
        ],
      },
    });
  } catch (error) {
    logger.error("Error editing ticket priority:", error);
    await ctx.reply("❌ Error", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Set ticket priority
 */
export async function handleSetTicketPriority(ctx: SessionContext, priority: string, ticketId: string): Promise<void> {
  try {
    const ticket = await SupportService.getTicketWithMessages(ticketId);
    await SupportService.updateTicketPriority(ticketId, priority);

    // Get user info for Telegram message
    const ticketUser = await prisma.user.findUnique({ where: { id: ticket.userId } });

    // Send Telegram message to user
    try {
      if (ticketUser?.telegramId) {
        await ctx.api.sendMessage(
          Number(ticketUser.telegramId),
          `⚡ <b>Ticket Priority Updated</b>\n\n<b>Ticket:</b> ${ticket.subject}\n<b>Ticket ID:</b> <code>${ticketId}</code>\n<b>New Priority:</b> <b>${priority}</b>`,
          { 
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "👁️ View Ticket", callback_data: `support_view_ticket_${ticketId}` }],
                [{ text: "🚀 Begin Trading", callback_data: "start_new_investment" }],
                [{ text: "🏠 Back to Menu", callback_data: "back_to_menu" }]
              ]
            }
          }
        );
        logger.info(`Sent Telegram message to user ${ticket.userId} about priority change`);
      }
    } catch (error) {
      logger.error("Error sending Telegram message to user:", error);
    }

    // Notify user about priority change (in-app)
    try {
      await NotificationService.createNotification(
        ticket.userId,
        "⚡ Ticket Priority Updated",
        `Your support ticket \"${ticket.subject}\" priority has been set to: ${priority}`,
        "SUPPORT",
        undefined,
        undefined,
        ticketId
      );
      logger.info(`Notified user ${ticket.userId} about priority change for ticket ${ticketId}`);
    } catch (error) {
      logger.error("Error notifying user about priority change:", error);
    }

    await ctx.reply(
      `✅ <b>Priority Updated</b>

Ticket priority changed to: <b>${priority}</b>
User has been notified.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "👁️ View Ticket", callback_data: `admin_support_view_${ticketId}` }],
            [{ text: "🔙 Back to Tickets", callback_data: "admin_support_dashboard" }],
          ],
        },
      }
    );
  } catch (error) {
    logger.error("Error setting ticket priority:", error);
    await ctx.reply("❌ Error updating priority", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Mark ticket as resolved
 */
export async function handleMarkTicketResolved(ctx: SessionContext, ticketId: string): Promise<void> {
  try {
    const ticket = await SupportService.getTicketWithMessages(ticketId);
    await SupportService.updateTicketStatus(ticketId, "RESOLVED");

    // Get user info for Telegram message
    const ticketUser = await prisma.user.findUnique({ where: { id: ticket.userId } });

    // Send Telegram message to user
    try {
      if (ticketUser?.telegramId) {
        await ctx.api.sendMessage(
          Number(ticketUser.telegramId),
          `✅ <b>Ticket Resolved</b>\n\n<b>Ticket:</b> ${ticket.subject}\n<b>Ticket ID:</b> <code>${ticketId}</code>\n\nYour support ticket has been marked as resolved. Thank you for contacting us!`,
          { 
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "👁️ View Ticket", callback_data: `support_view_ticket_${ticketId}` }],
                [{ text: "🚀 Begin Trading", callback_data: "start_new_investment" }],
                [{ text: "🏠 Back to Menu", callback_data: "back_to_menu" }]
              ]
            }
          }
        );
        logger.info(`Sent Telegram message to user ${ticket.userId} about ticket resolution`);
      }
    } catch (error) {
      logger.error("Error sending Telegram message to user:", error);
    }

    // Notify user about ticket resolution (in-app)
    try {
      await NotificationService.createNotification(
        ticket.userId,
        "✅ Ticket Resolved",
        `Your support ticket \"${ticket.subject}\" has been marked as resolved. Thank you for contacting us!`,
        "SUPPORT",
        undefined,
        undefined,
        ticketId
      );
      logger.info(`Notified user ${ticket.userId} about ticket resolution for ticket ${ticketId}`);
    } catch (error) {
      logger.error("Error notifying user about ticket resolution:", error);
    }

    await ctx.reply(
      `✅ <b>Ticket Resolved</b>

The user has been notified that their ticket has been resolved.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Back to Tickets", callback_data: "admin_support_dashboard" }],
          ],
        },
      }
    );
  } catch (error) {
    logger.error("Error marking ticket resolved:", error);
    await ctx.reply("❌ Error resolving ticket", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * View all attached files for a ticket
 */
export async function handleViewTicketFiles(ctx: SessionContext, ticketId: string): Promise<void> {
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
            [{ text: "🔙 Back to Ticket", callback_data: `admin_support_view_${ticketId}` }],
          ],
        },
      });
      return;
    }

    let message = `<b>📎 Ticket Files</b>\n\n`;
    message += `<b>Total Files:</b> ${totalFiles}\n\n`;

    const keyboard: any = [];
    let fileIndex = 0;

    // Display initial complaint files
    if (complaintFileCount > 0) {
      message += `<b>📝 Initial Complaint (${complaintFileCount} file${complaintFileCount > 1 ? "s" : ""}):</b>\n`;
      for (let i = 0; i < complaintFileCount; i++) {
        message += `  • File ${i + 1}\n`;
        keyboard.push([
          { text: `📥 File ${i + 1}`, callback_data: `admin_support_file_${ticketId}_${fileIndex}` },
        ]);
        fileIndex++;
      }
      message += "\n";
    }

    // Display message attachment files
    for (const item of messageFiles) {
      const msg = item.message;
      const senderLabel = msg.isAdminMessage ? "👨‍💼 Admin Response" : "👤 User Message";
      message += `<b>${senderLabel} (${item.count} file${item.count > 1 ? "s" : ""}):</b>\n`;
      message += `<i>${new Date(msg.createdAt).toLocaleString()}</i>\n`;

      for (let i = 0; i < item.count; i++) {
        message += `  • File ${fileIndex + 1}\n`;
        keyboard.push([
          { text: `📥 File ${fileIndex + 1}`, callback_data: `admin_support_file_${ticketId}_${fileIndex}` },
        ]);
        fileIndex++;
      }
      message += "\n";
    }

    keyboard.push([{ text: "📝 Reply", callback_data: `admin_support_reply_${ticketId}` }]);
    keyboard.push([{ text: "🔙 Back to Ticket", callback_data: `admin_support_view_${ticketId}` }]);

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } catch (error) {
    logger.error("Error viewing ticket files:", error);
    await ctx.reply("❌ Error loading files", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * View and download file from ticket
 */
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

export async function handleViewTicketFile(ctx: SessionContext, ticketId: string, fileIndex: string): Promise<void> {
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
        await sendFile(ctx, fileId, `📎 File from initial complaint (${index + 1}/${ticket.attachmentUrls?.length || 0})`);
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
          const senderLabel = msg.isAdminMessage ? "Admin Response" : "User Message";
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
    await ctx.reply("❌ Error", { reply_markup: adminMenuKeyboard });
  }
}
