import { Context } from "grammy";
import PackageService from "../services/package.js";
import logger from "../config/logger.js";
import { formatCurrency } from "../lib/helpers.js";
import { adminMenuKeyboard } from "../utils/keyboard.js";
import prisma from "../db/client.js";

type SessionContext = Context & { session: any };

/**
 * Manage all packages
 */
export async function handleManagePackages(ctx: SessionContext): Promise<void> {
  try {
    // Clear any previous workflow state to prevent interference
    delete ctx.session.addInvestmentStep;
    delete ctx.session.addInvestmentData;
    delete ctx.session.announcementStep;
    delete ctx.session.announcementTitle;
    delete ctx.session.announcementMessage;
    delete ctx.session.announcementTarget;
    delete ctx.session.targetUserIds;

    // Get ALL packages, both active and inactive
    const packages = await PackageService.getAllPackages();

    if (packages.length === 0) {
      await ctx.reply(
        `<b>📦 Package Management</b>\n\n
No packages available.\n\n
Options:\n
• Add New Package`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "➕ Add Package", callback_data: "add_package_start" }],
              [{ text: "🔙 Back to Dashboard", callback_data: "back_to_admin" }],
            ],
          },
        }
      );
      return;
    }

    const activeCount = packages.filter((p: any) => p.isActive).length;
    let message = `<b>📦 Investment Packages</b>\n`;
    message += `Total: ${packages.length} | Active: ✅ ${activeCount} | Inactive: ❌ ${packages.length - activeCount}\n\n`;

    for (const pkg of packages) {
      const statusIcon = pkg.isActive ? "✅" : "❌";
      message += `${statusIcon} <b>${pkg.icon} ${pkg.name}</b>\n`;
      message += `   💰 Amount: ${formatCurrency(pkg.minAmount)} - ${formatCurrency(pkg.maxAmount)}\n`;
      message += `   📈 ROI: ${pkg.roiPercentage}% | ⏱️ ${pkg.duration}d\n`;
      message += `   📊 Invested: ${pkg.totalInvestments} | ${formatCurrency(pkg.totalAmountInvested)}\n\n`;
    }

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: packages.map((pkg: any) => {
          const statusText = pkg.isActive ? "✏️" : "🔴";
          return [{ text: `${statusText} ${pkg.icon} ${pkg.name}`, callback_data: `edit_package_${pkg.id}` }];
        }).concat([
          [{ text: "➕ Add Package", callback_data: "add_package_start" }],
          [{ text: "🔙 Back to Dashboard", callback_data: "back_to_admin" }],
        ]),
      },
    });
  } catch (error) {
    logger.error("Error fetching packages:", error);
    await ctx.reply("❌ Error loading packages", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Start adding new package
 */
export async function handleAddPackageStart(ctx: SessionContext): Promise<void> {
  // Clear any previous workflow state
  delete ctx.session.addInvestmentStep;
  delete ctx.session.addInvestmentData;
  delete ctx.session.announcementStep;
  delete ctx.session.announcementTitle;
  delete ctx.session.announcementMessage;
  delete ctx.session.announcementTarget;
  delete ctx.session.targetUserIds;

  ctx.session.addPackageStep = "enter_name";

  await ctx.reply(
    `<b>➕ Create New Package</b>\n\n
Enter package name (e.g., "Premium Plan"):`,
    { parse_mode: "HTML" }
  );
}

/**
 * Edit existing package
 */
export async function handleEditPackageStart(ctx: SessionContext, packageId: string): Promise<void> {
  try {
    // Clear any previous workflow state
    delete ctx.session.addInvestmentStep;
    delete ctx.session.addInvestmentData;
    delete ctx.session.addPackageStep;
    delete ctx.session.addPackageData;
    delete ctx.session.announcementStep;
    delete ctx.session.announcementTitle;
    delete ctx.session.announcementMessage;
    delete ctx.session.announcementTarget;
    delete ctx.session.targetUserIds;

    const pkg = await PackageService.getPackageById(packageId);

    if (!pkg) {
      await ctx.reply("❌ Package not found");
      return;
    }

    ctx.session.editPackageId = packageId;
    ctx.session.editPackageStep = "menu";

    const message = `<b>✏️ Edit Package</b>\n\n
<b>${pkg.icon} ${pkg.name}</b>\n
Min: ${formatCurrency(pkg.minAmount)}\n
Max: ${formatCurrency(pkg.maxAmount)}\n
ROI: ${pkg.roiPercentage}%\n
Duration: ${pkg.duration} days\n
Risk Level: ${pkg.riskLevel}\n
Status: ${pkg.isActive ? "✅ Active" : "❌ Inactive"}\n
Description: ${pkg.description || "Not set"}\n\n
What would you like to edit?`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "💰 Min Amount", callback_data: `edit_pkg_minAmount_${packageId}` }],
          [{ text: "💰 Max Amount", callback_data: `edit_pkg_maxAmount_${packageId}` }],
          [{ text: "📈 ROI %", callback_data: `edit_pkg_roiPercentage_${packageId}` }],
          [{ text: "📅 Duration (days)", callback_data: `edit_pkg_duration_${packageId}` }],
          [{ text: "⚠️ Risk Level", callback_data: `edit_pkg_riskLevel_${packageId}` }],
          [{ text: "📝 Description", callback_data: `edit_pkg_description_${packageId}` }],
          [{ text: "🔄 Toggle Status", callback_data: `edit_pkg_status_${packageId}` }],
          [{ text: "🔙 Back", callback_data: "manage_packages" }],
        ],
      },
    });
  } catch (error) {
    logger.error("Error editing package:", error);
    await ctx.reply("❌ Error", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Update package field
 */
export async function handleUpdatePackageField(
  ctx: SessionContext,
  packageId: string,
  field: string
): Promise<void> {
  try {
    const pkg = await PackageService.getPackageById(packageId);
    if (!pkg) {
      await ctx.reply("❌ Package not found");
      return;
    }

    if (field === "status") {
      // Toggle status
      await prisma.package.update({
        where: { id: packageId },
        data: { isActive: !pkg.isActive },
      });

      await ctx.reply(
        `✅ <b>Package Status Updated</b>\n\n
${pkg.icon} ${pkg.name}\n
Status: ${!pkg.isActive ? "✅ Active" : "❌ Inactive"}`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "📦 Back to Packages", callback_data: "manage_packages" }]],
          },
        }
      );

      delete ctx.session.editPackageId;
      ctx.session.editPackageStep = undefined;
      return;
    }

    if (field === "riskLevel") {
      // Show risk level options
      ctx.session.editPackageId = packageId;
      ctx.session.editPackageField = field;
      ctx.session.editPackageStep = "select_risk";

      await ctx.reply(
        `<b>⚠️ Select Risk Level</b>\n\n
Current: <b>${pkg.riskLevel}</b>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ NO_RISK", callback_data: `pkg_risk_NO_RISK_${packageId}` }],
              [{ text: "🟢 LOW", callback_data: `pkg_risk_LOW_${packageId}` }],
              [{ text: "🟡 LOW_MEDIUM", callback_data: `pkg_risk_LOW_MEDIUM_${packageId}` }],
              [{ text: "🟠 MEDIUM", callback_data: `pkg_risk_MEDIUM_${packageId}` }],
              [{ text: "🔴 MEDIUM_HIGH", callback_data: `pkg_risk_MEDIUM_HIGH_${packageId}` }],
              [{ text: "⚫ HIGH", callback_data: `pkg_risk_HIGH_${packageId}` }],
              [{ text: "🔙 Cancel", callback_data: `edit_package_${packageId}` }],
            ],
          },
        }
      );
      return;
    }

    if (field === "description") {
      // Get description input
      ctx.session.editPackageId = packageId;
      ctx.session.editPackageField = field;
      ctx.session.editPackageStep = "enter_description";

      await ctx.reply(
        `<b>📝 Enter Package Description</b>\n\n
Current: ${pkg.description || "Not set"}\n\n
Enter new description (or send /cancel to skip):`,
        { parse_mode: "HTML" }
      );
      return;
    }

    ctx.session.editPackageId = packageId;
    ctx.session.editPackageField = field;
    ctx.session.editPackageStep = "enter_value";

    const fieldNames: any = {
      minAmount: "Minimum Amount",
      maxAmount: "Maximum Amount",
      roiPercentage: "ROI Percentage",
      duration: "Duration (in days)",
    };

    await ctx.reply(`Enter ${fieldNames[field] || field}:`, { parse_mode: "HTML" });
  } catch (error) {
    logger.error("Error updating package field:", error);
    await ctx.reply("❌ Error", { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Confirm package update
 */
export async function handleConfirmPackageUpdate(
  ctx: SessionContext,
  value: string | number
): Promise<void> {
  try {
    const { editPackageId, editPackageField } = ctx.session;
    const pkg = await PackageService.getPackageById(editPackageId);

    if (!pkg) {
      await ctx.reply("❌ Package not found");
      return;
    }

    // Handle description field (string value)
    if (editPackageField === "description") {
      const description = value.toString().trim();

      await prisma.package.update({
        where: { id: editPackageId },
        data: { description },
      });

      await ctx.reply(
        `✅ <b>Package Description Updated</b>\n\n
${pkg.icon} ${pkg.name}\n
Description: ${description || "Not set"}`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✏️ Edit More", callback_data: `edit_package_${editPackageId}` }],
              [{ text: "📦 Back to Packages", callback_data: "manage_packages" }],
            ],
          },
        }
      );

      delete ctx.session.editPackageId;
      delete ctx.session.editPackageField;
      ctx.session.editPackageStep = undefined;
      return;
    }

    // Handle numeric fields
    const numValue = typeof value === "string" ? parseFloat(value) : value;

    if (isNaN(numValue) || numValue <= 0) {
      await ctx.reply("❌ Please enter a valid number");
      return;
    }

    const updateData: any = {};
    updateData[editPackageField] = numValue;

    await prisma.package.update({
      where: { id: editPackageId },
      data: updateData,
    });

    const fieldNames: any = {
      minAmount: "Minimum Amount",
      maxAmount: "Maximum Amount",
      roiPercentage: "ROI Percentage",
      duration: "Duration (days)",
    };

    await ctx.reply(
      `✅ <b>Package Updated</b>\n\n
${pkg.icon} ${pkg.name}\n
${fieldNames[editPackageField]}: ${value}`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✏️ Edit More", callback_data: `edit_package_${editPackageId}` }],
            [{ text: "📦 Back to Packages", callback_data: "manage_packages" }],
          ],
        },
      }
    );

    delete ctx.session.editPackageId;
    delete ctx.session.editPackageField;
    ctx.session.editPackageStep = undefined;
  } catch (error) {
    logger.error("Error confirming package update:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`, { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Handle risk level selection
 */
export async function handleUpdateRiskLevel(
  ctx: SessionContext,
  packageId: string,
  riskLevel: string
): Promise<void> {
  try {
    const pkg = await PackageService.getPackageById(packageId);

    if (!pkg) {
      await ctx.reply("❌ Package not found");
      return;
    }

    await prisma.package.update({
      where: { id: packageId },
      data: { riskLevel: riskLevel as any },
    });

    await ctx.reply(
      `✅ <b>Risk Level Updated</b>\n\n
${pkg.icon} ${pkg.name}\n
Risk Level: <b>${riskLevel}</b>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✏️ Edit More", callback_data: `edit_package_${packageId}` }],
            [{ text: "📦 Back to Packages", callback_data: "manage_packages" }],
          ],
        },
      }
    );

    delete ctx.session.editPackageId;
    delete ctx.session.editPackageField;
    ctx.session.editPackageStep = undefined;
  } catch (error) {
    logger.error("Error updating risk level:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`, { reply_markup: adminMenuKeyboard });
  }
}

/**
 * Create new package
 */
export async function handleCreatePackage(
  ctx: SessionContext,
  data: Partial<any>
): Promise<void> {
  try {
    const { name, minAmount, maxAmount, roiPercentage, duration } = data;

    // Validate all required fields
    if (!name || !minAmount || !maxAmount || !roiPercentage || !duration) {
      await ctx.reply("❌ Missing required information");
      return;
    }

    if (minAmount >= maxAmount) {
      await ctx.reply("❌ Minimum amount must be less than maximum amount");
      return;
    }

    const newPackage = await prisma.package.create({
      data: {
        name,
        minAmount,
        maxAmount,
        roiPercentage,
        duration,
        icon: "💰",
        riskLevel: "MEDIUM",
      },
    });

    await ctx.reply(
      `✅ <b>Package Created!</b>\n\n
📦 ${newPackage.name}\n
💰 ${formatCurrency(newPackage.minAmount)} - ${formatCurrency(newPackage.maxAmount)}\n
📈 ROI: ${newPackage.roiPercentage}%\n
📅 Duration: ${newPackage.duration} days`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📦 Back to Packages", callback_data: "manage_packages" }],
            [{ text: "🔙 Back to Dashboard", callback_data: "back_to_admin" }],
          ],
        },
      }
    );

    delete ctx.session.addPackageData;
    ctx.session.addPackageStep = undefined;
  } catch (error) {
    logger.error("Error creating package:", error);
    await ctx.reply(`❌ Error: ${(error as Error).message}`, { reply_markup: adminMenuKeyboard });
  }
}
