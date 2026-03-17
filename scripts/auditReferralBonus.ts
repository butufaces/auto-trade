import prisma from "../src/db/client.js";

async function comprehensiveReferralAudit() {
  try {
    console.log("🔍 COMPREHENSIVE REFERRAL BONUS AUDIT\n");
    console.log("=" .repeat(60) + "\n");

    const targetCode = "REF_7227777071_MMHORAD8";
    const userId = "cmmc57o6s00047d8bvnji37kq";

    // Get the user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    console.log("📋 TARGET USER DETAILS:");
    console.log(`   Referral Code: ${user?.referralCode}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Username: ${user?.username || "(null)"}`);
    console.log(`   Email: ${user?.email || "(null)"}`);
    console.log(`   Status: ${user?.status}`);
    console.log(`   Referral Count (DB): ${user?.referralCount}`);
    console.log(`   Referral Earnings (DB): $${user?.referralEarnings}`);
    console.log(`   Created: ${user?.createdAt}\n`);

    // Check referred users
    console.log("👥 REFERRED USERS:");
    const referredUsers = await prisma.user.findMany({
      where: { referredBy: userId },
      include: {
        investments: {
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true,
            activatedAt: true,
          },
        },
      },
    });

    console.log(`   Count: ${referredUsers.length}`);
    if (referredUsers.length > 0) {
      referredUsers.forEach((refUser, idx) => {
        console.log(`\n   ${idx + 1}. ${refUser.username || "(no username)"}`);
        console.log(`      ID: ${refUser.id}`);
        console.log(`      Email: ${refUser.email || "(no email)"}`);
        console.log(`      Created: ${refUser.createdAt}`);
        console.log(`      Total Invested: $${refUser.totalInvested}`);
        console.log(`      Investments Count: ${refUser.investments.length}`);

        refUser.investments.forEach((inv, invIdx) => {
          console.log(
            `         ${invIdx + 1}) $${inv.amount} - ${inv.status} (${inv.createdAt})`
          );
        });
      });
    } else {
      console.log("   ❌ No referred users found!\n");
    }

    // Check ReferralBonus records
    console.log("\n💰 REFERRAL BONUS RECORDS:");
    const bonuses = await prisma.referralBonus.findMany({
      where: { referrerId: userId },
      include: {
        investment: {
          select: {
            id: true,
            amount: true,
            status: true,
            userId: true,
          },
        },
        referredUser: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    console.log(`   Count: ${bonuses.length}`);
    if (bonuses.length > 0) {
      bonuses.forEach((bonus, idx) => {
        console.log(`\n   ${idx + 1}. Bonus ID: ${bonus.id}`);
        console.log(`      Amount: $${bonus.bonusAmount}`);
        console.log(`      Percentage: ${bonus.bonusPercentage}%`);
        console.log(`      Investment Amount: $${bonus.investmentAmount}`);
        console.log(`      Status: ${bonus.status}`);
        console.log(`      Investment ID: ${bonus.investmentId}`);
        console.log(`      Investment Status: ${bonus.investment?.status}`);
        console.log(`      Credited At: ${bonus.creditedAt}`);
      });
    } else {
      console.log("   ❌ No referral bonus records found!\n");
    }

    // Check if there should be bonuses based on referred user investments
    console.log("\n🚨 EXPECTED vs ACTUAL BONUSES:");
    if (referredUsers.length > 0) {
      // For each referred user, check their active investments
      for (const refUser of referredUsers) {
        const activeInvestments = refUser.investments.filter(
          (inv) => inv.status === "ACTIVE" || inv.status === "COMPLETED"
        );

        if (activeInvestments.length > 0) {
          console.log(`\n   Referred User: ${refUser.username || refUser.id}`);
          activeInvestments.forEach((inv) => {
            const hasBonusRecord = bonuses.some(
              (b) => b.investmentId === inv.id
            );
            console.log(
              `      Investment $${inv.amount}: ${hasBonusRecord ? "✅ HAS BONUS" : "❌ NO BONUS"}`
            );
          });
        }
      }
    }

    // Check recent investments without bonus records
    console.log("\n🔎 INVESTMENTS WITHOUT CORRESPONDING BONUS RECORDS:");
    const allInvestmentsWithoutBonus = await prisma.investment.findMany({
      where: {
        user: {
          referredBy: userId,
        },
        referralBonus: null, // Has no referral bonus record
        status: {
          in: ["ACTIVE", "COMPLETED"],
        },
      },
      include: {
        user: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    if (allInvestmentsWithoutBonus.length > 0) {
      console.log(
        `   Found ${allInvestmentsWithoutBonus.length} investments without bonus records:`
      );
      allInvestmentsWithoutBonus.forEach((inv) => {
        console.log(`      - $${inv.amount} by ${inv.user.username || inv.user.email} (Status: ${inv.status})`);
      });
    } else {
      console.log("   None found");
    }

    // Check AdminLogs for issues
    console.log("\n📝 SYSTEM LOGS:");
    const recentLogs = await prisma.adminLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const referralRelatedLogs = recentLogs.filter(
      (log) =>
        log.action.toLowerCase().includes("referral") ||
        log.action.toLowerCase().includes("bonus") ||
        (log.details && log.details.toLowerCase().includes("referral")) ||
        (log.details && log.details.toLowerCase().includes("bonus"))
    );

    console.log(`   Total Recent Logs: ${recentLogs.length}`);
    console.log(`   Referral-Related Logs: ${referralRelatedLogs.length}`);

    if (referralRelatedLogs.length > 0) {
      referralRelatedLogs.slice(0, 10).forEach((log, idx) => {
        console.log(`\n   ${idx + 1}. ${log.action}`);
        console.log(`      ${log.details}`);
        console.log(`      ${log.createdAt}`);
      });
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY:");
    console.log(
      `   • Referral Code: ${user?.referralCode} (requested: ${targetCode})`
    );
    console.log(`   • Referred Users: ${referredUsers.length}`);
    console.log(`   • Referral Bonus Records: ${bonuses.length}`);
    console.log(`   • Total Bonus Amount: $${bonuses.reduce((sum, b) => sum + b.bonusAmount, 0)}`);
    console.log(
      `   • Investments Without Bonus: ${allInvestmentsWithoutBonus.length}`
    );

    if (referredUsers.length > 0 && bonuses.length === 0) {
      console.log(
        "\n   ⚠️  ISSUE: User has referred users with investments BUT NO BONUS RECORDS!"
      );
      console.log("      This suggests a bug in the referral bonus creation logic.");
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

comprehensiveReferralAudit();
