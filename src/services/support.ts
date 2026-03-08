import prisma from "../db/client.js";
import logger from "../config/logger.js";
import { formatCurrency } from "../lib/helpers.js";

export interface SupportTicketData {
  id: string;
  userId: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  attachmentUrls: string[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  userDetails?: {
    firstName?: string;
    lastName?: string;
    telegramId: string;
    email?: string;
  };
  messageCount?: number;
  lastMessage?: {
    message: string;
    senderType: string;
    createdAt: Date;
  };
}

export interface SupportMessageData {
  id: string;
  ticketId: string;
  senderId: string;
  senderType: string;
  senderName?: string;
  message: string;
  attachmentUrls: string[];
  isAdminMessage: boolean;
  createdAt: Date;
}

export class SupportService {
  /**
   * Create a new support ticket from user
   */
  static async createTicket(
    userId: string,
    subject: string,
    description: string,
    attachmentUrls: string[] = [],
    priority: string = "MEDIUM"
  ): Promise<SupportTicketData> {
    try {
      const ticket = await (prisma as any).supportTicket.create({
        data: {
          userId,
          subject,
          description,
          attachmentUrls,
          priority,
          status: "OPEN",
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              telegramId: true,
            },
          },
        },
      });

      logger.info(`✅ Support ticket created: ${ticket.id} by user ${userId}`);
      return ticket as SupportTicketData;
    } catch (error) {
      logger.error("Error creating support ticket:", error);
      throw error;
    }
  }

  /**
   * Get all tickets for a user
   */
  static async getTicketsByUser(userId: string, limit: number = 10, offset: number = 0): Promise<SupportTicketData[]> {
    try {
      const tickets = await (prisma as any).supportTicket.findMany({
        where: { userId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              telegramId: true,
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      });

      return tickets.map((ticket: any) => ({
        ...ticket,
        messageCount: ticket.messages.length,
        lastMessage: ticket.messages[0]
          ? {
              message: ticket.messages[0].message,
              senderType: ticket.messages[0].senderType,
              createdAt: ticket.messages[0].createdAt,
            }
          : undefined,
      })) as SupportTicketData[];
    } catch (error) {
      logger.error("Error fetching user tickets:", error);
      throw error;
    }
  }

  /**
   * Count user's tickets
   */
  static async countUserTickets(userId: string): Promise<number> {
    try {
      return await (prisma as any).supportTicket.count({ where: { userId } });
    } catch (error) {
      logger.error("Error counting user tickets:", error);
      throw error;
    }
  }

  /**
   * Get all tickets for admin (with pagination)
   */
  static async getAllTickets(limit: number = 10, offset: number = 0, status?: string): Promise<SupportTicketData[]> {
    try {
      const where = status ? { status } : {};

      const tickets = await (prisma as any).supportTicket.findMany({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              telegramId: true,
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      });

      return tickets.map((ticket: any) => ({
        ...ticket,
        messageCount: ticket.messages.length,
        lastMessage: ticket.messages[0]
          ? {
              message: ticket.messages[0].message,
              senderType: ticket.messages[0].senderType,
              createdAt: ticket.messages[0].createdAt,
            }
          : undefined,
      })) as SupportTicketData[];
    } catch (error) {
      logger.error("Error fetching all tickets:", error);
      throw error;
    }
  }

  /**
   * Count all tickets (with optional status filter)
   */
  static async countAllTickets(status?: string): Promise<number> {
    try {
      const where = status ? { status } : {};
      return await (prisma as any).supportTicket.count({ where });
    } catch (error) {
      logger.error("Error counting tickets:", error);
      throw error;
    }
  }

  /**
   * Get a specific ticket with all messages
   */
  static async getTicketWithMessages(ticketId: string): Promise<any> {
    try {
      const ticket = await (prisma as any).supportTicket.findUnique({
        where: { id: ticketId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              telegramId: true,
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              sender: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      return ticket;
    } catch (error) {
      logger.error("Error fetching ticket with messages:", error);
      throw error;
    }
  }

  /**
   * Add a message to a ticket
   */
  static async addMessage(
    ticketId: string,
    senderId: string,
    senderType: "USER" | "ADMIN",
    message: string,
    attachmentUrls: string[] = []
  ): Promise<SupportMessageData> {
    try {
      // Get sender info
      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { firstName: true, lastName: true },
      });

      const senderName = sender ? `${sender.firstName} ${sender.lastName || ""}`.trim() : "Unknown";

      const newMessage = await (prisma as any).supportMessage.create({
        data: {
          ticketId,
          senderId,
          senderType,
          senderName,
          message,
          attachmentUrls,
          isAdminMessage: senderType === "ADMIN",
        },
      });

      // Update ticket's updatedAt
      await (prisma as any).supportTicket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() },
      });

      logger.info(`✅ Message added to ticket ${ticketId} by ${senderType}`);
      return newMessage as SupportMessageData;
    } catch (error) {
      logger.error("Error adding message:", error);
      throw error;
    }
  }

  /**
   * Update ticket status
   */
  static async updateTicketStatus(ticketId: string, status: string): Promise<SupportTicketData> {
    try {
      const updateData: any = { status };

      if (status === "RESOLVED") {
        updateData.resolvedAt = new Date();
      } else if (status === "CLOSED") {
        updateData.closedAt = new Date();
      }

      const ticket = await (prisma as any).supportTicket.update({
        where: { id: ticketId },
        data: updateData,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              telegramId: true,
            },
          },
        },
      });

      logger.info(`✅ Ticket ${ticketId} status updated to ${status}`);
      return ticket as SupportTicketData;
    } catch (error) {
      logger.error("Error updating ticket status:", error);
      throw error;
    }
  }

  /**
   * Update ticket priority
   */
  static async updateTicketPriority(ticketId: string, priority: string): Promise<SupportTicketData> {
    try {
      const ticket = await (prisma as any).supportTicket.update({
        where: { id: ticketId },
        data: { priority },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              telegramId: true,
            },
          },
        },
      });

      logger.info(`✅ Ticket ${ticketId} priority updated to ${priority}`);
      return ticket as SupportTicketData;
    } catch (error) {
      logger.error("Error updating ticket priority:", error);
      throw error;
    }
  }

  /**
   * Count open tickets (for admin notification)
   */
  static async countOpenTickets(): Promise<number> {
    try {
      return await (prisma as any).supportTicket.count({
        where: { status: "OPEN" },
      });
    } catch (error) {
      logger.error("Error counting open tickets:", error);
      throw error;
    }
  }

  /**
   * Get open tickets (for admin dashboard)
   */
  static async getOpenTickets(): Promise<SupportTicketData[]> {
    try {
      const tickets = await (prisma as any).supportTicket.findMany({
        where: { status: "OPEN" },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              telegramId: true,
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      return tickets.map((ticket: any) => ({
        ...ticket,
        messageCount: ticket.messages.length,
      })) as SupportTicketData[];
    } catch (error) {
      logger.error("Error fetching open tickets:", error);
      throw error;
    }
  }

  /**
   * Format ticket for display
   */
  static formatTicketMessage(ticket: any): string {
    const statusEmoji = {
      OPEN: "🟢",
      IN_PROGRESS: "🟡",
      RESOLVED: "🟢",
      CLOSED: "⚫",
    };

    const priorityEmoji = {
      LOW: "📗",
      MEDIUM: "📙",
      HIGH: "📕",
    };

    const statusText = statusEmoji[ticket.status as keyof typeof statusEmoji] || "❓";
    const priorityText = priorityEmoji[ticket.priority as keyof typeof priorityEmoji] || "❓";

    return `${statusText} <b>${ticket.subject}</b>

<b>Status:</b> ${ticket.status}
${priorityText} <b>Priority:</b> ${ticket.priority}
<b>Created:</b> ${new Date(ticket.createdAt).toLocaleDateString()}
<b>Messages:</b> ${ticket.messageCount || 0}`;
  }

  /**
   * Format message for display
   */
  static formatMessageDisplay(message: any, senderName?: string): string {
    const senderLabel = message.isAdminMessage ? "👨‍💼 Admin" : "👤 You";
    const badge = message.senderType === "ADMIN" ? "🛡️" : "💬";

    let display = `${badge} <b>${message.senderName || senderLabel}</b> (${new Date(message.createdAt).toLocaleString()}):\n\n`;
    display += message.message;

    if (message.attachmentUrls && message.attachmentUrls.length > 0) {
      display += `\n\n📎 <b>Attachments:</b> ${message.attachmentUrls.length} file(s)`;
    }

    return display;
  }
}

export default SupportService;
