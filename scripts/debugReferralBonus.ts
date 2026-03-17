import prisma from "../src/db/client.js";

async function debugReferralBonus() {
  try {
    // Step 1: Find the user by referral code - with fallback search
    let user = await prisma.user.findUnique({
      where: { referralCode: "REF_7227777071_MMHORAD8" },
    });

    if (!user) {
      console.log("❌ Exact referral code not found: REF_7227777071_MMHORAD8");
      console.log("\n🔍 Searching for similar referral codes...");
      
      // Search for users with 7227777071
      const allUsers = await prisma.user.findMany({
        where: {
          referralCode: {
            contains: "7227777071",
            mode: "insensitive",
          },
        },
      });

      console.log(`Found ${allUsers.length} users with '7227777071' in referral code:`);
      allUsers.forEach((u) => {
        console.log(
          `  - ${u.referralCode} (ID: ${u.id}, Username: ${u.username}, Earnings: $${u.referralEarnings})`
        );
      });

      if (allUsers.length > 0) {
        user = allUsers[0]; // Use first match
        console.log(`\nusing user: ${user.referralCode}`);
      } else {
        // Also search by MMHORAD8 pattern
        const altUsers = await prisma.user.findMany({
          where: {
            referralCode: {
              contains: "MMHORAD8",
              mode: "insensitive",
            },
          },
        });

        if (altUsers.length > 0) {
          console.log(`\nFound ${altUsers.length} users with 'MMHORAD8' pattern:`);
          altUsers.forEach((u) => {
            console.log(`  - ${u.referralCode} (ID: ${u.id})`);
          });
          user = altUsers[0];
        } else {
          console.log("\nNo matches found. Listing all users with referral codes:");
          const allReferral = await prisma.user.findMany({
            where: { referralCode: { not: null } },
            select: {
              id: true,
              username: true,
              referralCode: true,
              referralCount: true,
              referralEarnings: true,
            },
            orderBy: { referralEarnings: "desc" },
            take: 10,
          });
          allReferral.forEach((u) => {
            console.log(
              `  - ${u.referralCode} (${u.username}) - Count: ${u.referralCount}, Earnings: $${u.referralEarnings}`
            );
          });
          process.exit(1);
        }
      }
    }

    console.log("✅ Found user:");
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Referral Code: ${user.referralCode}`);
    console.log(`   Referral Count: ${user.referralCount}`);
    console.log(`   Referral Earnings: $${user.referralEarnings}`);
    console.log("");

    // Step 2: Get all ReferralBonus records for this user as referrer
    const referralBonuses = await prisma.referralBonus.findMany({
      where: { referrerId: user.id },
      include: {
        investment: {
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true,
            activatedAt: true,
            completedAt: true,
          },
        },
        referredUser: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`📊 ReferralBonus Records Found: ${referralBonuses.length}`);
    console.log("");

    if (referralBonuses.length === 0) {
      console.log("⚠️  No referral bonus records found for this user!");
    } else {
      let totalBonusAmount = 0;
      const statusCounts: Record<string, number> = {};

      referralBonuses.forEach((bonus, index) => {
        totalBonusAmount += bonus.bonusAmount;
        statusCounts[bonus.status] = (statusCounts[bonus.status] || 0) + 1;

        console.log(`\n📌 Record ${index + 1}:`);
        console.log(`   Bonus ID: ${bonus.id}`);
        console.log(`   Referrer ID: ${bonus.referrerId}`);
        console.log(`   Investment ID: ${bonus.investmentId}`);
        console.log(`   Referred User: ${bonus.referredUser?.username || "None"}`);
        console.log(`   Bonus Amount: $${bonus.bonusAmount}`);
        console.log(`   Bonus Percentage: ${bonus.bonusPercentage}%`);
        console.log(`   Investment Amount: $${bonus.investmentAmount}`);
        console.log(`   Status: ${bonus.status}`);
        console.log(`   Credited At: ${bonus.creditedAt}`);
        console.log(`   Withdrawn At: ${bonus.withdrawnAt || "Not withdrawn"}`);
        console.log(`   Investment Status: ${bonus.investment?.status}`);
        console.log(`   Investment Created: ${bonus.investment?.createdAt}`);
        console.log(`   Investment Activated: ${bonus.investment?.activatedAt || "Not activated"}`);
      });

      console.log("\n\n📈 Summary:");
      console.log(`   Total Bonus Records: ${referralBonuses.length}`);
      console.log(`   Total Bonus Amount: $${totalBonusAmount}`);
      console.log(`   Status Breakdown:`, statusCounts);
    }

    // Step 3: Check for any AdminLog ERROR entries related to referral
    const referralLogs = await prisma.adminLog.findMany({
      where: {
        action: {
          contains: "referral",
          mode: "insensitive",
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    console.log("\n\n🔍 Recent Referral-Related Logs:");
    if (referralLogs.length === 0) {
      console.log("   No referral-related logs found");
    } else {
      referralLogs.forEach((log, index) => {
        console.log(`\n   Log ${index + 1}:`);
        console.log(`      Action: ${log.action}`);
        console.log(`      Details: ${log.details}`);
        console.log(`      Timestamp: ${log.createdAt}`);
      });
    }

    // Step 4: Check recent investments for referred users
    const referredUsers = await prisma.user.findMany({
      where: { referredBy: user.id },
      select: {
        id: true,
        username: true,
        referredBy: true,
        totalInvested: true,
        createdAt: true,
        investments: {
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true,
          },
          take: 5,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    console.log("\n\n👥 Users Referred By This User:", referredUsers.length);
    referredUsers.forEach((refUser, index) => {
      console.log(`\n   Referred User ${index + 1}:`);
      console.log(`      Username: ${refUser.username}`);
      console.log(`      Total Invested: $${refUser.totalInvested}`);
      console.log(`      Created: ${refUser.createdAt}`);
      console.log(`      Recent Investments: ${refUser.investments.length}`);
      refUser.investments.forEach((inv, invIdx) => {
        console.log(
          `         Investment ${invIdx + 1}: $${inv.amount} (${inv.status}) - ${inv.createdAt}`
        );
      });
    });

  } catch (error) {
    console.error("❌ Error during debugging:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugReferralBonus();
