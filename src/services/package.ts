import prisma from "../db/client.js";
import { parsePackages, ParsedPackage } from "../lib/helpers.js";
import logger from "../config/logger.js";
import { RiskLevel } from "@prisma/client";

export class PackageService {
  /**
   * Initialize packages from env
   */
  static async initializePackages(): Promise<void> {
    try {
      const envPackages = parsePackages();

      for (const pkg of envPackages) {
        const existing = await prisma.package.findUnique({
          where: { name: pkg.name },
        });

        if (!existing) {
          await prisma.package.create({
            data: {
              name: pkg.name,
              icon: pkg.icon,
              minAmount: pkg.minAmount,
              maxAmount: pkg.maxAmount,
              duration: pkg.duration,
              roiPercentage: pkg.roiPercentage,
              riskLevel: pkg.riskLevel,
              description: pkg.description,
              isActive: true,
            },
          });

          logger.info(`Package created: ${pkg.name}`);
        }
      }
    } catch (error) {
      logger.error("Failed to initialize packages:", error);
      throw error;
    }
  }

  /**
   * Get all active packages
   */
  static async getActivePackages() {
    return await prisma.package.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Get all packages (active and inactive) - for admin management
   */
  static async getAllPackages() {
    return await prisma.package.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Get package by ID
   */
  static async getPackageById(id: string) {
    return await prisma.package.findUnique({
      where: { id },
    });
  }

  /**
   * Get package by name
   */
  static async getPackageByName(name: string) {
    return await prisma.package.findUnique({
      where: { name },
    });
  }

  /**
   * Update package
   */
  static async updatePackage(
    id: string,
    data: {
      minAmount?: number;
      maxAmount?: number;
      roiPercentage?: number;
      isActive?: boolean;
      description?: string;
      riskLevel?: RiskLevel;
    }
  ) {
    return await prisma.package.update({
      where: { id },
      data,
    });
  }

  /**
   * Get package stats
   */
  static async getPackageStats(packageId: string) {
    const investments: any[] = await prisma.investment.findMany({
      where: { packageId },
    });

    const totalInvested: number = investments.reduce((sum: number, inv: any): number => sum + inv.amount, 0);
    const activeCount: number = investments.filter(
      (inv: any): boolean => inv.status === "ACTIVE"
    ).length;
    const completedCount: number = investments.filter(
      (inv: any): boolean => inv.status === "COMPLETED"
    ).length;

    return {
      totalInvestments: investments.length,
      activeInvestments: activeCount,
      completedInvestments: completedCount,
      totalAmount: totalInvested,
      averageAmount:
        investments.length > 0 ? totalInvested / investments.length : 0,
    };
  }

  /**
   * Get all packages with stats
   */
  static async getPackagesWithStats() {
    const packages = await this.getActivePackages();

    const packagesWithStats = await Promise.all(
      packages.map(async (pkg: any): Promise<any> => ({
        ...pkg,
        stats: await this.getPackageStats(pkg.id),
      }))
    );

    return packagesWithStats;
  }
}

export default PackageService;
