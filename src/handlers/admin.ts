import { Context } from "grammy";
import UserService from "../services/user.js";
import InvestmentService from "../services/investment.js";
import AnnouncementService from "../services/announcement.js";
import { NotificationService } from "../services/notification.js";
import ReferralService from "../services/referral.js";
import logger from "../config/logger.js";
import {
  formatCurrency,
  formatDate,
  getUserDisplayName,
} from "../lib/helpers.js";
import {
  adminMenuKeyboard,
  createPaginationKeyboard,
  createUserStatusKeyboard,
} from "../utils/keyboard.js";
import prisma from "../db/client.js";

type SessionContext = Context & { session: any };

/**
 * Admin panel
 */
export async function handleAdminPanel(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Admin Dashboard`);
  const stats = await InvestmentService.getInvestmentStats();
  const totalUsers = await UserService.countActiveUsers();

  const message = `<b>🤖 Admin Dashboard</b>\n\n
📊 <b>Platform Stats:</b>
• Total Users: ${totalUsers}
• Total Investments: ${stats.totalInvestments}
• Total Amount: ${formatCurrency(stats.totalAmount)}
• Total Expected ROI: ${formatCurrency(stats.totalExpectedReturn - stats.totalAmount)}

<b>Investment Status:</b>
• Pending: ${stats.statusCounts["PENDING"] || 0}
• Active: ${stats.statusCounts["ACTIVE"] || 0}
• Matured: ${stats.statusCounts["MATURED"] || 0}
• Completed: ${stats.statusCounts["COMPLETED"] || 0}

Select an action:`;

  await ctx.reply(message, {
    reply_markup: adminMenuKeyboard,
    parse_mode: "HTML",
  });
}

/**
 * View pending investments
 */
export async function handlePendingInvestments(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Pending Investments (Admin)`);
  const page = ctx.session.investmentPage || 1;
  const limit = 5;
  const offset = (page - 1) * limit;

  const investments = await InvestmentService.getPendingInvestments(limit, offset);
  const count = await InvestmentService.countPendingInvestments();
  const totalPages = Math.ceil(count / limit);

  if (investments.length === 0) {
    await ctx.reply("✅ No pending investments");
    return;
  }

  let message = `<b>💰 Pending Investments (${count} total)</b>\n\n`;

  for (const inv of investments) {
    message += `<b>${inv.package.icon} ${inv.package.name}</b>\n`;
    message += `User: ${getUserDisplayName(inv.user)}\n`;
    message += `Amount: ${formatCurrency(inv.amount)}\n`;
    message += `Expected Return: ${formatCurrency(inv.expectedReturn)}\n`;
    message += `Submitted: ${formatDate(inv.createdAt)}\n`;
    message += `/approve_${inv.id} | /reject_${inv.id}\n\n`;
  }

  ctx.session.investmentPage = page;

  const keyboard = createPaginationKeyboard(page, totalPages, "pending_inv");
  await ctx.reply(message, {
    reply_markup: keyboard,
    parse_mode: "HTML",
  });
}

/**
 * Approve investment
 */
export async function handleApproveInvestment(
  ctx: SessionContext,
  investmentId: string
): Promise<void> {
  try {
    const message = `📸 Please send proof of investment approval:\n(Transaction receipt, confirmation, etc.)`;

    ctx.session.approveInvestmentId = investmentId;

    await ctx.reply(message);
  } catch (error) {
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Process investment approval
 */
export async function handleProcessApproval(ctx: SessionContext): Promise<void> {
  const investmentId = ctx.session.approveInvestmentId;

  if (!investmentId) {
    logger.error(`❌ No investment selected for approval`);
    await ctx.reply("❌ No investment selected");
    return;
  }

  try {
    logger.info(`✅ Processing investment approval: ${investmentId}`);
    const proof = ctx.update.message?.document?.file_id ||
      ctx.update.message?.photo?.at(-1)?.file_id || "manual_proof";

    const investment = await InvestmentService.approveInvestment(
      investmentId,
      proof
    );

    // Credit referral bonus if applicable
    try {
      logger.debug(`Attempting to credit referral bonus for investment ${investmentId} (user: ${investment.userId}, amount: ${investment.amount})`);
      
      await ReferralService.creditReferralBonus(
        investmentId,
        investment.amount,
        investment.userId
      );

      // Send notification to referrer about bonus (if bonus was credited)
      const referredUser = await prisma.user.findUnique({
        where: { id: investment.userId },
        select: { referredBy: true },
      });

      if (referredUser?.referredBy) {
        const referrer = await prisma.user.findUnique({
          where: { referralCode: referredUser.referredBy },
          select: { id: true },
        });

        if (referrer) {
          const bonusPercentage = await ReferralService.getBonusPercentage();
          const bonusAmount = (investment.amount * bonusPercentage) / 100;

          logger.debug(`Sending referral bonus notification to referrer ${referrer.id} for amount ${bonusAmount}`);

          await NotificationService.createNotification(
            referrer.id,
            "🎁 Referral Bonus Earned!",
            `You earned ${formatCurrency(bonusAmount)} referral bonus from ${getUserDisplayName(investment.user)}'s investment of ${formatCurrency(investment.amount)}!`,
            "REFERRAL_BONUS",
            investmentId
          ).catch(err => logger.error("Failed to create referral bonus notification:", err));
        }
      }
    } catch (error) {
      logger.error(`❌ Error crediting referral bonus for investment ${investmentId}:`, error);
      // Log but don't fail the approval if bonus credit fails - approval should still go through
      logger.warn(`Investment ${investmentId} approved but referral bonus credit encountered an error. Further investigation may be needed.`);
    }

    logger.info(`✅ Trade approved successfully: ${investmentId}`);
    const message = `✅ <b>Trade Approved!</b>\n\n
📦 Package: ${investment.package.icon} ${investment.package.name}
💰 Amount: ${formatCurrency(investment.amount)}
👤 User: ${getUserDisplayName(investment.user)}
📊 Status: ACTIVE`;

    // Send Telegram message to user with button
    try {
      if (investment.user.telegramId) {
        await ctx.api.sendMessage(
          Number(investment.user.telegramId),
          `✅ <b>Trade Approved!</b>\n\n📦 Package: ${investment.package.name}\n💰 Amount: ${formatCurrency(investment.amount)}\n\nYour trade is now ACTIVE and earning returns!`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "💰 View Trade", callback_data: `view_investment_${investmentId}` }],
                [{ text: "📊 My Portfolio", callback_data: "back_to_menu" }]
              ]
            }
          }
        );
        logger.info(`Sent Telegram message to user ${investment.userId} about investment approval`);
      }
    } catch (error) {
      logger.error("Error sending Telegram message to user:", error);
    }

    // Create notification for user
    await NotificationService.createNotification(
      investment.userId,
      "✅ Investment Approved!",
      `Your investment of ${formatCurrency(investment.amount)} in ${investment.package.name} has been approved and activated.`,
      "INVESTMENT",
      investmentId
    ).catch(err => logger.error("Failed to create approval notification:", err));

    delete ctx.session.approveInvestmentId;

    await ctx.reply(message, {
      parse_mode: "HTML",
    });
  } catch (error) {
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Reject investment
 */
export async function handleRejectInvestment(
  ctx: SessionContext,
  investmentId: string
): Promise<void> {
  const message = `❌ Enter rejection reason:`;

  ctx.session.rejectInvestmentId = investmentId;

  await ctx.reply(message);
}

/**
 * Process rejection
 */
export async function handleProcessRejection(ctx: SessionContext): Promise<void> {
  const investmentId = ctx.session.rejectInvestmentId;
  const reason = ctx.update.message?.text;

  if (!investmentId || !reason) {
    await ctx.reply("❌ Invalid data");
    return;
  }

  try {
    const investment = await InvestmentService.rejectInvestment(
      investmentId,
      reason
    );

    const message = `❌ <b>Trade Rejected</b>\n\n
📦 Package: ${investment.package.icon} ${investment.package.name}
💰 Amount: ${formatCurrency(investment.amount)}
👤 User: ${getUserDisplayName(investment.user)}
📝 Reason: ${reason}`;

    // Send Telegram message to user with button
    try {
      if (investment.user.telegramId) {
        await ctx.api.sendMessage(
          Number(investment.user.telegramId),
          `❌ <b>Trade Rejected</b>\n\n📦 Package: ${investment.package.name}\n💰 Amount: ${formatCurrency(investment.amount)}\n\n<b>Reason:</b>\n${reason}\n\nYou can try again with different details.`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "📋 View Reason", callback_data: `investment_rejection_${investmentId}` }],
                [{ text: "💼 Try Again", callback_data: "back_to_menu" }]
              ]
            }
          }
        );
        logger.info(`Sent Telegram message to user ${investment.userId} about investment rejection`);
      }
    } catch (error) {
      logger.error("Error sending Telegram message to user:", error);
    }

    // Create notification for user
    await NotificationService.createNotification(
      investment.userId,
      "❌ Trade Rejected",
      `Your trade request of ${formatCurrency(investment.amount)} has been rejected. Reason: ${reason}`,
      "INVESTMENT",
      investmentId
    ).catch(err => logger.error("Failed to create rejection notification:", err));

    delete ctx.session.rejectInvestmentId;

    await ctx.reply(message, {
      parse_mode: "HTML",
    });
  } catch (error) {
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Manage users
 */
export async function handleManageUsers(ctx: SessionContext): Promise<void> {
  const page = ctx.session.userPage || 1;
  const limit = 5;
  const offset = (page - 1) * limit;

  const users = await UserService.getActiveUsers(limit, offset);
  const count = await UserService.countActiveUsers();
  const totalPages = Math.ceil(count / limit);

  if (users.length === 0) {
    await ctx.reply("No users found");
    return;
  }

  let message = `<b>👥 Users (${count} total) - Page ${page}/${totalPages}</b>\n\n`;

  for (const user of users) {
    message += `<b>${getUserDisplayName(user)}</b>\n`;
    message += `ID: <code>${user.telegramId}</code>\n`;
    message += `Total Invested: ${formatCurrency(user.totalInvested)}\n`;
    message += `Status: ${user.status}\n\n`;
  }

  ctx.session.userPage = page;

  // Create keyboard with user buttons
  const keyboard = {
    inline_keyboard: [
      ...users.map((user: any) => [
        {
          text: `👤 ${getUserDisplayName(user)}`,
          callback_data: `user_${user.id}`,
        },
      ]),
      ...(page > 1 || page < totalPages
        ? [[
            ...(page > 1 ? [{ text: "⬅️ Prev", callback_data: "users_prev" }] : []),
            ...(page < totalPages ? [{ text: "Next ➡️", callback_data: "users_next" }] : []),
          ]]
        : []),
      [{ text: "🔙 Back to Dashboard", callback_data: "back_to_admin" }],
    ],
  };

  await ctx.reply(message, {
    reply_markup: keyboard,
    parse_mode: "HTML",
  });
}

/**
 * View user details
 */
export async function handleUserDetails(ctx: SessionContext, userId: string): Promise<void> {
  const user = await UserService.getUserById(userId);

  if (!user) {
    await ctx.reply("❌ User not found");
    return;
  }

  const investments = await UserService.getUserInvestments(userId);

  let message = `<b>${getUserDisplayName(user)}</b>\n\n`;
  message += `🆔 ID: <code>${user.telegramId}</code>\n`;
  message += `📧 Email: ${user.email || "Not set"}\n`;
  message += `✅ KYC: ${user.kycVerified ? "Verified" : "Not verified"}\n\n`;
  message += `💰 Total Invested: ${formatCurrency(user.totalInvested)}\n`;
  message += `💵 Total Earned: ${formatCurrency(user.totalEarned)}\n`;
  message += `🏦 Total Withdrawn: ${formatCurrency(user.totalWithdrawn)}\n`;
  message += `📊 Investments: ${investments.length}\n\n`;
  message += `📅 Joined: ${formatDate(user.createdAt)}\n`;
  message += `🔙 Status: ${user.status}`;

  const keyboard = createUserStatusKeyboard(userId);

  await ctx.reply(message, {
    reply_markup: keyboard,
    parse_mode: "HTML",
  });
}

/**
 * Admin logs
 */
export async function handleAdminLogs(ctx: SessionContext): Promise<void> {
  const logs = await prisma.adminLog.findMany({
    include: { admin: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  let message = `<b>📋 Recent Admin Actions</b>\n\n`;

  for (const log of logs) {
    message += `<b>${log.action}</b> by ${getUserDisplayName(log.admin)}\n`;
    message += `Target: ${log.targetType} (${log.targetId || "N/A"})\n`;
    message += `Time: ${formatDate(log.createdAt)}\n\n`;
  }

  await ctx.reply(message, {
    parse_mode: "HTML",
  });
}

/**
 * Create announcement - Show target audience selection
 */
export async function handleCreateAnnouncement(ctx: SessionContext): Promise<void> {
  try {
    // Clear any previous workflow state
    delete ctx.session.addInvestmentStep;
    delete ctx.session.addInvestmentData;
    delete ctx.session.addPackageStep;
    delete ctx.session.addPackageData;
    delete ctx.session.editPackageId;
    delete ctx.session.editPackageStep;
    delete ctx.session.editPackageField;

    ctx.session.announcementStep = "target";

    const targetKeyboard = {
      inline_keyboard: [
        [{ text: "👥 All Users", callback_data: "announce_all" }],
        [{ text: "📈 Active Investors", callback_data: "announce_active" }],
        [{ text: "🚫 Non-Investors", callback_data: "announce_noninvestors" }],
        [{ text: "🔍 Pick User", callback_data: "announce_pick_user" }],
      ],
    };

    await ctx.reply(
      `📢 <b>Create Announcement</b>\n\n🎯 <b>Step 1: Select target audience</b>`,
      {
        reply_markup: targetKeyboard,
        parse_mode: "HTML",
      }
    );
  } catch (error) {
    logger.error("Error in handleCreateAnnouncement:", error);
    await ctx.reply("❌ Error loading announcement form. Please try again.");
  }
}

/**
 * Ask for announcement title
 */
export async function handleAskAnnouncementTitle(ctx: SessionContext): Promise<void> {
  ctx.session.announcementStep = "title";
  await ctx.reply(
    `📝 <b>Step 2: Announcement Title</b>\n\nEnter the announcement title:`,
    { parse_mode: "HTML" }
  );
}

/**
 * Process announcement title
 */
export async function handleAnnouncementTitle(ctx: SessionContext): Promise<void> {
  const title = ctx.update.message?.text;

  if (!title) {
    await ctx.reply("❌ Invalid title");
    return;
  }

  ctx.session.announcementTitle = title;
  ctx.session.announcementStep = "message";

  await ctx.reply(
    `💬 <b>Step 3: Announcement Message</b>\n\nEnter the announcement message:`,
    { parse_mode: "HTML" }
  );
}

/**
 * Process announcement message
 */
export async function handleAnnouncementMessage(ctx: SessionContext): Promise<void> {
  const message = ctx.update.message?.text;

  if (!message) {
    await ctx.reply("❌ Invalid message");
    return;
  }

  ctx.session.announcementMessage = message;
  ctx.session.announcementStep = "media";

  // Ask if they want to add media
  await ctx.reply(
    `📎 <b>Step 4: Add Media (Optional)</b>\n\nWould you like to attach media to this announcement?\n\n• 📸 Photo\n• 🎥 Video\n• 🎬 GIF\n\nOr skip to send text-only`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📸 Add Photo", callback_data: "announce_add_photo" },
            { text: "🎥 Add Video", callback_data: "announce_add_video" },
          ],
          [
            { text: "🎬 Add GIF", callback_data: "announce_add_gif" },
            { text: "⏭️ Skip Media", callback_data: "announce_send_now" },
          ],
        ],
      },
    }
  );
}

/**
 * Show users for selection with pagination
 */
export async function handleShowUsersForSelection(ctx: SessionContext): Promise<void> {
  const page = ctx.session.userSelectionPage || 0;
  const pageSize = 5;

  const users = await AnnouncementService.getUsersForSelection(pageSize, page * pageSize);
  const totalCount = await AnnouncementService.countUsers();
  const totalPages = Math.ceil(totalCount / pageSize);

  if (users.length === 0) {
    await ctx.reply("❌ No users found");
    return;
  }

  let message = `<b>👥 Select User</b>\n\nPage ${page + 1} of ${totalPages}\n\n`;

  const buttons: any[] = [];
  for (const user of users) {
    const displayName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
    message += `• ${displayName} (${user.phoneNumber || "N/A"})\n`;
    buttons.push([{ text: displayName, callback_data: `announce_user_${user.id}` }]);
  }

  // Pagination buttons
  const paginationRow: any = [];
  if (page > 0) {
    paginationRow.push({ text: "⬅️ Prev", callback_data: "announce_users_prev" });
  }
  if (page + 1 < totalPages) {
    paginationRow.push({ text: "Next ➡️", callback_data: "announce_users_next" });
  }
  if (paginationRow.length > 0) {
    buttons.push(paginationRow);
  }

  ctx.session.announcementStep = "pick_user";

  await ctx.reply(message, {
    reply_markup: { inline_keyboard: buttons },
    parse_mode: "HTML",
  });
}

/**
 * Send announcement to target users
 */
export async function handleSendAnnouncement(ctx: SessionContext): Promise<void> {
  try {
    logger.info(`[handleSendAnnouncement] Starting announcement send process...`, {
      announcementTitle: ctx.session.announcementTitle?.substring(0, 30),
      announcementMessage: ctx.session.announcementMessage?.substring(0, 30),
      announcementMediaFileId: ctx.session.announcementMediaFileId?.substring(0, 20),
      announcementMediaType: ctx.session.announcementMediaType,
      announcementTarget: ctx.session.announcementTarget,
    });

    const { announcementTitle, announcementMessage, announcementTarget, targetUserIds, userId, announcementMediaFileId, announcementMediaType } = ctx.session;

    if (!announcementTitle || !announcementMessage || !announcementTarget) {
      logger.warn(`[handleSendAnnouncement] Missing required data`, {
        hasTitle: !!announcementTitle,
        hasMessage: !!announcementMessage,
        hasTarget: !!announcementTarget,
      });
      await ctx.reply("❌ Missing announcement data", { reply_markup: adminMenuKeyboard });
      return;
    }

    if (!userId) {
      logger.warn(`[handleSendAnnouncement] User session not found`);
      await ctx.reply("❌ User session not found", { reply_markup: adminMenuKeyboard });
      return;
    }

    logger.info(`[handleSendAnnouncement] Creating announcement record in database...`);
    // Create announcement with optional media
    const announcement = await AnnouncementService.createAnnouncement({
      title: announcementTitle,
      message: announcementMessage,
      targetType: announcementTarget,
      targetUserIds: targetUserIds || [],
      sentById: userId,
      mediaFileId: announcementMediaFileId || undefined,
      mediaType: announcementMediaType || undefined,
    });
    logger.info(`[handleSendAnnouncement] ✅ Announcement created with ID: ${announcement.id}`);

    logger.info(`[handleSendAnnouncement] Fetching target users...`);
    // Get target users
    const targetUsers = await AnnouncementService.getTargetUsers(
      announcementTarget,
      targetUserIds
    );
    logger.info(`[handleSendAnnouncement] ✅ Found ${targetUsers.length} target users`);

    if (targetUsers.length === 0) {
      logger.warn(`[handleSendAnnouncement] No users found for target audience: ${announcementTarget}`);
      await ctx.reply("⚠️ No users found for this target audience", { reply_markup: adminMenuKeyboard });
      delete ctx.session.announcementTitle;
      delete ctx.session.announcementMessage;
      delete ctx.session.announcementTarget;
      delete ctx.session.announcementStep;
      delete ctx.session.targetUserIds;
      delete ctx.session.announcementMediaFileId;
      delete ctx.session.announcementMediaType;
      return;
    }

    // Send announcement to all target users
    const fullMessage = `<b>${announcementTitle}</b>\n\n${announcementMessage}`;
    const buttons = {
      inline_keyboard: [
        [{ text: "📢 View Announcement", callback_data: `view_announcement_${announcement.id}` }],
        [{ text: "🚀 Begin Trading", callback_data: "start_new_investment" }],
        [{ text: "🏠 Back to Menu", callback_data: "back_to_menu" }]
      ]
    };

    let successCount = 0;
    let failureCount = 0;

    logger.info(`[handleSendAnnouncement] Starting to send to ${targetUsers.length} users. mediaType=${announcementMediaType}, hasMediaFileId=${!!announcementMediaFileId}`);

    for (const user of targetUsers) {
      try {
        logger.info(`[handleSendAnnouncement] Sending to user ${user.id} (telegramId: ${user.telegramId})...`);
        
        // Send with media if available
        if (announcementMediaFileId && announcementMediaType) {
          logger.info(`[handleSendAnnouncement] Using media send. mediaType: ${announcementMediaType}`);
          if (announcementMediaType === "video") {
            logger.info(`[handleSendAnnouncement] Sending video to ${user.telegramId}`);
            await ctx.api.sendVideo(Number(user.telegramId), announcementMediaFileId, {
              caption: fullMessage,
              parse_mode: "HTML",
              reply_markup: buttons,
            });
            logger.info(`[handleSendAnnouncement] ✅ Video sent to ${user.telegramId}`);
          } else if (announcementMediaType === "animation") {
            logger.info(`[handleSendAnnouncement] Sending animation to ${user.telegramId}`);
            await ctx.api.sendAnimation(Number(user.telegramId), announcementMediaFileId, {
              caption: fullMessage,
              parse_mode: "HTML",
              reply_markup: buttons,
            });
            logger.info(`[handleSendAnnouncement] ✅ Animation sent to ${user.telegramId}`);
          } else {
            // Default to photo
            logger.info(`[handleSendAnnouncement] Sending photo to ${user.telegramId}`);
            await ctx.api.sendPhoto(Number(user.telegramId), announcementMediaFileId, {
              caption: fullMessage,
              parse_mode: "HTML",
              reply_markup: buttons,
            });
            logger.info(`[handleSendAnnouncement] ✅ Photo sent to ${user.telegramId}`);
          }
        } else {
          // Send text-only
          logger.info(`[handleSendAnnouncement] Sending text-only message to ${user.telegramId}`);
          await ctx.api.sendMessage(Number(user.telegramId), fullMessage, {
            parse_mode: "HTML",
            reply_markup: buttons
          });
          logger.info(`[handleSendAnnouncement] ✅ Text message sent to ${user.telegramId}`);
        }

        // Create notification for user
        await NotificationService.createNotification(
          user.id,
          announcementTitle,
          announcementMessage,
          "ANNOUNCEMENT"
        ).catch(err => logger.error(`[handleSendAnnouncement] Failed to create announcement notification for user ${user.id}:`, err));

        successCount++;
      } catch (error) {
        logger.error(`[handleSendAnnouncement] ❌ Failed to send announcement to ${user.id}:`, error);
        failureCount++;
      }
    }

    logger.info(`[handleSendAnnouncement] Finished sending. successCount=${successCount}, failureCount=${failureCount}`);

    // Update announcement
    await prisma.announcement.update({
      where: { id: announcement.id },
      data: {
        totalRecipients: targetUsers.length,
        successCount,
        failureCount,
        status: "COMPLETED",
        sentAt: new Date(),
      },
    });
    logger.info(`[handleSendAnnouncement] ✅ Announcement record updated in database`);

    // Notify admin
    const result = `✅ <b>Announcement Sent Successfully!</b>\n\n📈 <b>Total Recipients:</b> ${targetUsers.length}\n✅ <b>Succeeded:</b> ${successCount}\n❌ <b>Failed:</b> ${failureCount}${announcementMediaType ? `\n📎 <b>Media Type:</b> ${announcementMediaType.toUpperCase()}` : ""}`;

    await ctx.reply(result, { parse_mode: "HTML", reply_markup: adminMenuKeyboard });
    logger.info(`✅ Announcement sent successfully to ${successCount}/${targetUsers.length} users`);

    // Clear session
    delete ctx.session.announcementTitle;
    delete ctx.session.announcementMessage;
    delete ctx.session.announcementTarget;
    delete ctx.session.announcementStep;
    delete ctx.session.targetUserIds;
    delete ctx.session.announcementMediaFileId;
    delete ctx.session.announcementMediaType;
    logger.info(`[handleSendAnnouncement] ✅ Session cleared`);
  } catch (error) {
    logger.error(`[handleSendAnnouncement] ❌ Unhandled error:`, error);
    await ctx.reply("❌ Failed to send announcement", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Handle announcement photo upload
 */
export async function handleAnnouncementPhotoUpload(ctx: SessionContext): Promise<void> {
  try {
    logger.info(`🚀 handleAnnouncementPhotoUpload called`);
    
    logger.info(`[handleAnnouncementPhotoUpload] Starting...`, {
      userId: ctx.session.userId,
      hasPhoto: !!ctx.message?.photo,
      photoCount: ctx.message?.photo?.length,
      announcementStep: ctx.session.announcementStep,
      announcementTitle: ctx.session.announcementTitle?.substring(0, 30),
    });
    
    // Photo is already validated in index.ts
    if (!ctx.message?.photo) {
      logger.error(`[handleAnnouncementPhotoUpload] ❌ No photo in context`);
      await ctx.reply("❌ Photo upload failed");
      return;
    }

    const photoFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    logger.info(`[handleAnnouncementPhotoUpload] ✅ Photo file_id extracted: ${photoFileId.substring(0, 30)}...`);
    
    ctx.session.announcementMediaFileId = photoFileId;
    ctx.session.announcementMediaType = "photo";
    logger.info(`[handleAnnouncementPhotoUpload] ✅ Session updated`, {
      mediaFileId: photoFileId.substring(0, 30),
      mediaType: ctx.session.announcementMediaType,
    });

    logger.info(`[handleAnnouncementPhotoUpload] 📸 Photo attached to announcement`);
    
    // Clear the media step before sending
    delete ctx.session.announcementStep;
    logger.info(`[handleAnnouncementPhotoUpload] ✅ Cleared announcementStep from session`);
    
    // Send the announcement
    logger.info(`[handleAnnouncementPhotoUpload] 🚀 Calling handleSendAnnouncement...`);
    await handleSendAnnouncement(ctx);
    logger.info(`[handleAnnouncementPhotoUpload] ✅ handleSendAnnouncement completed`);
  } catch (error) {
    logger.error(`[handleAnnouncementPhotoUpload] ❌ Error:`, error);
    await ctx.reply("❌ Error uploading photo");
  }
}

/**
 * Handle announcement video upload
 */
export async function handleAnnouncementVideoUpload(ctx: SessionContext): Promise<void> {
  try {
    // Video is already validated in index.ts
    if (!ctx.message?.video) {
      await ctx.reply("❌ Video upload failed");
      return;
    }

    ctx.session.announcementMediaFileId = ctx.message.video.file_id;
    ctx.session.announcementMediaType = "video";

    logger.info(`🎥 Video attached to announcement: ${ctx.message.video.file_id.substring(0, 20)}...`);
    
    // Clear the media step before sending
    delete ctx.session.announcementStep;
    
    // Send the announcement
    await handleSendAnnouncement(ctx);
  } catch (error) {
    logger.error("Error uploading announcement video:", error);
    await ctx.reply("❌ Error uploading video");
  }
}

/**
 * Handle announcement GIF upload
 */
export async function handleAnnouncementAnimationUpload(ctx: SessionContext): Promise<void> {
  try {
    // Animation is already validated in index.ts
    if (!ctx.message?.animation) {
      await ctx.reply("❌ GIF upload failed");
      return;
    }

    ctx.session.announcementMediaFileId = ctx.message.animation.file_id;
    ctx.session.announcementMediaType = "animation";

    logger.info(`🎬 GIF attached to announcement: ${ctx.message.animation.file_id.substring(0, 20)}...`);
    
    // Clear the media step before sending
    delete ctx.session.announcementStep;
    
    // Send the announcement
    await handleSendAnnouncement(ctx);
  } catch (error) {
    logger.error("Error uploading announcement animation:", error);
    await ctx.reply("❌ Error uploading GIF");
  }
}

/**
 * View pending withdrawal requests
 */
export async function handlePendingWithdrawals(ctx: SessionContext): Promise<void> {
  try {
    const { handleAdminViewWithdrawals } = await import("./withdrawalAdmin.js");
    return handleAdminViewWithdrawals(ctx);
  } catch (error) {
    logger.error("Error handling pending withdrawals:", error);
    await ctx.reply("❌ Error loading withdrawals", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * View withdrawal request details
 */
export async function handleViewWithdrawalDetail(ctx: SessionContext, withdrawalId: string): Promise<void> {
  try {
    const withdrawal = await prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
      include: { user: true, investment: { include: { package: true } } },
    });

    if (!withdrawal) {
      await ctx.reply("Withdrawal request not found", {
        reply_markup: adminMenuKeyboard,
      });
      return;
    }

    const message = `Withdrawal Details

Investor: ${getUserDisplayName(withdrawal.user)}
Email: ${withdrawal.user.email}
Telegram ID: ${withdrawal.user.telegramId}

Amount: ${formatCurrency(withdrawal.amount)}

Package: ${withdrawal.investment?.package.name || "N/A"}
Investment ID: ${withdrawal.investment?.id || "N/A"}

Bank: ${withdrawal.bankDetails || "Not provided"}

Requested: ${formatDate(withdrawal.createdAt)}
Status: ${withdrawal.status}
Email Verified: ${withdrawal.emailVerified ? "Yes" : "Pending"}

Request ID: ${withdrawal.id}`;

    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();

    if (withdrawal.status === "PENDING" && withdrawal.emailVerified) {
      keyboard.text("Approve", `approve_withdrawal_${withdrawalId}`);
    } else if (withdrawal.status === "PENDING" && !withdrawal.emailVerified) {
      keyboard.text("Waiting for Email Verification", "waiting_verify").row();
    } else if (withdrawal.status === "APPROVED") {
      keyboard.text("Mark as Paid", `complete_withdrawal_${withdrawalId}`).row();
    }
    
    keyboard.text("Reject", `reject_withdrawal_inline_${withdrawalId}`).row();
    keyboard.text("Back", "back_to_withdrawals").row();

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } catch (error) {
    logger.error("Error viewing withdrawal details:", error);
    await ctx.reply(`Error: ${(error as Error).message}`);
  }
}

/**
 * Approve withdrawal request
 */
export async function handleApproveWithdrawal(ctx: SessionContext, withdrawalId: string): Promise<void> {
  try {
    const withdrawal = await InvestmentService.approveWithdrawalRequest(withdrawalId);

    const message = `✅ <b>Withdrawal Approved</b>\n\nUser: ${getUserDisplayName(withdrawal.user)}
Amount: ${formatCurrency(withdrawal.amount)}
Bank Details: ${withdrawal.bankDetails || "N/A"}

<b>Next Steps:</b>
Process the payment to the user's bank account and click "Mark as Paid" when done.`;

    // Send Telegram message to user with button
    try {
      if (withdrawal.user.telegramId) {
        await ctx.api.sendMessage(
          Number(withdrawal.user.telegramId),
          `✅ <b>Withdrawal Approved</b>\n\n💸 Amount: ${formatCurrency(withdrawal.amount)}\n\nYour withdrawal has been approved! Our team is processing your payment. You will receive the funds shortly.`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "💸 View Withdrawal", callback_data: `view_withdrawal_${withdrawalId}` }],
                [{ text: "� Begin Trading", callback_data: "start_new_investment" }],
                [{ text: "�📊 My Portfolio", callback_data: "back_to_menu" }]
              ]
            }
          }
        );
        logger.info(`Sent Telegram message to user ${withdrawal.userId} about withdrawal approval`);
      }
    } catch (error) {
      logger.error("Error sending Telegram message to user:", error);
    }

    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard();
    keyboard.text("✅ Mark as Paid", `complete_withdrawal_${withdrawalId}`).row();
    keyboard.text("❌ Reject", `reject_withdrawal_inline_${withdrawalId}`).row();
    keyboard.text("🔙 Back", `view_withdrawal_${withdrawalId}`).row();

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

    // Notify user
    try {
      const userMessage = `✅ Your withdrawal request of ${formatCurrency(withdrawal.amount)} has been approved!\n\nOur team is processing your payment. You will receive the funds shortly.`;
      await ctx.api.sendMessage(Number(withdrawal.user.telegramId), userMessage);

      // Create notification for user
      await NotificationService.createNotification(
        withdrawal.userId,
        "✅ Withdrawal Approved",
        `Your withdrawal request of ${formatCurrency(withdrawal.amount)} has been approved. Payment is being processed.`,
        "WITHDRAWAL",
        undefined,
        withdrawalId
      ).catch(err => logger.error(`Failed to create withdrawal approval notification:`, err));
    } catch (error) {
      logger.error(`Failed to notify user ${withdrawal.user.id}:`, error);
    }
  } catch (error) {
    logger.error("Error approving withdrawal:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Complete withdrawal (payment sent)
 */
export async function handleCompleteWithdrawal(ctx: SessionContext, withdrawalId: string): Promise<void> {
  try {
    const withdrawal = await InvestmentService.completeWithdrawalRequest(withdrawalId);

    await ctx.reply(`✅ <b>Withdrawal Completed</b>\n\n
Amount: ${formatCurrency(withdrawal.amount)}
User: ${getUserDisplayName(withdrawal.user)}

User has been notified of completion.`, {
      parse_mode: "HTML",
      reply_markup: adminMenuKeyboard,
    });

    // Notify user
    try {
      const userMessage = `✅ <b>Withdrawal Completed!</b>\n\n
Amount: ${formatCurrency(withdrawal.amount)}\n
Status: ✅ Payment Sent\n\n
The funds have been transferred to your wallet. Please allow some time for the transaction to be confirmed on the blockchain.`;
      await ctx.api.sendMessage(withdrawal.user.telegramId.toString(), userMessage, {
        parse_mode: "HTML",
      });

      // Create notification for user
      await NotificationService.createNotification(
        withdrawal.userId,
        "✅ Withdrawal Completed",
        `Your withdrawal of ${formatCurrency(withdrawal.amount)} has been completed and the funds have been sent to your wallet.`,
        "WITHDRAWAL",
        undefined,
        withdrawalId
      ).catch(err => logger.error(`Failed to create withdrawal completion notification:`, err));
    } catch (error) {
      logger.error(`Failed to notify user ${withdrawal.user.id}:`, error);
    }
  } catch (error) {
    logger.error("Error completing withdrawal:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Reject withdrawal request
 */
export async function handleRejectWithdrawalRequest(
  ctx: SessionContext,
  withdrawalId: string,
  reason?: string
): Promise<void> {
  try {
    const rejection = reason || "Insufficient funds or verification failed";
    const withdrawal = await InvestmentService.rejectWithdrawalRequest(withdrawalId, rejection);

    await ctx.reply(`❌ <b>Withdrawal Rejected</b>\n\n
Amount: ${formatCurrency(withdrawal.amount)}
Reason: ${rejection}

User has been notified.`, {
      parse_mode: "HTML",
      reply_markup: adminMenuKeyboard,
    });

    // Notify user
    try {
      const userMessage = `❌ Your withdrawal request of ${formatCurrency(withdrawal.amount)} has been rejected.\n\nReason: ${rejection}\n\nPlease contact support for more information.`;
      await ctx.api.sendMessage(
        Number(withdrawal.user.telegramId),
        userMessage,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📋 View Reason", callback_data: `view_withdrawal_${withdrawalId}` }],
              [{ text: "🔄 Request Again", callback_data: "back_to_menu" }]
            ]
          }
        }
      );

      // Create notification for user
      await NotificationService.createNotification(
        withdrawal.userId,
        "❌ Withdrawal Rejected",
        `Your withdrawal request of ${formatCurrency(withdrawal.amount)} has been rejected. Reason: ${rejection}`,
        "WITHDRAWAL",
        undefined,
        withdrawalId
      ).catch(err => logger.error(`Failed to create withdrawal rejection notification:`, err));
    } catch (error) {
      logger.error(`Failed to notify user ${withdrawal.user.id}:`, error);
    }
  } catch (error) {
    logger.error("Error rejecting withdrawal:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Manage referral settings
 */
export async function handleReferralSettings(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Referral Settings (Admin)`);
  
  try {
    const bonusPercentage = await ReferralService.getBonusPercentage();
    const minimumThreshold = await ReferralService.getMinimumReferralThreshold();
    const analytics = await ReferralService.getReferralAnalytics();

    const message = `<b>💰 Referral Bonus Settings</b>\n\n
<b>Current Configuration:</b>
• Bonus Percentage: ${bonusPercentage}%
• Minimum Withdrawal: ${formatCurrency(minimumThreshold)}
• Total Bonuses Distributed: ${formatCurrency(analytics.totalBonusesDistributed)}
• Total Bonus Records: ${analytics.totalBonusRecords}

<b>Top 3 Referrers:</b>`;

    let referrersList = message;
    analytics.topReferrers.slice(0, 3).forEach((ref, index) => {
      referrersList += `\n${index + 1}. ${ref.name || ref.username || ref.userId}
   • Referrals: ${ref.referralCount}
   • Earnings: ${formatCurrency(ref.totalEarnings)}`;
    });

    referrersList += `\n\n<b>Actions:</b>
/edit_referral_bonus - Edit bonus percentage
/view_referral_analytics - View detailed analytics`;

    await ctx.reply(referrersList, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✏️ Edit Percentage", callback_data: "edit_referral_percentage" }],
          [{ text: "💵 Edit Min Threshold", callback_data: "edit_minimum_referral_withdrawal" }],
          [{ text: "📊 View Analytics", callback_data: "view_referral_analytics" }],
          [{ text: "🏠 Back to Admin", callback_data: "back_to_admin_menu" }]
        ]
      }
    });
  } catch (error) {
    logger.error("Error displaying referral settings:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Request new referral bonus percentage
 */
export async function handleEditReferralBonusStart(ctx: SessionContext): Promise<void> {
  logger.info(`Admin starting to edit referral bonus percentage`);
  
  const currentPercentage = await ReferralService.getBonusPercentage();
  
  await ctx.reply(
    `<b>Edit Referral Bonus Percentage</b>\n\n
Current: ${currentPercentage}%\n
Please enter the new percentage (e.g., 5 for 5%):`,
    {
      parse_mode: "HTML",
      reply_markup: { remove_keyboard: true },
    }
  );

  ctx.session.editingReferralBonus = true;
}

/**
 * Process new referral bonus percentage
 */
export async function handleEditReferralBonusInput(ctx: SessionContext): Promise<void> {
  const input = ctx.message?.text || "";

  try {
    const newPercentage = parseFloat(input);

    if (isNaN(newPercentage) || newPercentage < 0 || newPercentage > 100) {
      await ctx.reply(
        "❌ Invalid percentage. Please enter a number between 0 and 100:"
      );
      return;
    }

    await ReferralService.updateBonusPercentage(newPercentage, ctx.session.userId);

    await ctx.reply(
      `✅ <b>Referral Bonus Updated!</b>\n\n
New Percentage: ${newPercentage}%\n
This will apply to all new investments going forward.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "💰 Referral Settings", callback_data: "referral_settings" }],
            [{ text: "🏠 Admin Panel", callback_data: "admin_panel" }]
          ]
        }
      }
    );

    delete ctx.session.editingReferralBonus;
  } catch (error) {
    logger.error("Error updating referral bonus:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Start editing minimum referral withdrawal threshold
 */
export async function handleEditMinimumReferralThresholdStart(ctx: SessionContext): Promise<void> {
  logger.info(`Admin starting to edit minimum referral withdrawal threshold`);
  
  const currentThreshold = await ReferralService.getMinimumReferralThreshold();
  
  await ctx.reply(
    `<b>Edit Minimum Referral Withdrawal Threshold</b>\n\n
Current: ${formatCurrency(currentThreshold)}\n
Please enter the new minimum amount (in dollars, e.g., 100):`,
    {
      parse_mode: "HTML",
      reply_markup: { remove_keyboard: true },
    }
  );

  ctx.session.editingReferralThreshold = true;
}

/**
 * Process new minimum referral withdrawal threshold
 */
export async function handleEditMinimumReferralThresholdInput(ctx: SessionContext): Promise<void> {
  if (!ctx.message || !ctx.message.text) {
    await ctx.reply("❌ Please send a text message with the amount");
    return;
  }

  const input = ctx.message.text;

  try {
    const newThreshold = parseFloat(input);

    if (isNaN(newThreshold) || newThreshold < 0) {
      await ctx.reply(
        "❌ Invalid amount. Please enter a positive number:"
      );
      return;
    }

    await ReferralService.updateMinimumReferralThreshold(newThreshold, ctx.session.userId);

    await ctx.reply(
      `✅ <b>Minimum Referral Threshold Updated!</b>\n\n
New Minimum: ${formatCurrency(newThreshold)}\n
Users can only withdraw referral bonuses when they reach this amount.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "💰 Referral Settings", callback_data: "referral_settings" }],
            [{ text: "🏠 Admin Panel", callback_data: "admin_panel" }]
          ]
        }
      }
    );

    delete ctx.session.editingReferralThreshold;
  } catch (error) {
    logger.error("Error updating minimum referral threshold:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * View detailed referral analytics
 */
export async function handleViewReferralAnalytics(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Referral Analytics`);

  try {
    const analytics = await ReferralService.getReferralAnalytics();

    let message = `<b>📊 Referral Analytics</b>\n\n
<b>Overview:</b>
• Total Bonuses Distributed: ${formatCurrency(analytics.totalBonusesDistributed)}
• Total Bonus Records: ${analytics.totalBonusRecords}

<b>Top Referrers:</b>\n`;

    if (analytics.topReferrers.length === 0) {
      message += "No referrals yet.";
    } else {
      analytics.topReferrers.forEach((ref, index) => {
        message += `\n${index + 1}. <b>${ref.name || ref.username || "Unknown"}</b>
   • User ID: <code>${ref.userId}</code>
   • Active Referrals: ${ref.referralCount}
   • Total Earnings: ${formatCurrency(ref.totalEarnings)}
   • Bonus Records: ${ref.bonusCount}`;
      });
    }

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "💰 Back to Settings", callback_data: "referral_settings" }],
          [{ text: "🏠 Admin Panel", callback_data: "admin_panel" }]
        ]
      }
    });
  } catch (error) {
    logger.error("Error viewing referral analytics:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Type of notification
 */
/**
 * Handle welcome media management
 */
export async function handleManageWelcomeMedia(ctx: SessionContext): Promise<void> {
  logger.info(`📄 PAGE SHOWN: Manage Welcome Media`);

  try {
    // Get current media configuration
    const AboutService = (await import("../services/about.js")).default;
    const about = await AboutService.getAbout();

    let configStatus = "❌ No media configured";
    if (about.welcomeMediaFileId && about.welcomeMediaType) {
      const typeEmoji = {
        photo: "📸",
        video: "🎥",
        animation: "🎬",
      }[about.welcomeMediaType] || "📎";
      configStatus = `✅ ${typeEmoji} ${about.welcomeMediaType.toUpperCase()} configured`;
    }

    const message = `<b>🎬 Manage Welcome Message Media</b>\n\n
<b>Current Configuration:</b>
${configStatus}

<b>Actions:</b>
Select the media type to upload, or remove existing media:

• 📸 <b>Photo:</b> Click button, then send a JPG/PNG image
• 🎥 <b>Video:</b> Click button, then send a video file
• 🎬 <b>GIF:</b> Click button, then send an animated GIF
• 🗑️ <b>Remove:</b> Delete current media and show text only

⚠️ The media will be displayed with the welcome message when users open the bot (/start).`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📸 Upload Photo", callback_data: "upload_photo_welcome" },
            { text: "🎥 Upload Video", callback_data: "upload_video_welcome" },
          ],
          [
            { text: "🎬 Upload GIF", callback_data: "upload_gif_welcome" },
            { text: "🗑️ Remove Media", callback_data: "remove_welcome_media_action" },
          ],
          [{ text: "🔙 Back to Admin", callback_data: "back_to_admin" }],
        ],
      },
    });

    // Don't set managingWelcomeMedia yet - wait for button click
  } catch (error) {
    logger.error("Error managing welcome media:", error);
    await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Handle welcome media upload (photo)
 */
export async function handleWelcomeMediaPhoto(ctx: SessionContext): Promise<void> {
  try {
    if (!ctx.message?.photo) {
      await ctx.reply("❌ Please send a photo");
      return;
    }

    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;

    logger.info(`[ADMIN] Uploading welcome media (photo):`, { fileId: fileId.substring(0, 20) });

    // Update in database with file_id
    const AboutService = (await import("../services/about.js")).default;
    await AboutService.updateWelcomeMedia(fileId, "photo");

    await ctx.reply(
      `✅ <b>Welcome Photo Updated!</b>\n\n📸 The photo will be displayed when users open the bot with /start.\n\n🔄 Would you like to:\n• Upload another media file\n• Remove this media\n• Go back to admin panel`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📤 Upload Another", callback_data: "upload_photo_welcome" },
              { text: "🗑️ Remove", callback_data: "remove_welcome_media_action" },
            ],
            [{ text: "🔙 Back to Admin", callback_data: "back_to_admin" }],
          ],
        },
      }
    );

    ctx.session.managingWelcomeMedia = false;
  } catch (error) {
    logger.error("Error uploading welcome media photo:", error);
    await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function handleWelcomeMediaVideo(ctx: SessionContext): Promise<void> {
  try {
    if (!ctx.message?.video) {
      await ctx.reply("❌ Please send a video");
      return;
    }

    const video = ctx.message.video;
    const fileId = video.file_id;

    logger.info(`[ADMIN] Uploading welcome media (video):`, { fileId: fileId.substring(0, 20) });

    // Update in database with file_id
    const AboutService = (await import("../services/about.js")).default;
    await AboutService.updateWelcomeMedia(fileId, "video");

    await ctx.reply(
      `✅ <b>Welcome Video Updated!</b>\n\n🎥 The video will be displayed when users open the bot with /start.\n\n🔄 Would you like to:\n• Upload another media file\n• Remove this media\n• Go back to admin panel`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📤 Upload Another", callback_data: "upload_video_welcome" },
              { text: "🗑️ Remove", callback_data: "remove_welcome_media_action" },
            ],
            [{ text: "🔙 Back to Admin", callback_data: "back_to_admin" }],
          ],
        },
      }
    );

    ctx.session.managingWelcomeMedia = false;
  } catch (error) {
    logger.error("Error uploading welcome media video:", error);
    await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function handleWelcomeMediaAnimation(ctx: SessionContext): Promise<void> {
  try {
    if (!ctx.message?.animation) {
      await ctx.reply("❌ Please send an animation/GIF");
      return;
    }

    const animation = ctx.message.animation;
    const fileId = animation.file_id;

    logger.info(`[ADMIN] Uploading welcome media (animation):`, { fileId: fileId.substring(0, 20) });

    // Update in database with file_id
    const AboutService = (await import("../services/about.js")).default;
    await AboutService.updateWelcomeMedia(fileId, "animation");

    await ctx.reply(
      `✅ <b>Welcome GIF Updated!</b>\n\n🎬 The animation will be displayed when users open the bot with /start.\n\n🔄 Would you like to:\n• Upload another media file\n• Remove this media\n• Go back to admin panel`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📤 Upload Another", callback_data: "upload_gif_welcome" },
              { text: "🗑️ Remove", callback_data: "remove_welcome_media_action" },
            ],
            [{ text: "🔙 Back to Admin", callback_data: "back_to_admin" }],
          ],
        },
      }
    );

    ctx.session.managingWelcomeMedia = false;
  } catch (error) {
    logger.error("Error uploading welcome media animation:", error);
    await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Remove welcome media
 */
export async function handleRemoveWelcomeMedia(ctx: SessionContext): Promise<void> {
  try {
    logger.info(`[ADMIN] Removing welcome media`);

    const AboutService = (await import("../services/about.js")).default;
    // Clear by setting empty file_id
    await AboutService.updateWelcomeMedia("", "photo");

    await ctx.reply(
      `✅ <b>Welcome Media Removed!</b>\n\nThe welcome message will now display as text only.\n\n🔄 Would you like to:\n• Upload new media\n• Go back to admin panel`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📤 Upload New Media", callback_data: "upload_photo_welcome" },
              { text: "🔙 Back to Admin", callback_data: "back_to_admin" },
            ],
          ],
        },
      }
    );

    ctx.session.managingWelcomeMedia = false;
  } catch (error) {
    logger.error("Error removing welcome media:", error);
    await ctx.reply(
      `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Back", callback_data: "back_to_admin" }],
          ],
        },
      }
    );
  }
}

type NotificationType = "INVESTMENT" | "ANNOUNCEMENT" | "WITHDRAWAL" | "REFERRAL_BONUS" | "SUPPORT" | "SUCCESS" | "ERROR" | "INFO";