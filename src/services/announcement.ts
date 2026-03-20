import prisma from "../db/client.js";
import { delay } from "../lib/helpers.js";
import logger from "../config/logger.js";
import { config } from "../config/env.js";

export class AnnouncementService {
  /**
   * Create announcement
   */
  static async createAnnouncement(data: {
    title: string;
    message: string;
    targetType: string;
    targetUserIds?: string[];
    sentById: string;
    mediaFileId?: string;
    mediaType?: string;
  }) {
    const announcement = await prisma.announcement.create({
      data: {
        title: data.title,
        message: data.message,
        targetType: data.targetType as any,
        targetUserIds: data.targetUserIds || [],
        sentById: data.sentById,
        mediaFileId: data.mediaFileId,
        mediaType: data.mediaType,
        status: "PENDING",
      },
    });

    logger.info(`Announcement created: ${announcement.id}`);

    return announcement;
  }

  /**
   * Get target users for announcement
   */
  static async getTargetUsers(
    targetType: string,
    specificUserIds?: string[]
  ) {
    switch (targetType) {
      case "ALL":
        return await prisma.user.findMany({
          where: { status: "ACTIVE" },
          select: { telegramId: true, id: true },
        });

      case "ACTIVE_INVESTORS":
        return await prisma.user.findMany({
          where: {
            status: "ACTIVE",
            investments: { some: { status: "ACTIVE" } },
          },
          select: { telegramId: true, id: true },
        });

      case "COMPLETED_INVESTORS":
        return await prisma.user.findMany({
          where: {
            status: "ACTIVE",
            investments: { some: { status: "COMPLETED" } },
          },
          select: { telegramId: true, id: true },
        });

      case "NON_INVESTORS":
        return await prisma.user.findMany({
          where: {
            status: "ACTIVE",
            investments: { none: {} },
          },
          select: { telegramId: true, id: true },
        });

      case "SPECIFIC_USERS":
        if (!specificUserIds || specificUserIds.length === 0) return [];
        return await prisma.user.findMany({
          where: {
            id: { in: specificUserIds },
            status: "ACTIVE",
          },
          select: { telegramId: true, id: true },
        });

      case "ALL_BOT_VISITORS":
        // Get all bot visitor telegram IDs (both registered and unregistered)
        logger.info(`[getTargetUsers] Fetching all bot visitors...`);
        const allVisitors = await prisma.botVisitor.findMany({
          select: { telegramId: true },
        });
        logger.info(`[getTargetUsers] Found ${allVisitors.length} total bot visitors`);
        
        // Return visitor telegram IDs directly so we can send to all (registered or not)
        const result = allVisitors.map((v) => ({
          telegramId: v.telegramId,
          id: v.telegramId.toString(), // Use telegramId as ID for unregistered visitors
        })) as any[];
        logger.info(`[getTargetUsers] Returning ${result.length} visitors for announcement`);
        return result;

      default:
        return [];
    }
  }

  /**
   * Send announcement (to be called by bot context)
   */
  static async sendAnnouncement(
    announcementId: string,
    sendCallback: (telegramId: bigint, message: string) => Promise<void>
  ) {
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!announcement) {
      throw new Error("Announcement not found");
    }

    const targetUsers = await this.getTargetUsers(
      announcement.targetType,
      announcement.targetUserIds.length > 0
        ? announcement.targetUserIds
        : undefined
    );

    const fullMessage = `<b>${announcement.title}</b>\n\n${announcement.message}`;

    let successCount = 0;
    let failureCount = 0;

    // Send in batches
    const batchSize = config.BATCH_ANNOUNCEMENT_SIZE;
    const batchDelay = config.ANNOUNCEMENT_BATCH_DELAY_MS;

    for (let i = 0; i < targetUsers.length; i += batchSize) {
      const batch = targetUsers.slice(i, i + batchSize);

      for (const user of batch) {
        try {
          await sendCallback(user.telegramId, fullMessage);
          successCount++;
        } catch (error) {
          logger.error(`Failed to send announcement to ${user.id}:`, error);
          failureCount++;
        }
      }

      // Delay between batches
      if (i + batchSize < targetUsers.length) {
        await delay(batchDelay);
      }
    }

    // Update announcement
    const updated = await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        totalRecipients: targetUsers.length,
        successCount,
        failureCount,
        status: "COMPLETED",
        sentAt: new Date(),
      },
    });

    logger.info(`Announcement sent: ${announcementId} (Success: ${successCount}, Failed: ${failureCount})`);

    return updated;
  }

  /**
   * Get announcements
   */
  static async getAnnouncements(limit = 20, offset = 0) {
    return await prisma.announcement.findMany({
      include: { sentBy: true },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    });
  }

  /**
   * Get announcement by ID
   */
  static async getAnnouncementById(id: string) {
    return await prisma.announcement.findUnique({
      where: { id },
      include: { sentBy: true },
    });
  }

  /**
   * Delete announcement
   */
  static async deleteAnnouncement(id: string) {
    return await prisma.announcement.delete({
      where: { id },
    });
  }

  /**
   * Get all users for selection
   */
  static async getUsersForSelection(limit = 10, offset = 0) {
    return await prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        email: true,
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    });
  }

  /**
   * Count total users
   */
  static async countUsers() {
    return await prisma.user.count({
      where: { status: "ACTIVE" },
    });
  }
}

export default AnnouncementService;
