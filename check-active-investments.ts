import prisma from "./src/db/client.js";

async function checkInvestments() {
  try {
    console.log("=== CHECKING ACTIVE INVESTMENTS ===\n");

    // Get all ACTIVE investments
    const activeInvestments = await prisma.investment.findMany({
      where: {
        status: "ACTIVE"
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            referredBy: true,
            referralCode: true
          }
        },
        referralBonus: {
          select: {
            bonusAmount: true,
            status: true
          }
        }
      }
    });

    console.log(`Total ACTIVE investments: ${activeInvestments.length}\n`);

    for (const inv of activeInvestments) {
      console.log(`Investment ID: ${inv.id}`);
      console.log(`  Amount: $${inv.amount}`);
      console.log(`  Status: ${inv.status}`);
      console.log(`  Activated At: ${inv.activatedAt}`);
      console.log(`  User: ${inv.user.firstName} ${inv.user.lastName} (${inv.user.username})`);
      console.log(`  User ID: ${inv.user.id}`);
      console.log(`  User referredBy: ${inv.user.referredBy || "NULL"}`);
      console.log(`  User referralCode: ${inv.user.referralCode}`);
      console.log(`  ReferralBonus record exists: ${inv.referralBonus ? "YES" : "NO"}`);
      if (inv.referralBonus) {
        console.log(`    - Amount: $${inv.referralBonus.bonusAmount}`);
        console.log(`    - Status: ${inv.referralBonus.status}`);
      }
      console.log("");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkInvestments();
