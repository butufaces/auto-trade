import prisma from "../src/db/client.js";

async function findReferralIssues() {
  try {
    console.log("🔍 SEARCHING FOR USERS WITH REFERRAL ISSUES\n");

    // Get all users with referral earnings > 0
    console.log("1. Users with referral earnings > $0:");
    const usersWithEarnings = await prisma.user.findMany({
      where: { referralEarnings: { gt: 0 } },
      select: {
        id: true,
        referralCode: true,
        username: true,
        email: true,
        referralCount: true,
        referralEarnings: true,
      },
      orderBy: { referralEarnings: "desc" },
    });

    console.log(`   Count: ${usersWithEarnings.length}`);
    usersWithEarnings.forEach((u) => {
      console.log(
        `   - ${u.referralCode} | ${u.username || u.email} | Count: ${u.referralCount} | Earnings: $${u.referralEarnings}`
      );
    });

    // Get all users who have made referrals
    console.log("\n2. Users who have referred other users:");
    const usersWhoReferred = await prisma.user.findMany({
      where: { referralCount: { gt: 0 } },
      select: {
        id: true,
        referralCode: true,
        username: true,
        email: true,
        referralCount: true,
        referralEarnings: true,
      },
      orderBy: { referralCount: "desc" },
    });

    console.log(`   Count: ${usersWhoReferred.length}`);
    usersWhoReferred.forEach((u) => {
      console.log(
        `   - ${u.referralCode} | ${u.username || u.email} | Count: ${u.referralCount} | Earnings: $${u.referralEarnings}`
      );
    });

    // Check all ReferralBonus records
    console.log("\n3. ALL ReferralBonus records in system:");
    const allBonuses = await prisma.referralBonus.findMany({
      include: {
        referrer: {
          select: { referralCode: true, username: true, email: true },
        },
        referredUser: {
          select: { username: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    console.log(`   Total Count: ${allBonuses.length}`);
    if (allBonuses.length > 0) {
      allBonuses.forEach((bonus, idx) => {
        console.log(`\n   ${idx + 1}. Bonus ID: ${bonus.id}`);
        console.log(
          `      Referrer: ${bonus.referrer.referralCode} (${bonus.referrer.email})`
        );
        console.log(
          `      Referred User: ${bonus.referredUser?.username || bonus.referredUser?.email}`
        );
        console.log(`      Amount: $${bonus.bonusAmount}`);
        console.log(`      Investment: $${bonus.investmentAmount}`);
        console.log(`      Status: ${bonus.status}`);
      });
    } else {
      console.log("   ⚠️  NO REFERRAL BONUS RECORDS IN ENTIRE SYSTEM!");
    }

    // Find similar referral codes
    console.log(
      "\n4. Searching for referral codes containing '7227777071' or 'MMHORAD8':"
    );
    const similarCodes = await prisma.user.findMany({
      where: {
        OR: [
          { referralCode: { contains: "7227777071", mode: "insensitive" } },
          { referralCode: { contains: "MMHORAD8", mode: "insensitive" } },
          { referralCode: { contains: "MMC57O6G", mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        referralCode: true,
        username: true,
        email: true,
        referralCount: true,
        referralEarnings: true,
      },
    });

    console.log(`   Found: ${similarCodes.length}`);
    similarCodes.forEach((u) => {
      console.log(`   - ${u.referralCode} | ${u.email} | Earnings: $${u.referralEarnings}`);
    });

    // Check investments connected to referrals
    console.log("\n5. Investments from referred users:");
    const referredUserInvestments = await prisma.investment.findMany({
      where: {
        user: {
          referredBy: { not: null },
        },
      },
      include: {
        user: {
          select: { username: true, email: true, referredBy: true },
        },
        referralBonus: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    console.log(`   Total: ${referredUserInvestments.length}`);
    if (referredUserInvestments.length > 0) {
      referredUserInvestments.forEach((inv, idx) => {
        const hasBonus = inv.referralBonus ? "✅" : "❌";
        console.log(
          `   ${idx + 1}. ${hasBonus} $${inv.amount} by ${inv.user.email} - Status: ${inv.status}`
        );
      });
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

findReferralIssues();
