import { PrismaClient } from "@prisma/client";
import logger from "../config/logger.js";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // Optimize connection pooling
    // Default pool size is 10 in production
  });

// Log database operations only in development (and only very slow queries)
if (process.env.NODE_ENV !== "production") {
  try {
    (prisma as any).$on("query", (e: any) => {
      // Only log queries slower than 100ms to reduce overhead
      if (e.duration > 100) {
        logger.debug(`SLOW Query (${e.duration}ms): ${e.query.substring(0, 80)}...`);
      }
    });
  } catch (error) {
    // Event logging not available
  }
}

if (process.env.NODE_ENV !== "production")
  globalForPrisma.prisma = prisma;

export default prisma;
