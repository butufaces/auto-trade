import prisma from "../src/db/client.js";
import logger from "../src/config/logger.js";

async function deepDiagnostics() {
  try {
    console.log("🔬 DEEP DIAGNOSTICS - Referral Bonus Issue\n");
    console.log("=" .repeat(70) + "\n");

    // 1. Check if any users have referredBy set
    console.log("1️⃣  USERS WITH REFERREDBY SET (should have referred users):");
    const usersWithReferrer = await prisma.user.findMany({
      where: { referredBy: { not: null } },
      select: {
        id: true,
        username: true,
        email: true,
        referredBy: true,
        createdAt: true,
        totalInvested: true,
        investments: {
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    console.log(`   Total: ${usersWithReferrer.length}`);
    if (usersWithReferrer.length === 0) {
      console.log("   ❌ CRITICAL: No users have referredBy set!");
      console.log("      This means no users were registered via referral code.\n");
    } else {
      usersWithReferrer.forEach((user, idx) => {
        console.log(`\n   ${idx + 1}. ${user.email}`);
        console.log(`      Referred By: ${user.referredBy}`);
        console.log(`      Total Invested: $${user.totalInvested}`);
        console.log(`      Investments: ${user.investments.length}`);
        user.investments.forEach((inv) => {
          console.log(`         - $${inv.amount} (${inv.status}) - ${inv.createdAt}`);
        });
      });
    }

    // 2. Check all investments status breakdown
    console.log("\n\n2️⃣  ALL INVESTMENTS BY STATUS:");
    const investmentsByStatus = await prisma.investment.groupBy({
      by: ["status"],
      _count: true,
    });

    const investmentStats = await Promise.all(
      investmentsByStatus.map(async (stat) => {
        const count = await prisma.investment.count({
          where: { status: stat.status as any },
        });
        return { status: stat.status, count };
      })
    );

    investmentStats.forEach((stat) => {
      console.log(`   • ${stat.status}: ${stat.count}`);
    });

    // 3. Check users with referral codes (referrers/promoters)
    console.log("\n\n3️⃣  USERS WITH REFERRAL CODES (referrers):");
    const allReferrers = await prisma.user.findMany({
      where: { referralCode: { not: null } },
      select: {
        id: true,
        username: true,
        email: true,
        referralCode: true,
        referralCount: true,
        referralEarnings: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    console.log(`   Total: ${allReferrers.length}`);
    allReferrers.forEach((user) => {
      const match = user.email === "bitcoinbiz247@gmail.com" ? " ⭐" : "";
      console.log(
        `   • ${user.referralCode} ${match}`
      );
      console.log(`     Email: ${user.email}`);
      console.log(`     Referrals: ${user.referralCount}, Earnings: $${user.referralEarnings}`);
    });

    // 4. Check config settings
    console.log("\n\n4️⃣  REFERRAL SETTINGS:");
    const settings = await prisma.settings.findMany({
      where: {
        key: { contains: "REFERRAL", mode: "insensitive" },
      },
    });

    console.log(`   Database Settings: ${settings.length}`);
    settings.forEach((setting) => {
      console.log(`   • ${setting.key} = ${setting.value}`);
    });

    // Check env config
    try {
      const { config } = await import("../src/config/env.js");
      console.log(`\n   Environment Config:`);
      console.log(`   • ENABLE_REFERRAL_BONUS: ${config.ENABLE_REFERRAL_BONUS}`);
      console.log(`   • REFERRAL_BONUS_PERCENTAGE: ${config.REFERRAL_BONUS_PERCENTAGE}%`);
    } catch (e) {
      console.log(`   Error reading env config: ${(e as Error).message}`);
    }

    // 5. Check specific user (the one requested)
    console.log("\n\n5️⃣  TARGET USER: REF_7227777071_MMC57O6G");
    const targetUser = await prisma.user.findUnique({
      where: { referralCode: "REF_7227777071_MMC57O6G" },
      include: {
        _count: {
          select: {
            referralBonuses: true,
          },
        },
      },
    });

    if (targetUser) {
      console.log(`   ✅ Found user: ${targetUser.email}`);
      console.log(`   ID: ${targetUser.id}`);
      console.log(`   Referral Count DB: ${targetUser.referralCount}`);
      console.log(`   Referral Earnings DB: $${targetUser.referralEarnings}`);
      console.log(`   Bonus Records: ${targetUser._count.referralBonuses}`);

      // Check users who were referred
      const referredByThisUser = await prisma.user.findMany({
        where: { referredBy: "REF_7227777071_MMC57O6G" },
      });
      console.log(`   Users Referred: ${referredByThisUser.length}`);
    }

    // 6. Check for any error logs related to bonuses
    console.log("\n\n6️⃣  RECENT LOGS (checking for errors):");
    const recentErrors = await prisma.adminLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const errorLogs = recentErrors.filter(
      (log) =>
        log.action.toLowerCase().includes("error") ||
        log.action.toLowerCase().includes("fail") ||
        log.details && (log.details.toLowerCase().includes("error") ||
        log.details.toLowerCase().includes("fail"))
    );

    console.log(`   Total Recent Logs: ${recentErrors.length}`);
    console.log(`   Error Logs: ${errorLogs.length}`);

    if (errorLogs.length > 0) {
      errorLogs.slice(0, 5).forEach((log, idx) => {
        console.log(`\n   ${idx + 1}. ${log.action}`);
        console.log(`      ${log.details ? log.details.substring(0, 120) : "(no details)"}...`);
      });
    }

    // SUMMARY
    console.log("\n\n" + "=".repeat(70));
    console.log("📊 DIAGNOSIS SUMMARY:\n");

    if (usersWithReferrer.length === 0) {
      console.log(
        "🔴 ISSUE #1: No users were registered with referral codes"
      );
      console.log(
        "   → Check if users are actually being referred when they sign up"
      );
      console.log(
        "   → Verify the referral flow in the signup process\n"
      );
    } else {
      const investmentStats2 = await Promise.all(
        usersWithReferrer.map(async (user) => {
          const activeInvs = await prisma.investment.count({
            where: {
              userId: user.id,
              status: { in: ["ACTIVE", "COMPLETED", "MATURED"] },
            },
          });
          return {
            user: user.email,
            activeInvestments: activeInvs,
          };
        })
      );

      const totalActiveInv = investmentStats2.reduce((sum, s) => sum + s.activeInvestments, 0);

      console.log(
        `✅ ${usersWithReferrer.length} users were registered via referral`
      );
      console.log(`✅ ${totalActiveInv} investments from referred users are ACTIVE/COMPLETED`);

      if (totalActiveInv > 0) {
        console.log(
          "🔴 ISSUE #2: creditReferralBonus was never called or failed silently"
        );
        console.log(
          "   → Bonuses should exist for these investments but don't"
        );
        console.log(
          "   → Check logs or add error handling\n"
        );
      }
    }

    const totalBonuses = await prisma.referralBonus.count();
    console.log(`🔴 NO REFERRAL BONUSES: ${totalBonuses} total in system`);
    console.log(
      "   → This is the root issue - no bonuses were ever created\n"
    );

  } catch (error) {
    console.error("❌ Error during diagnostics:", error);
    logger.error("Diagnostics error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

deepDiagnostics();
