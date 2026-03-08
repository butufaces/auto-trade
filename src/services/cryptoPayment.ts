import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import QRCode from "qrcode";
import logger from "../config/logger.js";
import { config } from "../config/env.js";
import prisma from "../db/client.js";

export interface NowpaymentsPaymentData {
  pay_currency: string;
  ipn_callback_url: string;
  order_id: string;
  order_description: string;
  price_amount: number;
  price_currency: "usd";
  success_url?: string;
  cancel_url?: string;
}

export interface NowpaymentsPaymentResponse {
  id?: number;
  payment_id?: number;
  token_id?: string;
  order_id: string;
  order_description: string;
  price_amount: number;
  price_currency: string;
  pay_amount?: number;
  pay_currency?: string;
  pay_address?: string;
  payment_status?: string;
  ipn_callback_url: string;
  invoice_url?: string;
  checkout_url?: string;
  success_url?: string;
  cancel_url?: string;
  customer_email?: string;
  partially_paid_url?: string;
  payout_currency?: string;
  created_at?: string;
  updated_at?: string;
  is_fixed_rate?: boolean;
  is_fee_paid_by_user?: boolean;
  source?: string;
  collect_user_data?: string;
  purchase_id?: string;
  outcome?: null;
  outcome_url?: null;
}

export class NowpaymentsService {
  private api: AxiosInstance;
  private apiKey: string;
  private ipnSecret: string;

  constructor() {
    this.apiKey = config.NOWPAYMENTS_API_KEY || "";
    this.ipnSecret = config.NOWPAYMENTS_IPN_SECRET || "";

    this.api = axios.create({
      baseURL: "https://api.nowpayments.io/v1",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      timeout: 30000,
    });

    // Add request interceptor for logging
    this.api.interceptors.request.use(
      (config) => {
        logger.debug(`[NOWPAYMENTS] Request Starting:`, {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          data: config.data,
        });
        return config;
      },
      (error) => {
        logger.error(`[NOWPAYMENTS] Request Error:`, error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.api.interceptors.response.use(
      (response) => {
        logger.debug(`[NOWPAYMENTS] Response Success:`, {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url,
          dataKeys: Object.keys(response.data || {}),
        });
        return response;
      },
      (error) => {
        if (error.response) {
          const errorData = {
            status: error.response.status,
            statusText: error.response.statusText,
            url: error.config?.url,
            contentType: error.response.headers?.["content-type"],
            dataString: JSON.stringify(error.response.data),
          };
          logger.error(
            `[NOWPAYMENTS] Response Error: ${error.response.status} ${error.response.statusText}`,
            errorData
          );
        } else if (error.request) {
          logger.error(`[NOWPAYMENTS] No response from server:`, {
            message: error.message,
            code: error.code,
          });
        } else {
          logger.error(`[NOWPAYMENTS] Request setup error:`, {
            message: error.message,
          });
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Create a crypto payment and immediately fetch wallet address
   * This is a FRESH START - simplified flow
   */
  async createPayment(
    investmentId: string,
    userId: string,
    amountUsd: number,
    cryptocurrency: string,
    webhookUrl: string,
    blockchain?: string
  ): Promise<NowpaymentsPaymentResponse> {
    try {
      if (!this.apiKey) {
        throw new Error("Nowpayments API key not configured");
      }

      // Validate inputs
      if (!investmentId || !amountUsd || !cryptocurrency || !webhookUrl) {
        throw new Error("Missing required payment parameters");
      }

      if (amountUsd <= 0) {
        throw new Error(`Invalid amount: ${amountUsd}`);
      }

      // Validate minimum amount
      const minimumValidation = await this.validateMinimumAmount(amountUsd, cryptocurrency);
      if (!minimumValidation.valid) {
        throw new Error(minimumValidation.message);
      }

      const normalizedCrypto = cryptocurrency.toLowerCase();
      
      // Build the pay_currency string with blockchain if needed
      const blockchainSpecificCryptos = ["usdt", "usdc", "dai", "matic", "bnb"];
      let payCurrency = normalizedCrypto;
      
      if (blockchain && blockchainSpecificCryptos.includes(normalizedCrypto)) {
        const blockchainCodeMap: { [key: string]: string } = {
          ethereum: "erc20",
          polygon: "matic",
          bsc: "bsc",
          tron: "trc20",
          solana: "sol",
          arbitrum: "arb",
          optimism: "opt",
          avalanche: "avax",
        };
        
        if (!(normalizedCrypto === "matic" && blockchain.toLowerCase() === "polygon")) {
          const blockchainCode = blockchainCodeMap[blockchain.toLowerCase()] || blockchain.toLowerCase();
          // NowPayments expects an alphanumeric pay_currency, e.g. "usdttrc20"
          payCurrency = `${normalizedCrypto}${blockchainCode}`;
        }
      }

      logger.info(`[NOWPAYMENTS] Creating payment:`, {
        investmentId,
        amountUsd,
        cryptocurrency,
        payCurrency,
        blockchain,
      });

      // Step 1: Create invoice on NOWPayments. If the requested pay_currency
      // is unavailable, try alternative allowed pay_currency values returned
      // by the API or a set of common chain suffixes.
      let invoiceResponse;
      try {
        invoiceResponse = await this.api.post<NowpaymentsPaymentResponse>("/invoice", {
          price_amount: amountUsd,
          price_currency: "usd",
          pay_currency: payCurrency,
          order_id: investmentId,
          order_description: `Investment ${investmentId}`,
          ipn_callback_url: webhookUrl,
        });
      } catch (invErr: any) {
        // Build a safe error object for logging
        const safeInvErr: any = {
          message: invErr.message,
          code: invErr.code,
          responseStatus: invErr.response?.status,
          responseData: invErr.response?.data,
        };
        logger.warn(`[NOWPAYMENTS] Invoice creation failed for pay_currency=${payCurrency}`, safeInvErr);

        // If the error indicates the currency is unavailable, try alternatives
        const errMsg = String(invErr.response?.data?.message || invErr.message || "").toLowerCase();
        const shouldTryAlternatives = errMsg.includes("unavailable") || errMsg.includes("currency") || invErr.response?.status === 400;

        if (shouldTryAlternatives) {
          // Get available currencies from NOWPayments and prefer those starting with the base crypto
          let available: string[] = [];
          try {
            available = await this.getAvailableCurrencies();
          } catch (availErr) {
            logger.warn(`[NOWPAYMENTS] Could not fetch available currencies: ${availErr instanceof Error ? availErr.message : String(availErr)}`);
          }

          const normalizedCandidates = available
            .map((c) => c.toLowerCase())
            .filter((c) => c.startsWith(normalizedCrypto));

          // If a blockchain was requested, prefer candidates that mention it
          const blockchainCode = blockchain ? ( ( { ethereum: 'erc20', polygon: 'matic', bsc: 'bsc', tron: 'trc20', solana: 'sol', arbitrum: 'arb', optimism: 'opt', avalanche: 'avax' } as any )[blockchain.toLowerCase()] || blockchain.toLowerCase() ) : null;

          let tried = [] as string[];
          const fallbackSuffixes = ['trc20', 'erc20', 'bep20', 'matic', 'bsc', 'sol', 'arb', 'opt', 'avax'];

          const candidateList: string[] = [];

          if (blockchainCode) {
            candidateList.push(`${normalizedCrypto}${blockchainCode}`);
          }

          // add API-provided candidates first
          candidateList.push(...normalizedCandidates);

          // add common suffix fallbacks
          for (const s of fallbackSuffixes) {
            candidateList.push(`${normalizedCrypto}${s}`);
          }

          // Dedup while preserving order
          const uniqCandidates = Array.from(new Set(candidateList));

          for (const candidate of uniqCandidates) {
            if (candidate === payCurrency) continue;
            tried.push(candidate);
            try {
              logger.info(`[NOWPAYMENTS] Retrying invoice creation with pay_currency=${candidate}`);
              invoiceResponse = await this.api.post<NowpaymentsPaymentResponse>("/invoice", {
                price_amount: amountUsd,
                price_currency: "usd",
                pay_currency: candidate,
                order_id: investmentId,
                order_description: `Investment ${investmentId}`,
                ipn_callback_url: webhookUrl,
              });
              // success
              payCurrency = candidate; // update to the successful candidate
              logger.info(`[NOWPAYMENTS] Invoice created with alternative pay_currency=${candidate}`);
              break;
              } catch (retryErr: any) {
                logger.warn(`[NOWPAYMENTS] Retry failed for pay_currency=${candidate}`, {
                  message: retryErr?.message,
                  status: retryErr?.response?.status,
                  data: retryErr?.response?.data,
                });
              // continue to next candidate
            }
          }

          if (!invoiceResponse) {
            logger.error(`[NOWPAYMENTS] All pay_currency alternatives failed`, { attempted: tried });
            throw invErr;
          }
        } else {
          // Not an availability issue - rethrow
          throw invErr;
        }
      }

      const invoiceId = invoiceResponse.data.payment_id;
      const rawPaymentId = invoiceResponse.data.id;
      const tokenId = invoiceResponse.data.token_id;
      const invoiceUrl = invoiceResponse.data.invoice_url;
      
      // Log all fields from the response for debugging
      logger.info(`[NOWPAYMENTS] Full invoice response fields:`, {
        investmentId,
        responseFields: Object.entries(invoiceResponse.data).reduce((acc, [key, value]) => {
          acc[key] = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : typeof value;
          return acc;
        }, {} as Record<string, any>),
      });
      
      // Validate required fields
      if (!invoiceId && !rawPaymentId) {
        logger.error(`[NOWPAYMENTS] Invoice created but missing both payment_id and id fields:`, {
          investmentId,
          responseKeys: Object.keys(invoiceResponse.data),
          fullResponse: JSON.stringify(invoiceResponse.data),
        });
        throw new Error("NowPayments response missing payment identifiers (payment_id and id) - cannot track payment");
      }
      
      if (!invoiceUrl) {
        logger.error(`[NOWPAYMENTS] Invoice created but missing invoice_url field:`, {
          investmentId,
          responseKeys: Object.keys(invoiceResponse.data),
        });
        throw new Error("NowPayments response missing invoice_url - cannot provide payment link to user");
      }
      
      // Use payment_id as primary identifier (assigned to invoices)
      const paymentTrackingId = invoiceId || rawPaymentId;
      
      logger.info(`[NOWPAYMENTS] Payment identifiers extracted:`, {
        investmentId,
        paymentId: invoiceId,
        id: rawPaymentId,
        usingTrackingId: paymentTrackingId,
        hasInvoiceUrl: !!invoiceUrl,
      });
      
      // Use the invoice_url provided by NowPayments - this is the complete, correct payment link
      const completePaymentUrl = invoiceUrl;
      
      logger.info(`[NOWPAYMENTS] Invoice created successfully:`, {
        investmentId,
        paymentTrackingId,
        rawId: rawPaymentId,
        tokenId,
        completePaymentUrl,
      });

      // Return invoice response immediately (no polling - we only need the invoice_url, not wallet address)
      const paymentDetails = invoiceResponse.data;
      
      logger.info(`[NOWPAYMENTS] Payment response contains these fields:`, {
        investmentId,
        fields: Object.keys(paymentDetails),
        pay_address: paymentDetails.pay_address,
        pay_currency: paymentDetails.pay_currency,
        pay_amount: paymentDetails.pay_amount,
        payment_status: paymentDetails.payment_status,
        invoice_url: paymentDetails.invoice_url,
      });
      
      // Override with our constructed complete payment URL
      paymentDetails.invoice_url = completePaymentUrl;
      paymentDetails.checkout_url = completePaymentUrl;

      logger.info(`[NOWPAYMENTS] Payment created successfully:`, {
        investmentId,
        invoiceId,
        hasWalletAddress: !!paymentDetails.pay_address,
        payAmount: paymentDetails.pay_amount,
      });

      return paymentDetails;
    } catch (error: any) {
      // Avoid logging raw error objects (they may contain circular refs like ClientRequest.socket)
      const safeErr: any = {
        message: error?.message || String(error),
        code: error?.code,
        responseStatus: error?.response?.status,
        responseData: error?.response?.data,
      };
      logger.error(`[NOWPAYMENTS] Failed to create payment:`, safeErr);
      throw error;
    }
  }

  /**
   * Get available cryptocurrencies from NowPayments
   */
  async getAvailableCurrencies(): Promise<string[]> {
    try {
      if (!this.apiKey) {
        throw new Error("Nowpayments API key not configured");
      }

      const response = await this.api.get(`/currencies`);
      
      logger.info(`[NOWPAYMENTS] Retrieved available currencies`, {
        count: response.data.currencies?.length || 0,
        currencies: (response.data.currencies || []).slice(0, 20), // Log first 20
      });

      // Filter to only supported currencies based on config
      const supportedCryptos = this.getSupportedCryptos();
      const availableCryptos = (response.data.currencies || []).filter(
        (crypto: string) => supportedCryptos.includes(crypto.toUpperCase())
      );

      logger.debug(`[NOWPAYMENTS] Filtered available currencies`, {
        total: response.data.currencies?.length || 0,
        supported: supportedCryptos.length,
        available: availableCryptos.length,
        availableCryptos,
      });

      return availableCryptos;
    } catch (error) {
      logger.error(`[NOWPAYMENTS] Failed to get available currencies:`, error);
      // Return configured supported cryptos as fallback
      return this.getSupportedCryptos();
    }
  }

  /**
   * Get minimum amount for a cryptocurrency in USD
   */
  private getMinimumAmountUsd(cryptocurrency: string): number {
    // Universal minimum: $1 USD for all cryptocurrencies
    return 1;
  }

  /**
   * Validate if amount meets minimum requirements
   */
  async validateMinimumAmount(
    amountUsd: number,
    cryptocurrency: string
  ): Promise<{ valid: boolean; minimumUsd: number; message?: string }> {
    const minimumUsd = this.getMinimumAmountUsd(cryptocurrency);
    const valid = amountUsd >= minimumUsd;

    return {
      valid,
      minimumUsd,
      message: valid 
        ? undefined 
        : `Minimum investment amount for ${cryptocurrency.toUpperCase()} is $${minimumUsd}. Your amount: $${amountUsd}`,
    };
  }

  /**
   * Get cryptocurrency conversion estimate with retries
   */
  async getConversionEstimate(
    amountUsd: number,
    cryptocurrency: string
  ): Promise<{ cryptoAmount: number; rate: number }> {
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.apiKey) {
          throw new Error("Nowpayments API key not configured");
        }

        // Extract base currency (remove blockchain suffix if present)
        // Handle formats like "usdt_trc20" and "usdttrc20"
        const baseMatch = cryptocurrency.toLowerCase().match(/^[a-z]+/);
        const baseCrypto = baseMatch ? baseMatch[0] : cryptocurrency.toLowerCase();

        logger.info(`[NOWPAYMENTS] Requesting conversion estimate (attempt ${attempt}/${maxRetries}):`, {
          amount: amountUsd,
          currency: baseCrypto,
        });

        // Note: /estimate endpoint doesn't support blockchain-specific codes
        // Using just the base currency
        const response = await this.api.get(`/estimate`, {
          params: {
            amount: amountUsd,
            currency_from: "usd",
            currency_to: baseCrypto,
          },
        });

        logger.debug(`[NOWPAYMENTS] Conversion estimate response:`, {
          status: response.status,
          responseKeys: Object.keys(response.data),
          responseData: response.data,
        });

        let cryptoAmount = Number(response.data.estimated_amount);
        
        // Handle different response formats
        if (!cryptoAmount || isNaN(cryptoAmount) || cryptoAmount <= 0) {
          // Try alternate field names
          cryptoAmount = Number(response.data.amount) || 
                        Number(response.data.pay_amount) || 
                        Number(response.data.converted_amount) || 0;
        }
        
        if (!cryptoAmount || cryptoAmount <= 0) {
          throw new Error(
            `Invalid conversion estimate: ${JSON.stringify(response.data)}`
          );
        }

        const rate = amountUsd / cryptoAmount; // USD per 1 crypto unit

        logger.info(`[NOWPAYMENTS] Conversion estimate calculated successfully:`, {
          attempt,
          amountUsd,
          cryptocurrency,
          cryptoAmount,
          rate,
          estimatedUsdValue: (cryptoAmount * rate).toFixed(2),
        });

        return {
          cryptoAmount,
          rate,
        };
      } catch (error: any) {
        lastError = error;
        const isLastAttempt = attempt === maxRetries;

        logger.warn(
          `[NOWPAYMENTS] Conversion estimate attempt ${attempt}/${maxRetries} failed:`,
          {
            errorMessage: error.message,
            errorCode: error.code,
            errorStatus: error.response?.status,
            errorData: error.response?.data,
            amountUsd,
            cryptocurrency,
            isLastAttempt,
          }
        );

        // If not the last attempt, wait before retrying
        if (!isLastAttempt) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // All retries exhausted, log and throw
    logger.error(
      `[NOWPAYMENTS] All conversion estimate retries failed for ${cryptocurrency}:`,
      {
        errorMessage: lastError.message,
        errorCode: lastError.code,
        errorStatus: lastError.response?.status,
        errorData: lastError.response?.data,
        amountUsd,
        cryptocurrency,
        retriesAttempted: maxRetries,
      }
    );
    
    throw lastError;
  }

  /**
   * Get payment status
   * Note: NowPayments API uses token_id for /payment/{id} queries, not the id field
   */
  async getPaymentStatus(paymentId: string | number, tokenId?: string | number): Promise<any | null> {
    try {
      if (!this.apiKey) {
        throw new Error("Nowpayments API key not configured");
      }

      const id = String(paymentId);
      const token = tokenId ? String(tokenId) : undefined;

      // Try with token_id first (correct endpoint for payment queries)
      if (token) {
        try {
          logger.debug(`[NOWPAYMENTS] Attempting to fetch payment with token_id: ${token}`);
          const response = await this.api.get(`/payment/${token}`);
          
          logger.info(`[NOWPAYMENTS] Retrieved payment status using token_id: ${token}`, {
            status: response.data.payment_status,
            hasPayAddress: !!response.data.pay_address,
          });

          return response.data;
        } catch (tokenErr: any) {
          if (tokenErr.response?.status === 404) {
            logger.debug(`[NOWPAYMENTS] Payment not found with token_id: ${token}, will try payment_id`);
          } else {
            throw tokenErr;
          }
        }
      }

      // Fallback: try with payment_id/id
      logger.debug(`[NOWPAYMENTS] Attempting to fetch payment with payment_id: ${id}`);
      const response = await this.api.get(`/payment/${id}`);

      logger.info(`[NOWPAYMENTS] Retrieved payment status: ${id}`, {
        status: response.data.payment_status,
        hasPayAddress: !!response.data.pay_address,
      });

      return response.data;
    } catch (error: any) {
      // If payment not found, return null so callers can handle it gracefully
      if (error.response && error.response.status === 404) {
        logger.warn(`[NOWPAYMENTS] Payment not found: ${paymentId}`);
        return null;
      }

      logger.error(`[NOWPAYMENTS] Failed to get payment status:`, {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
      });
      throw error;
    }
  }

  /**
   * Verify IPN signature
   */
  verifyIpnSignature(ipnData: string, signature: string): boolean {
    try {
      if (!this.ipnSecret) {
        logger.warn("[NOWPAYMENTS] IPN secret not configured. Skipping verification.");
        return false;
      }

      const hmac = crypto.createHmac("sha512", this.ipnSecret);
      hmac.update(ipnData);
      const calculatedSignature = hmac.digest("hex");

      const isValid = calculatedSignature === signature;

      if (!isValid) {
        logger.warn(`[NOWPAYMENTS] IPN signature verification failed`);
      }

      return isValid;
    } catch (error) {
      logger.error(`[NOWPAYMENTS] Error verifying IPN signature:`, error);
      return false;
    }
  }

  /**
   * Generate QR code as data URL
   */
  async generateQRCode(data: string): Promise<string> {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(data, {
        errorCorrectionLevel: "H",
        type: "image/png",
        margin: 1,
        width: 300,
      });
      return qrCodeDataUrl;
    } catch (error) {
      logger.error(`[NOWPAYMENTS] Error generating QR code:`, error);
      throw error;
    }
  }

  /**
   * Save crypto payment to database
   */
  async saveCryptoPayment(
    investmentId: string,
    userId: string,
    amountUsd: number,
    cryptocurrency: string,
    paymentData: NowpaymentsPaymentResponse,
    conversionEstimate?: { cryptoAmount: number; rate: number } | null,
    blockchain?: string
  ) {
    try {
      // Log full response for debugging
      logger.info(`[NOWPAYMENTS] Saving payment with conversion data:`, {
        hasConversionEstimate: !!conversionEstimate,
        conversionAmount: conversionEstimate?.cryptoAmount,
        paymentDataKeys: Object.keys(paymentData),
        payAmount: paymentData.pay_amount,
        priceAmount: paymentData.price_amount,
        blockchain,
      });

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + config.PAYMENT_TIMEOUT_MINUTES);

      // Determine crypto amount - prioritize conversion estimate over API response
      let amountCrypto: number = 0;
      let calculationMethod: string = "unknown";
      
      if (conversionEstimate?.cryptoAmount && conversionEstimate.cryptoAmount > 0) {
        // PRIMARY: Use the conversion estimate
        amountCrypto = Number(conversionEstimate.cryptoAmount);
        calculationMethod = "conversion_estimate";
        logger.info(`[NOWPAYMENTS] Using conversion estimate for amountCrypto:`, {
          amountUsd,
          amountCrypto,
          cryptocurrency,
        });
      } else if (paymentData.pay_amount && Number(paymentData.pay_amount) > 0) {
        // SECONDARY: Try API's pay_amount field
        amountCrypto = Number(paymentData.pay_amount);
        calculationMethod = "api_pay_amount";
        logger.info(`[NOWPAYMENTS] Using API pay_amount for amountCrypto:`, {
          amountUsd,
          amountCrypto,
          cryptocurrency,
        });
      } else if (paymentData.price_amount && Number(paymentData.price_amount) > 0) {
        // TERTIARY: Use price_amount (may need manual conversion)
        amountCrypto = Number(paymentData.price_amount);
        calculationMethod = "api_price_amount";
        logger.warn(`[NOWPAYMENTS] Using API price_amount (may not be converted):`, {
          amountUsd,
          amountCrypto,
          cryptocurrency,
        });
      } else {
        // FALLBACK: Use the USD amount directly (user may need to check conversion)
        amountCrypto = amountUsd;
        calculationMethod = "fallback_usd_amount";
        logger.warn(`[NOWPAYMENTS] Fallback to USD amount, conversion may be needed:`, {
          amountUsd,
          amountCrypto,
          cryptocurrency,
        });
      }
      
      if (!amountCrypto || isNaN(amountCrypto) || amountCrypto <= 0) {
        throw new Error(
          `Invalid payment data: amountCrypto is invalid (${amountCrypto}). Method: ${calculationMethod}. Response: ${JSON.stringify(paymentData)}`
        );
      }

      // Map API response fields (handle both old and new API responses)
      const paymentId = paymentData.payment_id ?? paymentData.id;
      const invoiceUrl = paymentData.invoice_url;
      const checkoutUrl = paymentData.checkout_url;
      const payAddress = paymentData.pay_address || null; // Don't use fallback - we need the actual address
      const paymentStatus = paymentData.payment_status ?? "pending";

      logger.info(`[NOWPAYMENTS] API Response - Payment Links:`, {
        paymentId,
        hasInvoiceUrl: !!invoiceUrl,
        hasCheckoutUrl: !!checkoutUrl,
        payAddress,
        allApiFields: Object.keys(paymentData),
      });

      if (!paymentId) {
        throw new Error(
          `Invalid payment response: payment_id is missing. Available fields: ${Object.keys(paymentData).join(", ")}`
        );
      }

      // Use the payment URL provided by NowPayments API - prefer invoice_url, then checkout_url
      const fullPaymentUrl = invoiceUrl || checkoutUrl;

      if (!fullPaymentUrl) {
        throw new Error(
          `Invalid payment response: neither invoice_url nor checkout_url provided. Available fields: ${Object.keys(paymentData).join(", ")}`
        );
      }

      logger.info(`[NOWPAYMENTS] Saving crypto payment to database`, {
        investmentId,
        amountCrypto,
        amountUsd,
        cryptocurrency,
        paymentId,
        fullPaymentUrl,
        blockchain,
        calculationMethod,
      });

      // Double-check if payment already exists (race condition protection)
      const existingPayment = await prisma.cryptoPayment.findUnique({
        where: { investmentId },
      });

      if (existingPayment) {
        logger.warn(`[NOWPAYMENTS] RACE CONDITION: Payment already exists for investment ${investmentId}`, {
          existingPaymentId: existingPayment.id,
          existingNowpaymentsId: existingPayment.nowpaymentsPaymentId,
          newPaymentId: paymentId,
        });
        return existingPayment;
      }

      const cryptoPayment = await prisma.cryptoPayment.create({
        data: {
          investmentId,
          userId,
          amountUsd,
          cryptocurrency: cryptocurrency.toUpperCase(),
          amountCrypto: Number(amountCrypto).toString(),
          blockchain: blockchain ? blockchain.toLowerCase() : null,
          nowpaymentsPaymentId: String(paymentId),
          status: "PENDING",
          paymentAddress: payAddress,
          paymentUrl: fullPaymentUrl,
          paystatus: paymentStatus,
          expiresAt,
        },
      });

      logger.info(
        `[NOWPAYMENTS] Crypto payment saved successfully to database: ${cryptoPayment.id}`,
        { 
          investmentId, 
          paymentId,
          storedAmount: cryptoPayment.amountCrypto,
          calculationMethod,
        }
      );

      // Try to fetch payment details to get the wallet address
      try {
        const tokenIdForFetch = paymentData.token_id ? String(paymentData.token_id) : undefined;
        logger.info(`[NOWPAYMENTS] Fetching payment details for payment ID: ${paymentId}${tokenIdForFetch ? ` (token_id: ${tokenIdForFetch})` : ''}`);
        const paymentDetails = await this.getPaymentStatus(paymentId, tokenIdForFetch);
        
        logger.info(`[NOWPAYMENTS] Payment details retrieved:`, {
          paymentId,
          tokenId: tokenIdForFetch,
          hasPayAddress: !!paymentDetails?.pay_address,
          payAddress: paymentDetails?.pay_address,
        });
        
        // Update the database with the wallet address if we got it
        if (paymentDetails?.pay_address) {
          const updatedPayment = await prisma.cryptoPayment.update({
            where: { id: cryptoPayment.id },
            data: { paymentAddress: paymentDetails.pay_address },
          });
          
          logger.info(`[NOWPAYMENTS] Updated payment with wallet address:`, {
            investmentId,
            paymentId,
            tokenId: tokenIdForFetch,
            paymentAddress: paymentDetails.pay_address,
          });
          
          return updatedPayment;
        }
      } catch (detailsError) {
        logger.warn(`[NOWPAYMENTS] Failed to fetch payment details for wallet address:`, {
          paymentId,
          error: detailsError instanceof Error ? detailsError.message : String(detailsError),
        });
        // Continue anyway - we have the payment saved
      }

      return cryptoPayment;
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === "P2002" && error.meta?.target?.includes("investmentId")) {
        logger.warn(`[NOWPAYMENTS] Unique constraint violation: Payment already exists for investment ${investmentId}`, {
          error: error.message,
        });
        
        // Return the existing payment
        const existingPayment = await prisma.cryptoPayment.findUnique({
          where: { investmentId },
        });
        
        if (existingPayment) {
          return existingPayment;
        }
      }
      
      logger.error(`[NOWPAYMENTS] Failed to save crypto payment:`, error);
      throw error;
    }
  }

  /**
   * Update payment status after webhook
   */
  async updatePaymentStatus(
    nowpaymentsPaymentId: string,
    status: string,
    paymentStatus?: string,
    investmentId?: string
  ) {
    try {
      // Try to find by payment ID first
      let cryptoPayment = await prisma.cryptoPayment.findUnique({
        where: { nowpaymentsPaymentId },
      });

      // If not found by payment ID and we have investmentId, try that as fallback
      if (!cryptoPayment && investmentId) {
        logger.info(
          `[NOWPAYMENTS] Payment not found by ID, trying fallback lookup by investmentId: ${investmentId}`
        );
        cryptoPayment = await prisma.cryptoPayment.findUnique({
          where: { investmentId },
        });
      }

      if (!cryptoPayment) {
        logger.warn(
          `[NOWPAYMENTS] Payment not found: ${nowpaymentsPaymentId}${investmentId ? ` (investmentId: ${investmentId})` : ""}`
        );
        return null;
      }

      logger.info(
        `[NOWPAYMENTS] Found payment for update`,
        {
          nowpaymentsPaymentId: cryptoPayment.nowpaymentsPaymentId,
          investmentId: cryptoPayment.investmentId,
          currentStatus: cryptoPayment.status,
          newStatus: status,
        }
      );

      let updateData: any = {
        status,
        paystatus: paymentStatus || cryptoPayment.paystatus,
      };

      if (status === "CONFIRMED") {
        updateData.confirmedAt = new Date();
      } else if (status === "FAILED" || status === "EXPIRED") {
        updateData.failedAt = new Date();
      }

      const updated = await prisma.cryptoPayment.update({
        where: { investmentId: cryptoPayment.investmentId },
        data: updateData,
      });

      logger.info(
        `[NOWPAYMENTS] Payment status updated: ${nowpaymentsPaymentId}`,
        { newStatus: status, investmentId: cryptoPayment.investmentId }
      );

      return updated;
    } catch (error) {
      logger.error(`[NOWPAYMENTS] Failed to update payment status:`, error);
      throw error;
    }
  }

  /**
   * Validate configuration and payment prerequisites
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.apiKey) {
      errors.push("NOWPAYMENTS_API_KEY is not configured");
    }

    if (!this.ipnSecret) {
      errors.push("NOWPAYMENTS_IPN_SECRET is not configured");
    }

    const defaultCrypto = this.getDefaultCrypto();
    if (!defaultCrypto) {
      errors.push("DEFAULT_CRYPTOCURRENCY is not configured");
    }

    const supportedCryptos = this.getSupportedCryptos();
    if (supportedCryptos.length === 0) {
      errors.push("ACCEPTED_CRYPTOCURRENCIES is not configured");
    }

    if (defaultCrypto && !supportedCryptos.includes(defaultCrypto)) {
      errors.push(
        `DEFAULT_CRYPTOCURRENCY "${defaultCrypto}" is not in ACCEPTED_CRYPTOCURRENCIES`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Log configuration for debugging
   */
  logConfiguration(): void {
    const validation = this.validateConfiguration();
    
    logger.info(`[NOWPAYMENTS] Configuration Check:`, {
      valid: validation.valid,
      errors: validation.errors,
      apiKeyConfigured: !!this.apiKey,
      ipnSecretConfigured: !!this.ipnSecret,
      defaultCrypto: this.getDefaultCrypto(),
      supportedCryptos: this.getSupportedCryptos(),
    });

    if (!validation.valid) {
      validation.errors.forEach((error) => {
        logger.warn(`[NOWPAYMENTS] Configuration Issue: ${error}`);
      });
    }
  }

  /**
   * Debug method to test API responses
   */
  async debugApiResponse(amountUsd: number, cryptocurrency: string): Promise<any> {
    try {
      logger.info(`[DEBUG] Testing API response for ${cryptocurrency}...`);

      // Test 1: Estimate endpoint
      const estimateResponse = await this.api.get(`/estimate`, {
        params: {
          amount: amountUsd,
          currency_from: "usd",
          currency_to: cryptocurrency.toLowerCase(),
        },
      });

      logger.info(`[DEBUG] Estimate endpoint response:`, {
        status: estimateResponse.status,
        fields: Object.keys(estimateResponse.data),
        data: estimateResponse.data,
      });

      // Test 2: Create test payment to see what fields are returned
      const testPaymentData = {
        price_amount: amountUsd,
        price_currency: "usd",
        pay_currency: cryptocurrency.toLowerCase(),
        order_id: `TEST-${Date.now()}`,
        order_description: "TEST PAYMENT",
        ipn_callback_url: `${config.BOT_WEBHOOK_URL}/webhook/payment`,
      };

      const paymentResponse = await this.api.post(`/invoice`, testPaymentData);

      logger.info(`[DEBUG] Payment creation response:`, {
        status: paymentResponse.status,
        fields: Object.keys(paymentResponse.data),
        pay_amount: paymentResponse.data.pay_amount,
        pay_currency: paymentResponse.data.pay_currency,
        price_amount: paymentResponse.data.price_amount,
        price_currency: paymentResponse.data.price_currency,
        fullData: paymentResponse.data,
      });

      return {
        estimate: estimateResponse.data,
        payment: paymentResponse.data,
      };
    } catch (error: any) {
      logger.error(`[DEBUG] API test failed:`, {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Get supported currencies
   */
  getSupportedCryptos(): string[] {
    return config.ACCEPTED_CRYPTOCURRENCIES.split(",").map((c) => c.trim());
  }

  /**
   * Get default cryptocurrency
   */
  getDefaultCrypto(): string {
    return config.DEFAULT_CRYPTOCURRENCY;
  }

  /**
   * Calculate crypto amount from USD with multiple fallback sources
   */
  async calculateCryptoAmount(
    amountUsd: number,
    cryptocurrency: string,
    paymentData?: NowpaymentsPaymentResponse
  ): Promise<{cryptoAmount: number; source: string}> {
    try {
      // Try Nowpayments estimate endpoint first
      const estimate = await this.getConversionEstimate(amountUsd, cryptocurrency);
      return {
        cryptoAmount: estimate.cryptoAmount,
        source: "estimate_endpoint"
      };
    } catch (estimateError) {
      logger.warn(`[NOWPAYMENTS] Estimate endpoint failed, trying other methods`, {
        error: (estimateError as any).message,
        amountUsd,
        cryptocurrency,
      });
    }

    // Fallback 1: Try to extract from Nowpayments payment response
    if (paymentData) {
      if (paymentData.pay_amount && Number(paymentData.pay_amount) > 0) {
        return {
          cryptoAmount: Number(paymentData.pay_amount),
          source: "payment_response_pay_amount"
        };
      }
      if (paymentData.price_amount && Number(paymentData.price_amount) > 0 && paymentData.price_currency !== "usd") {
        return {
          cryptoAmount: Number(paymentData.price_amount),
          source: "payment_response_price_amount_non_usd"
        };
      }
    }

    // Fallback 2: Use a hardcoded exchange rate (not ideal, but better than nothing)
    const hardcodedRates: Record<string, number> = {
      "btc": 45000,       // 1 BTC = ~$45,000
      "eth": 2500,        // 1 ETH = ~$2,500
      "usdt": 1,          // 1 USDT = ~$1
      "ada": 0.5,         // 1 ADA = ~$0.50
      "bnb": 600,         // 1 BNB = ~$600
      "xrp": 2,           // 1 XRP = ~$2
      "sol": 200,         // 1 SOL = ~$200
      "doge": 0.3,        // 1 DOGE = ~$0.30
      "ltc": 150,         // 1 LTC = ~$150
      "algo": 0.45,       // 1 ALGO = ~$0.45
    };

    const rate = hardcodedRates[cryptocurrency.toLowerCase()];
    if (rate) {
      const cryptoAmount = amountUsd / rate;
      logger.warn(`[NOWPAYMENTS] Using hardcoded exchange rate for ${cryptocurrency}`, {
        amountUsd,
        rate,
        cryptoAmount,
      });
      return {
        cryptoAmount,
        source: "hardcoded_rate"
      };
    }

    // If all else fails, log a critical error but return the USD amount as last resort
    logger.error(`[NOWPAYMENTS] No conversion method available for ${cryptocurrency}`, {
      amountUsd,
      cryptocurrency,
    });
    return {
      cryptoAmount: amountUsd,
      source: "fallback_usd_amount"
    };
  }
}

export default new NowpaymentsService();
