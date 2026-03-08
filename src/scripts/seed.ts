import prisma from "../db/client.js";
import logger from "../config/logger.js";

async function main() {
  try {
    logger.info("🌱 Seeding database...");

    // Create sample packages
    const packages = [
      {
        name: "Starter",
        icon: "💰",
        minAmount: 100,
        maxAmount: 500,
        duration: 30,
        roiPercentage: 10,
        riskLevel: "LOW" as const,
        description: "Perfect for beginners",
      },
      {
        name: "Growth",
        icon: "📈",
        minAmount: 500,
        maxAmount: 2000,
        duration: 60,
        roiPercentage: 18,
        riskLevel: "LOW_MEDIUM" as const,
        description: "Steady growth package",
      },
      {
        name: "Premium",
        icon: "👑",
        minAmount: 2000,
        maxAmount: 10000,
        duration: 90,
        roiPercentage: 25,
        riskLevel: "MEDIUM" as const,
        description: "High returns package",
      },
      {
        name: "Elite",
        icon: "🌟",
        minAmount: 10000,
        maxAmount: 50000,
        duration: 180,
        roiPercentage: 35,
        riskLevel: "MEDIUM_HIGH" as const,
        description: "Professional level investments",
      },
    ];

    for (const pkg of packages) {
      const existing = await prisma.package.findUnique({
        where: { name: pkg.name },
      });

      if (!existing) {
        await prisma.package.create({
          data: { ...pkg, isActive: true },
        });
        logger.info(`✅ Package created: ${pkg.name}`);
      }
    }

    logger.info("✅ Database seeded successfully!");
  } catch (error) {
    logger.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
