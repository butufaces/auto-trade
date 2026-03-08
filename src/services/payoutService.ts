import axios, { AxiosInstance } from "axios";
import logger from "../config/logger.js";
import { config } from "../config/env.js";
import prisma from "../db/client.js";

export interface NowpaymentPayoutData {
  ipn_callback_url: string;
  wallet: string; // Recipient wallet address
  amount: number;
  currency: string; // e.g., "usdt"
  order_id: string;
  order_description: string;
}

export interface NowpaymentPayoutResponse {
  id?: string;
  status?: string;
  statusCode?: number;
  message?: string;
  wallet?: string;
  amount?: number;
  currency?: string;
  createdAt?: string;
  error?: string;
  error_description?: string;
}

export class CryptoPayoutService {
  private api: AxiosInstance;
  private apiKey: string;

  constructor() {
    this.apiKey = config.NOWPAYMENTS_API_KEY || "";

    this.api = axios.create({
      baseURL: "https://api.nowpayments.io/v1",
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Process payout to user's wallet
   */
  async processPayout(withdrawalId: string): Promise<NowpaymentPayoutResponse> {
    try {
      if (!this.apiKey) {
        throw new Error("NOWPayments API key not configured");
      }

      const withdrawal = await (prisma as any).withdrawalRequest.findUnique({
        where: { id: withdrawalId },
      });

      if (!withdrawal) {
        throw new Error("Withdrawal request not found");
      }

      if (withdrawal.status !== "PROCESSING") {
        throw new Error(`Cannot process withdrawal with status: ${withdrawal.status}`);
      }

      // Validate wallet address format based on blockchain
      this.validateWalletAddress(withdrawal.walletAddress, withdrawal.blockchain);

      const payoutData: NowpaymentPayoutData = {
        ipn_callback_url: `${process.env.BOT_WEBHOOK_URL || "http://localhost:3000"}/webhook/withdrawal`,
        wallet: withdrawal.walletAddress,
        amount: withdrawal.amount,
        currency: withdrawal.cryptocurrency?.toLowerCase() || "usdt",
        order_id: withdrawalId,
        order_description: `User withdrawal - Investment ${withdrawal.investmentId}`,
      };

      logger.info("[PAYOUT] Sending payout request to NOWPayments:", {
        withdrawalId,
        amount: withdrawal.amount,
        wallet: withdrawal.walletAddress.substring(0, 20) + "...",
      });

      const response = await this.api.post("/payout", payoutData);

      // Store NOWPayments payout ID
      await (prisma as any).withdrawalRequest.update({
        where: { id: withdrawalId },
        data: {
          nowpaymentsPaymentId: response.data.id,
          paymentStatus: response.data.status || "PENDING",
          paymentUrl: response.data.payout_url,
        },
      });

      logger.info("[PAYOUT] Payout request successful:", {
        withdrawalId,
        payoutId: response.data.id,
        status: response.data.status,
      });

      return response.data;
    } catch (error) {
      logger.error("[PAYOUT] Error processing payout:", error);

      // Update withdrawal status to failed
      try {
        await (prisma as any).withdrawalRequest.update({
          where: { id: withdrawalId },
          data: {
            paymentStatus: "FAILED",
            status: "REJECTED",
          },
        });
      } catch (updateError) {
        logger.error("[PAYOUT] Error updating withdrawal status:", updateError);
      }

      throw error;
    }
  }

  /**
   * Validate wallet address format based on blockchain
   */
  private validateWalletAddress(address: string, blockchain: string): void {
    // Basic validation - can be enhanced based on blockchain specs

    if (!address || address.length === 0) {
      throw new Error("Wallet address is required");
    }

    // Ethereum-based chains (ERC-20, Polygon, BSC)
    if (["ERC-20", "Polygon", "BEP-20"].includes(blockchain)) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error(`Invalid ${blockchain} wallet address format`);
      }
    }

    // TRON (TRC-20)
    if (blockchain === "TRC-20") {
      if (!/^T[a-zA-Z0-9]{33}$/.test(address)) {
        throw new Error("Invalid TRON wallet address format");
      }
    }

    logger.info("[PAYOUT] Wallet address validated:", {
      blockchain,
      addressPreview: address.substring(0, 10) + "...",
    });
  }

  /**
   * Check payout status from NOWPayments
   */
  async getPayoutStatus(payoutId: string): Promise<NowpaymentPayoutResponse> {
    try {
      const response = await this.api.get(`/payout/${payoutId}`);
      return response.data;
    } catch (error) {
      logger.error("[PAYOUT] Error getting payout status:", error);
      throw error;
    }
  }

  /**
   * Process payout webhook callback from NOWPayments
   */
  async handlePayoutWebhook(data: any): Promise<void> {
    try {
      const { order_id, status } = data;

      if (!order_id) {
        throw new Error("Order ID not found in webhook data");
      }

      logger.info("[PAYOUT WEBHOOK] Received payout status callback:", {
        orderId: order_id,
        status,
      });

      const withdrawal = await (prisma as any).withdrawalRequest.findUnique({
        where: { id: order_id },
        include: { user: true, investment: true },
      });

      if (!withdrawal) {
        logger.warn("[PAYOUT WEBHOOK] Withdrawal not found for order:", order_id);
        return;
      }

      // Map NOWPayments status to our status
      let newStatus = "PROCESSING";
      let investmentNewStatus = withdrawal.investment?.status;

      switch (status) {
        case "FINISHED":
        case "CONFIRMED":
          newStatus = "COMPLETED";

          // Update investment balance
          const updatedInvestment = await (prisma as any).investment.update({
            where: { id: withdrawal.investmentId },
            data: {
              availableWithdrawable: {
                decrement: withdrawal.amount,
              },
              totalWithdrawn: {
                increment: withdrawal.amount,
              },
            },
          });

          // Update user total withdrawn
          await (prisma as any).user.update({
            where: { id: withdrawal.userId },
            data: {
              totalWithdrawn: {
                increment: withdrawal.amount,
              },
            },
          });

          logger.info("[PAYOUT WEBHOOK] Payout completed:", {
            withdrawalId: order_id,
            amount: withdrawal.amount,
          });

          break;

        case "FAILED":
        case "EXPIRED":
          newStatus = "REJECTED";

          logger.warn("[PAYOUT WEBHOOK] Payout failed:", {
            withdrawalId: order_id,
            status,
          });

          break;

        case "SENDING":
        case "CONFIRMING":
          newStatus = "PROCESSING";
          break;

        default:
          logger.warn("[PAYOUT WEBHOOK] Unknown status:", status);
      }

      // Update withdrawal request
      await (prisma as any).withdrawalRequest.update({
        where: { id: order_id },
        data: {
          status: newStatus,
          paymentStatus: status,
          completedAt: newStatus === "COMPLETED" ? new Date() : undefined,
        },
      });

      // Notify user
      if (newStatus === "COMPLETED") {
        try {
          await axios.get(
            `https://api.telegram.org/bot${config.BOT_TOKEN}/sendMessage?chat_id=${withdrawal.user?.telegramId}&text=` +
            encodeURIComponent(
              `✅ <b>Withdrawal Successful!</b>\n\n` +
              `Amount: ${withdrawal.amount} USD has been sent to your wallet.\n` +
              `Blockchain: ${withdrawal.blockchain}\n` +
              `Status: Completed`
            ) +
            `&parse_mode=HTML`
          );
        } catch (error) {
          logger.error("[PAYOUT WEBHOOK] Error notifying user:", error);
        }
      }
    } catch (error) {
      logger.error("[PAYOUT WEBHOOK] Error processing webhook:", error);
    }
  }
}

const PayoutService = new CryptoPayoutService();

export default PayoutService;
