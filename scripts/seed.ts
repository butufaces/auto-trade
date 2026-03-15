import { seedHelpArticles } from "../src/scripts/seedHelpArticles.js";

async function main() {
  console.log("🌱 Running seed scripts...");
  
  try {
    // Seed help articles
    console.log("\n📚 Seeding help articles...");
    await seedHelpArticles();
    
    console.log("\n✅ All seeds completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

main();
