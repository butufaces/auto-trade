import prisma from "../src/db/client.js";
import ReferralService from "../src/services/referral.js";

async function creditMissingReferralBonuses() {
  try {
    console.log("=== CREDITING MISSING REFERRAL BONUSES ===\n");

    // Get all ACTIVE investments that don't have a referral bonus yet
    const activeInvestments = await prisma.investment.findMany({
      where: {
        status: { in: ["ACTIVE", "COMPLETED", "MATURED", "PAYOUT_REQUESTED"] },
        referralBonus: null // No bonus record exists
      },
      include: {
        user: {
          select: {
            id: true,
            referredBy: true,
            firstName: true,
            lastName: true
          }
        },
        package: true
      }
    });

    console.log(`Found ${activeInvestments.length} investments without referral bonuses\n`);

    let credited = 0;
    let skipped = 0;

    for (const investment of activeInvestments) {
      if (!investment.user.referredBy) {
        console.log(`⏭️  SKIPPED: Investment ${investment.id} - User has no referrer`);
        skipped++;
        continue;
      }

      try {
        console.log(`\n💳 Processing: Investment ${investment.id}`);
        console.log(`   Amount: $${investment.amount}`);
        console.log(`   User: ${investment.user.firstName}`);
        console.log(`   Referrer Code: ${investment.user.referredBy}`);

        // Credit the bonus
        await ReferralService.creditReferralBonus(
          investment.id,
          investment.amount,
          investment.userId
        );

        console.log(`✅ CREDITED: Referral bonus created`);
        credited++;
      } catch (error) {
        console.error(`❌ ERROR crediting bonus for ${investment.id}:`, error instanceof Error ? error.message : error);
        skipped++;
      }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`✅ Successfully credited: ${credited}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`📊 Total processed: ${activeInvestments.length}`);

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

creditMissingReferralBonuses();
