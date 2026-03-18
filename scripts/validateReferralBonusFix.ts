import prisma from "../src/db/client.js";
import logger from "../src/config/logger.js";

/**
 * Validate that the referral bonus fix is working correctly
 * This script checks:
 * 1. That ReferralBonus records exist
 * 2. That referrer's referralCount is accurate
 * 3. That referrer's referralEarnings are correct
 * 4. That stats display correctly
 */
async function validateReferralBonusFix() {
  try {
    console.log("🔍 VALIDATING REFERRAL BONUS FIX\n");
    console.log("=".repeat(70) + "\n");

    // 1. Check if any referral bonuses exist
    console.log("1️⃣  REFERRAL BONUS RECORDS:");
    const totalBonuses = await prisma.referralBonus.count();
    const creditedBonuses = await prisma.referralBonus.count({
      where: { status: "CREDITED" },
    });
    const failedBonuses = await prisma.referralBonus.count({
      where: { status: "FAILED" },
    });

    console.log(`   Total Bonus Records: ${totalBonuses}`);
    console.log(`   ✅ CREDITED: ${creditedBonuses}`);
    console.log(`   ❌ FAILED: ${failedBonuses}\n`);

    if (totalBonuses === 0) {
      console.log("   ⚠️  No bonuses found yet. Run investments through the system first.\n");
    }

    // 2. Check referrers with stats
    console.log("2️⃣  REFERRER STATS VALIDATION:");
    const referrers = await prisma.user.findMany({
      where: {
        referralCode: { not: null },
        referralCount: { gt: 0 },
      },
      select: {
        id: true,
        email: true,
        referralCode: true,
        referralCount: true,
        referralEarnings: true,
        totalEarned: true,
        _count: {
          select: {
            referralBonuses: true,
          },
        },
      },
      orderBy: { referralCount: "desc" },
      take: 10,
    });

    console.log(`   Found ${referrers.length} referrers with active referrals\n`);

    if (referrers.length === 0) {
      console.log("   ℹ️  No referrers found with referral count > 0\n");
    } else {
      for (const referrer of referrers) {
        console.log(`   📊 ${referrer.email}`);
        console.log(`      Referral Code: ${referrer.referralCode}`);
        console.log(`      Active Referrals: ${referrer.referralCount}`);
        console.log(`      Total Earnings: $${referrer.referralEarnings.toFixed(2)}`);
        console.log(`      Total Earned: $${referrer.totalEarned.toFixed(2)}`);
        console.log(`      Bonus Records: ${referrer._count.referralBonuses}`);

        // Validate: referralCount should match number of CREDITED bonuses
        const creditedBonusesForReferrer = await prisma.referralBonus.count({
          where: {
            referrerId: referrer.id,
            status: "CREDITED",
          },
        });

        const totalEarningsFromBonuses = await prisma.referralBonus.aggregate({
          where: {
            referrerId: referrer.id,
            status: "CREDITED",
          },
          _sum: {
            bonusAmount: true,
          },
        });

        const expectedEarnings = totalEarningsFromBonuses._sum.bonusAmount || 0;

        const earningsMatch = Math.abs(referrer.referralEarnings - expectedEarnings) < 0.01;
        const countMatch = referrer.referralCount === creditedBonusesForReferrer;

        console.log(`      ✅ Count Match: ${countMatch ? "YES" : "NO"} (Expected: ${creditedBonusesForReferrer}, Got: ${referrer.referralCount})`);
        console.log(`      ✅ Earnings Match: ${earningsMatch ? "YES" : "NO"} (Expected: $${expectedEarnings.toFixed(2)}, Got: $${referrer.referralEarnings.toFixed(2)})`);
        console.log("");
      }
    }

    // 3. Check recent credited bonuses
    console.log("\n3️⃣  RECENT CREDITED BONUSES:");
    const recentBonuses = await prisma.referralBonus.findMany({
      where: { status: "CREDITED" },
      include: {
        referrer: {
          select: { email: true, referralCode: true },
        },
        referredUser: {
          select: { email: true },
        },
        investment: {
          select: { amount: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    console.log(`   Found ${recentBonuses.length} recent credited bonuses\n`);

    if (recentBonuses.length === 0) {
      console.log("   ℹ️  No credited bonuses found yet\n");
    } else {
      for (const bonus of recentBonuses) {
        console.log(`   💰 Bonus: $${bonus.bonusAmount.toFixed(2)} (${bonus.bonusPercentage}%)`);
        console.log(`      Referrer: ${bonus.referrer.email}`);
        console.log(`      Referred User: ${bonus.referredUser?.email || "Unknown"}`);
        console.log(`      Investment Amount: $${bonus.investmentAmount.toFixed(2)}`);
        console.log(`      Date: ${bonus.createdAt.toISOString()}`);
        console.log("");
      }
    }

    // 4. Test the getUserReferralStats function
    if (referrers.length > 0) {
      console.log("\n4️⃣  TESTING getUserReferralStats():");
      const testReferrer = referrers[0];

      const stats = await prisma.user.findUnique({
        where: { id: testReferrer.id },
        select: {
          referralCode: true,
          referralCount: true,
          referralEarnings: true,
          referralBonuses: {
            where: { status: "CREDITED" },
            select: {
              bonusAmount: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      console.log(`   User: ${testReferrer.email}`);
      console.log(`   Referral Code: ${stats?.referralCode}`);
      console.log(`   Referral Count: ${stats?.referralCount}`);
      console.log(`   Referral Earnings: $${stats?.referralEarnings.toFixed(2)}`);
      console.log(`   Credited Bonuses: ${stats?.referralBonuses.length}`);

      if (stats && stats.referralBonuses.length > 0) {
        const totalFromBonuses = stats.referralBonuses.reduce((sum, b) => sum + b.bonusAmount, 0);
        const averageBonus = totalFromBonuses / stats.referralBonuses.length;
        console.log(`   Average Bonus: $${averageBonus.toFixed(2)}`);

        const earningsMatchStats = Math.abs(stats.referralEarnings - totalFromBonuses) < 0.01;
        console.log(`   ✅ Earnings Validation: ${earningsMatchStats ? "PASS" : "FAIL"}`);
      }
    }

    // Summary
    console.log("\n" + "=".repeat(70));
    console.log("📊 VALIDATION SUMMARY:\n");

    if (totalBonuses === 0) {
      console.log("❌ No bonuses found - the fix cannot be validated yet");
      console.log("   → Run a test investment with referral to generate bonuses\n");
    } else if (creditedBonuses > 0) {
      console.log(`✅ Fix is working! Found ${creditedBonuses} credited bonuses`);
      console.log("   → referralCount should be incrementing");
      console.log("   → referralEarnings should be accumulating");
      console.log("   → Dashboard stats should display correctly\n");
    } else {
      console.log("⚠️ Bonuses exist but all are FAILED");
      console.log("   → This indicates users don't have referrers set");
      console.log("   → Check that users are signing up with referral codes\n");
    }

    console.log("=".repeat(70));
  } catch (error) {
    console.error("❌ Validation error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

validateReferralBonusFix();
