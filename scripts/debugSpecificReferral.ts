import prisma from "../src/db/client.js";
import logger from "../src/config/logger.js";

async function debugSpecificReferral() {
  try {
    console.log("🔍 DEBUGGING SPECIFIC REFERRAL: REF_7227777071_MMHORAD8\n");

    // 1. Find the referrer user
    const referrer = await prisma.user.findFirst({
      where: {
        referralCode: {
          contains: "7227777071"
        }
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        referralCode: true,
        referralCount: true,
        referralEarnings: true,
        totalEarned: true,
      }
    });

    console.log("📌 REFERRER (who should receive bonus):");
    if (referrer) {
      console.log(`   Name: ${referrer.firstName} ${referrer.lastName}`);
      console.log(`   Email: ${referrer.email}`);
      console.log(`   Referral Code: ${referrer.referralCode}`);
      console.log(`   Referral Count: ${referrer.referralCount}`);
      console.log(`   Referral Earnings: $${referrer.referralEarnings}`);
      console.log(`   Total Earned: $${referrer.totalEarned}\n`);

      // 2. Find users referred by this code
      const referredUsers = await prisma.user.findMany({
        where: {
          referredBy: referrer.referralCode
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          referredBy: true,
          createdAt: true,
          totalInvested: true,
          investments: {
            select: {
              id: true,
              amount: true,
              status: true,
              activatedAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" }
          }
        }
      });

      console.log(`👥 REFERRED USERS (${referredUsers.length} found):`);
      if (referredUsers.length === 0) {
        console.log("   ❌ NO USERS FOUND WITH referredBy SET TO THIS CODE!");
        console.log("   This is the problem - referredBy field is not being populated.\n");
      } else {
        referredUsers.forEach((user, idx) => {
          console.log(`\n   ${idx + 1}. ${user.firstName} ${user.lastName}`);
          console.log(`      Email: ${user.email}`);
          console.log(`      Referred By: ${user.referredBy}`);
          console.log(`      Joined: ${user.createdAt}`);
          console.log(`      Investments: ${user.investments.length}`);
          
          user.investments.forEach((inv, invIdx) => {
            console.log(`         ${invIdx + 1}. $${inv.amount} - ${inv.status} (${inv.createdAt})`);
            if (inv.activatedAt) {
              console.log(`            Activated at: ${inv.activatedAt}`);
            }
          });
        });
      }

      // 3. Check ReferralBonus records for this referrer
      console.log(`\n💰 REFERRAL BONUS RECORDS for referrer ${referrer.id}:`);
      const bonusRecords = await prisma.referralBonus.findMany({
        where: {
          referrerId: referrer.id
        },
        select: {
          id: true,
          investmentId: true,
          bonusAmount: true,
          bonusPercentage: true,
          investmentAmount: true,
          status: true,
          creditedAt: true,
          createdAt: true,
        }
      });

      console.log(`   Total records: ${bonusRecords.length}`);
      if (bonusRecords.length === 0) {
        console.log("   ❌ NO BONUS RECORDS CREATED!");
      } else {
        bonusRecords.forEach((bonus) => {
          console.log(`\n   - Investment: ${bonus.investmentId}`);
          console.log(`     Amount: $${bonus.bonusAmount} (${bonus.bonusPercentage}% of $${bonus.investmentAmount})`);
          console.log(`     Status: ${bonus.status}`);
          console.log(`     Created: ${bonus.createdAt}`);
        });
      }

      // 4. For each investment, check if bonus was created
      console.log(`\n\n🔍 CHECKING EACH INVESTMENT:\n`);
      if (referredUsers.length > 0) {
        for (const refUser of referredUsers) {
          for (const investment of refUser.investments) {
            console.log(`Investment ${investment.id}:`);
            console.log(`  Amount: $${investment.amount}`);
            console.log(`  Status: ${investment.status}`);
            console.log(`  Created: ${investment.createdAt}`);
            console.log(`  Activated: ${investment.activatedAt || "NOT ACTIVATED"}`);

            // Check if bonus exists
            const bonus = await prisma.referralBonus.findFirst({
              where: {
                investmentId: investment.id
              }
            });

            if (bonus) {
              console.log(`  ✅ Bonus exists: $${bonus.bonusAmount}\n`);
            } else {
              console.log(`  ❌ NO BONUS CREATED!\n`);
              
              // This is where we'd want to manually credit it
              if (investment.status === "ACTIVE" && refUser.referredBy) {
                console.log(`     → This investment should have a bonus! Status is ACTIVE and referredBy is set.`);
                console.log(`     → Bonus should be: $${(investment.amount * 10) / 100} (10% of $${investment.amount})\n`);
              }
            }
          }
        }
      }

      // 5. Summary
      console.log("\n" + "=".repeat(70));
      console.log("📊 DIAGNOSIS:\n");
      
      if (referredUsers.length === 0) {
        console.log("🔴 ISSUE FOUND: No users have referredBy set to this code");
        console.log("   This means users didn't enter the referral code during signup");
        console.log("   Solution: Verify the registration flow is asking for referral codes\n");
      } else {
        const investmentsWithoutBonus = referredUsers.flatMap(u => 
          u.investments.filter(inv => !inv.activatedAt).map(inv => ({ user: u.firstName, inv }))
        );

        if (investmentsWithoutBonus.length > 0) {
          console.log(`🔴 ISSUE FOUND: ${investmentsWithoutBonus.length} investments not activated`);
          console.log("   These investments haven't reached ACTIVE status yet");
          console.log("   Bonuses are only credited when status = ACTIVE\n");
        }

        if (bonusRecords.length === 0 && referredUsers.some(u => u.investments.some(i => i.status === "ACTIVE"))) {
          console.log(`🔴 ISSUE FOUND: Investments are ACTIVE but no bonuses were created`);
          console.log("   The creditReferralBonus() function may be failing silently");
          console.log("   Check the logs for [REFERRAL] errors\n");
        }
      }

    } else {
      console.log("❌ Referrer not found with code containing '7227777071'");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    logger.error("Debug error:", error);
    process.exit(1);
  }
}

debugSpecificReferral();
