#!/usr/bin/env node
import prisma from "../src/db/client.js";
import ReferralService from "../src/services/referral.js";
import logger from "../src/config/logger.js";

/**
 * Script to audit and fix referral bonus issues
 * Usage: npm run credits:missing-bonuses
 */

async function auditAndFixReferrals() {
  try {
    console.log("\n=== REFERRAL BONUS AUDIT & FIX ===\n");

    // 1. Check all ACTIVE investments
    console.log("📊 1. Checking ACTIVE investments...");
    const activeInvestments = await prisma.investment.findMany({
      where: { status: "ACTIVE" },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            referredBy: true,
            referralCode: true,
          }
        },
        referralBonus: {
          select: { bonusAmount: true }
        }
      }
    });

    console.log(`   Found: ${activeInvestments.length} ACTIVE investments\n`);

    // 2. Identify investments that should have bonuses but don't
    console.log("🔍 2. Identifying investments needing bonus credit...");
    const investmentsNeedingBonus = activeInvestments.filter((inv: any) => {
      const hasReferrer = !!inv.user.referredBy;
      const hasBonus = !!inv.referralBonus;
      return hasReferrer && !hasBonus;
    });

    console.log(`   Found: ${investmentsNeedingBonus.length} investments with referrer but no bonus\n`);

    if (investmentsNeedingBonus.length === 0) {
      console.log("✅ All investments with referrers have bonuses credited!\n");

      // 3. Identify investments without referrers
      const investmentsWithoutReferrer = activeInvestments.filter((inv: any) => !inv.user.referredBy);
      if (investmentsWithoutReferrer.length > 0) {
        console.log(`⚠️  ${investmentsWithoutReferrer.length} ACTIVE investments WITHOUT referrer:`);
        investmentsWithoutReferrer.forEach((inv: any) => {
          console.log(`   - ${inv.id}: ${inv.user.firstName} (amount: $${inv.amount})`);
        });
        console.log("\n💡 These users were NOT registered with a referral code\n");
      }

      process.exit(0);
      return;
    }

    // 4. Credit missing bonuses
    console.log("💳 3. Crediting missing referral bonuses...\n");
    let credited = 0;
    let failed = 0;

    for (const investment of investmentsNeedingBonus) {
      console.log(`Processing: ${investment.user.firstName} - Investment $${investment.amount}`);
      
      try {
        await ReferralService.creditReferralBonus(
          investment.id,
          investment.amount,
          investment.userId
        );
        console.log(`✅ CREDITED\n`);
        credited++;
      } catch (error) {
        console.log(`❌ FAILED: ${error instanceof Error ? error.message : String(error)}\n`);
        failed++;
      }
    }

    // 5. Final summary
    console.log("\n=== SUMMARY ===");
    console.log(`✅ Successfully credited: ${credited}`);
    console.log(`❌ Failed to credit: ${failed}`);
    console.log(`📊 Total processed: ${investmentsNeedingBonus.length}\n`);

    // 6. Verify fix
    if (credited > 0) {
      console.log("🔍 Verifying fix...");
      const user = await prisma.user.findMany({
        where: {
          referralBonuses: { some: {} }
        },
        select: {
          firstName: true,
          lastName: true,
          referralEarnings: true,
          referralCount: true,
          referralBonuses: {
            select: { bonusAmount: true }
          }
        },
        take: 3
      });

      console.log("\nTop referrers after fix:");
      user.forEach((u: any) => {
        const totalBonus = u.referralBonuses.reduce((sum: number, b: any) => sum + b.bonusAmount, 0);
        console.log(`   ${u.firstName} ${u.lastName}: $${u.referralEarnings} (${u.referralCount} referrals)`);
      });
    }

    process.exit(0);
  } catch (error) {
    logger.error("Error in audit:", error);
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

auditAndFixReferrals();
