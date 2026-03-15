import prisma from "../src/db/client.js";
import logger from "../src/config/logger.js";

async function verifyArticles() {
  try {
    const count = await prisma.helpArticle.count();
    const articles = await prisma.helpArticle.findMany({
      select: { id: true, title: true, icon: true, isActive: true, order: true },
      orderBy: { order: "asc" },
    });

    console.log("\n✅ HELP ARTICLES VERIFICATION\n");
    console.log(`📚 Total Articles: ${count}\n`);

    if (articles.length === 0) {
      console.log("❌ No articles found!\n");
      process.exit(1);
    }

    console.log("Articles List:");
    console.log("────────────────────────────────────────────────────────");
    articles.forEach((a, i) => {
      console.log(`${i + 1}. ${a.icon} ${a.title}`);
      console.log(`   Status: ${a.isActive ? "✅ Active" : "❌ Inactive"} | Order: ${a.order}`);
    });
    console.log("────────────────────────────────────────────────────────\n");

    if (count === 8) {
      console.log("🎉 SUCCESS! All 8 help articles have been seeded!\n");
      process.exit(0);
    } else {
      console.log(`⚠️  Expected 8 articles but found ${count}\n`);
      process.exit(0);
    }
  } catch (error) {
    logger.error("Error verifying articles:", error);
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

verifyArticles();
