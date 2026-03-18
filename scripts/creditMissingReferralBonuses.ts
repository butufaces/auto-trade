import prisma from "../src/db/client.js";
import logger from "../src/config/logger.js";
import ReferralService from "../src/services/referral.js";

/**
 * Recovery script: Credit bonuses for all ACTIVE investments that don't have a bonus record
 * Run this ONCE after deploying the referral bonus fix
 */
async function creditMissingReferralBonuses() {
  try {
    console.log("🔄 RECOVERY: Crediting Missing Referral Bonuses\n");
    console.log("=" .repeat(70) + "\n");

    // Find all ACTIVE/COMPLETED/MATURED investments
    const activeInvestments = await prisma.investment.findMany({
      where: {
        status: { in: ["ACTIVE", "COMPLETED", "MATURED"] },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            referredBy: true,
            firstName: true,
            lastName: true,
          },
        },
        referralBonus: true, // Get related bonus if it exists
      },
      orderBy: { activatedAt: "desc" },
    });

    console.log(`Found ${activeInvestments.length} active/completed investments\n`);

    // Filter those without bonus records
    const investmentsMissingBonus = activeInvestments.filter(
      (inv) => !inv.referralBonus && inv.user.referredBy
    );

    console.log(
      `🎁 Investments missing bonus records: ${investmentsMissingBonus.length}\n`
    );

    if (investmentsMissingBonus.length === 0) {
      console.log("✅ No missing bonuses found. All investments are properly credited!\n");
      await prisma.$disconnect();
      return;
    }

    let creditedCount = 0;
    let failedCount = 0;
    const failures = [];

    for (const investment of investmentsMissingBonus) {
      try {
        console.log(
          `⏳ Processing: ${investment.user.email} - $${investment.amount}`
        );

        // Check if user has a referrer
        if (!investment.user.referredBy) {
          console.log(`   ❌ User not referred (referredBy = NULL)\n`);
          failedCount++;
          failures.push({
            investmentId: investment.id,
            reason: "User has no referrer",
          });
          continue;
        }

        // Call creditReferralBonus
        await ReferralService.creditReferralBonus(
          investment.id,
          investment.amount,
          investment.userId
        );

        console.log(`   ✅ Bonus credited successfully\n`);
        creditedCount++;
      } catch (error) {
        console.log(
          `   ❌ Error: ${(error as Error).message}\n`
        );
        failedCount++;
        failures.push({
          investmentId: investment.id,
          reason: (error as Error).message,
        });
      }
    }

    // Summary
    console.log("=" .repeat(70));
    console.log("\n📊 RECOVERY SUMMARY:\n");
    console.log(`✅ Successfully credited: ${creditedCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log(
      `\nTotal bonuses created: ${creditedCount}`
    );

    if (failures.length > 0) {
      console.log(`\n⚠️  Failed Investments (${failures.length}):\n`);
      failures.slice(0, 10).forEach((fail, idx) => {
        console.log(`${idx + 1}. Investment: ${fail.investmentId}`);
        console.log(`   Reason: ${fail.reason}\n`);
      });

      if (failures.length > 10) {
        console.log(`... and ${failures.length - 10} more\n`);
      }
    }

    console.log("=" .repeat(70));
    console.log("\n💡 Next Steps:\n");
    if (creditedCount > 0) {
      console.log(
        `✅ ${creditedCount} bonuses have been credited to referrers`
      );
      console.log("   Check referrer dashboards to verify earnings are updated\n");
    }
    if (failures.length > 0) {
      console.log(
        `⚠️  ${failedCount} investments still need attention`
      );
      console.log(
        "   For users with referredBy=NULL, use admin tool to manually link them\n"
      );
    }
  } catch (error) {
    console.error("❌ Recovery script error:", error);
    logger.error("Recovery error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

creditMissingReferralBonuses();
