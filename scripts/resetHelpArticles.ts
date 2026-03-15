import prisma from "../src/db/client.js";

async function clearAndSeed() {
  try {
    console.log("🗑️  Clearing old help articles...");
    const deleted = await prisma.helpArticle.deleteMany({});
    console.log(`✅ Deleted ${deleted.count} old articles\n`);

    console.log("🌱 Seeding new help articles...");
    const { seedHelpArticles } = await import("./seedHelpArticles.js");
    await seedHelpArticles();
    
    console.log("✅ Seeding complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

clearAndSeed();
