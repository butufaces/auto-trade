import prisma from "./src/db/client.js";

async function debugReferral() {
  try {
    console.log("=== REFERRAL DEBUG ===\n");

    // Find user with the referral code from the screenshot
    const referrer = await prisma.user.findFirst({
      where: {
        referralCode: {
          contains: "REF_7227777071"
        }
      },
      select: {
        id: true,
        telegramId: true,
        firstName: true,
        lastName: true,
        username: true,
        referralCode: true,
        referralCount: true,
        referralEarnings: true,
        totalEarned: true,
      }
    });

    console.log("Referrer with code REF_7227777071:");
    console.log(referrer);
    console.log("\n");

    if (referrer) {
      // Check all users referred by this code
      const referredUsers = await prisma.user.findMany({
        where: {
          referredBy: referrer.referralCode
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          referredBy: true,
          createdAt: true,
        }
      });

      console.log(`Users referred by ${referrer.referralCode}:`);
      console.log(referredUsers);
      console.log("\n");

      // Check referral bonuses for this user
      const bonuses = await prisma.referralBonus.findMany({
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
          createdAt: true,
        }
      });

      console.log(`ReferralBonus records for user ${referrer.id}:`);
      console.log(bonuses);
      console.log(`Total bonuses: ${bonuses.length}`);
      console.log("\n");

      // Check investments for this user's referred users
      if (referredUsers.length > 0) {
        for (const referredUser of referredUsers) {
          const investments = await prisma.investment.findMany({
            where: {
              userId: referredUser.id
            },
            select: {
              id: true,
              amount: true,
              status: true,
              createdAt: true,
              activatedAt: true,
              referralBonus: {
                select: {
                  bonusAmount: true,
                  status: true
                }
              }
            }
          });

          console.log(`Investments by ${referredUser.firstName} (${referredUser.id}):`);
          console.log(investments);
          console.log("\n");
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

debugReferral();
