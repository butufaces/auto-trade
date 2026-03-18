import prisma from "../src/db/client.js";

async function manuallyFixReferral() {
  try {
    console.log("🔧 MANUALLY FIXING REFERRAL BONUS\n");

    // Step 1: Find the referrer
    const referrer = await prisma.user.findFirst({
      where: {
        referralCode: { contains: "7227777071" }
      },
      select: { id: true, referralCode: true, email: true, firstName: true }
    });

    if (!referrer) {
      console.log("❌ Referrer not found");
      process.exit(1);
    }

    console.log(`✅ Found referrer: ${referrer.firstName} (${referrer.email})`);
    console.log(`   Code: ${referrer.referralCode}\n`);

    // Step 2: Find Akanji (the referred user)
    const akanji = await prisma.user.findFirst({
      where: { firstName: "Akanji" },
      include: {
        investments: {
          where: { status: "ACTIVE" },
          select: { id: true, amount: true }
        }
      }
    });

    if (!akanji) {
      console.log("❌ Akanji not found");
      process.exit(1);
    }

    console.log(`✅ Found referred user: ${akanji.firstName}`);
    console.log(`   Email: ${akanji.email}`);
    console.log(`   Current referredBy: ${akanji.referredBy || "NULL"}`);
    console.log(`   Active investments: ${akanji.investments.length}\n`);

    // Step 3: Set referredBy if not already set
    if (!akanji.referredBy) {
      console.log(`🔧 Setting referredBy to ${referrer.referralCode}...`);
      await prisma.user.update({
        where: { id: akanji.id },
        data: { referredBy: referrer.referralCode }
      });
      console.log("✅ referredBy field updated\n");
    }

    // Step 4: Check if bonus already exists
    const existingBonus = akanji.investments.length > 0 
      ? await prisma.referralBonus.findUnique({
          where: { investmentId: akanji.investments[0].id }
        })
      : null;

    if (existingBonus) {
      console.log(`⚠️  Bonus already exists for investment ${existingBonus.investmentId}`);
      console.log(`   Amount: $${existingBonus.bonusAmount}`);
      process.exit(0);
    }

    // Step 5: Manually credit the bonus for each ACTIVE investment
    console.log("💳 Crediting bonuses...\n");

    const bonusPercentage = 10; // 10% as shown in screenshot
    let totalBonusCreated = 0;

    for (const investment of akanji.investments) {
      const bonusAmount = (investment.amount * bonusPercentage) / 100;

      console.log(`Processing investment ${investment.id}:`);
      console.log(`  Amount: $${investment.amount}`);
      console.log(`  Bonus (${bonusPercentage}%): $${bonusAmount}`);

      // Create bonus record
      const bonus = await prisma.referralBonus.create({
        data: {
          referrerId: referrer.id,
          investmentId: investment.id,
          referredUserId: akanji.id,
          bonusAmount,
          bonusPercentage,
          investmentAmount: investment.amount,
          status: "CREDITED"
        }
      });

      console.log(`  ✅ Bonus record created: ${bonus.id}`);

      // Update referrer's earnings
      const updated = await prisma.user.update({
        where: { id: referrer.id },
        data: {
          referralEarnings: { increment: bonusAmount },
          totalEarned: { increment: bonusAmount }
        },
        select: { referralEarnings: true, totalEarned: true }
      });

      console.log(`  ✅ Referrer earnings updated`);
      console.log(`     New earnings: $${updated.referralEarnings}`);
      console.log(`     New total earned: $${updated.totalEarned}\n`);

      totalBonusCreated += bonusAmount;
    }

    console.log("=" .repeat(70));
    console.log("✅ REFERRAL BONUS FIX COMPLETED!");
    console.log(`   Total bonuses created: $${totalBonusCreated}`);
    console.log(`   For referrer: ${referrer.firstName}`);
    console.log("=" .repeat(70));

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

manuallyFixReferral();
