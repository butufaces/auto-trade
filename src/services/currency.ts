import prisma from "../db/client.js";
import logger from "../config/logger.js";

class CurrencyService {
  /**
   * Get all available cryptocurrencies
   */
  static async getAllCryptocurrencies(): Promise<string[]> {
    return [
      "BTC",    // Bitcoin
      "ETH",    // Ethereum
      "USDT",   // Tether
      "BNB",    // Binance Coin
      "XRP",    // Ripple
      "ADA",    // Cardano
      "SOL",    // Solana
      "USDC",   // USD Coin
      "DOGE",   // Dogecoin
      "LINK",   // Chainlink
      "MATIC",  // Polygon
      "DOT",    // Polkadot
      "AVAX",   // Avalanche
      "ARB",    // Arbitrum
      "OP",     // Optimism
      "LTC",    // Litecoin
      "BCH",    // Bitcoin Cash
      "XMR",    // Monero
      "XLM",    // Stellar
      "ATOM",   // Cosmos
      "UNI",    // Uniswap
      "DAI",    // DAI Stablecoin
    ];
  }

  /**
   * Get enabled cryptocurrencies for deposit
   */
  static async getEnabledDepositCryptos(): Promise<string[]> {
    try {
      const settings = await (prisma as any).currencySettings.findMany({
        where: {
          type: "DEPOSIT",
          isEnabled: true,
        },
      });
      return settings.map((s: any) => s.cryptocurrency);
    } catch (error) {
      logger.error("Error fetching deposit cryptocurrencies:", error);
      return ["USDT"]; // Default fallback
    }
  }

  /**
   * Get enabled cryptocurrencies for withdrawal
   */
  static async getEnabledWithdrawalCryptos(): Promise<string[]> {
    try {
      const settings = await (prisma as any).currencySettings.findMany({
        where: {
          type: "WITHDRAWAL",
          isEnabled: true,
        },
      });
      return settings.map((s: any) => s.cryptocurrency);
    } catch (error) {
      logger.error("Error fetching withdrawal cryptocurrencies:", error);
      return ["USDT"]; // Default fallback
    }
  }

  /**
   * Get all currency settings grouped by type
   */
  static async getAllCurrencySettings(): Promise<{
    deposit: any[];
    withdrawal: any[];
  }> {
    try {
      const depositSettings = await (prisma as any).currencySettings.findMany({
        where: { type: "DEPOSIT" },
        orderBy: { cryptocurrency: "asc" },
      });

      const withdrawalSettings = await (prisma as any).currencySettings.findMany({
        where: { type: "WITHDRAWAL" },
        orderBy: { cryptocurrency: "asc" },
      });

      return {
        deposit: depositSettings,
        withdrawal: withdrawalSettings,
      };
    } catch (error) {
      logger.error("Error fetching currency settings:", error);
      return { deposit: [], withdrawal: [] };
    }
  }

  /**
   * Toggle cryptocurrency enabled status
   */
  static async toggleCurrency(
    type: "DEPOSIT" | "WITHDRAWAL",
    cryptocurrency: string
  ): Promise<boolean> {
    try {
      const existing = await (prisma as any).currencySettings.findUnique({
        where: {
          type_cryptocurrency: {
            type,
            cryptocurrency,
          },
        },
      });

      if (!existing) {
        // Create new setting
        const blockchains = this.getDefaultBlockchains(cryptocurrency);
        await (prisma as any).currencySettings.create({
          data: {
            type,
            cryptocurrency,
            isEnabled: true,
            blockchains: JSON.stringify(blockchains),
          },
        });
        logger.info(`[CURRENCY] Enabled ${cryptocurrency} for ${type}`);
        return true;
      } else {
        // Toggle existing setting
        const newStatus = !existing.isEnabled;
        await (prisma as any).currencySettings.update({
          where: {
            type_cryptocurrency: {
              type,
              cryptocurrency,
            },
          },
          data: { isEnabled: newStatus },
        });
        logger.info(
          `[CURRENCY] ${newStatus ? "Enabled" : "Disabled"} ${cryptocurrency} for ${type}`
        );
        return newStatus;
      }
    } catch (error) {
      logger.error(`Error toggling currency ${cryptocurrency}:`, error);
      throw error;
    }
  }

  /**
   * Get default blockchains for a cryptocurrency
   */
  private static getDefaultBlockchains(cryptocurrency: string): string[] {
    const blockchainMap: { [key: string]: string[] } = {
      BTC: ["bitcoin"],
      ETH: ["ethereum"],
      USDT: ["ethereum", "polygon", "bsc", "tron"],
      BNB: ["bsc"],
      XRP: ["xrpl"],
      ADA: ["cardano"],
      SOL: ["solana"],
      USDC: ["ethereum", "polygon", "bsc", "solana"],
      DOGE: ["dogecoin"],
      LINK: ["ethereum"],
      MATIC: ["polygon"],
      DOT: ["polkadot"],
      AVAX: ["avalanche"],
      ARB: ["arbitrum"],
      OP: ["optimism"],
      LTC: ["litecoin"],
      BCH: ["bitcoincash"],
      XMR: ["monero"],
      XLM: ["stellar"],
      ATOM: ["cosmos"],
      UNI: ["ethereum"],
      DAI: ["ethereum", "polygon", "bsc"],
    };
    return blockchainMap[cryptocurrency] || ["ethereum"];
  }

  /**
   * Get blockchains for a cryptocurrency
   */
  static async getBlockchains(
    type: "DEPOSIT" | "WITHDRAWAL",
    cryptocurrency: string
  ): Promise<string[]> {
    try {
      const setting = await (prisma as any).currencySettings.findUnique({
        where: {
          type_cryptocurrency: {
            type,
            cryptocurrency,
          },
        },
      });

      if (!setting) {
        return this.getDefaultBlockchains(cryptocurrency);
      }

      return JSON.parse(setting.blockchains);
    } catch (error) {
      logger.error("Error fetching blockchains:", error);
      return this.getDefaultBlockchains(cryptocurrency);
    }
  }
}

export default CurrencyService;
