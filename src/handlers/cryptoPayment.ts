import logger from "../config/logger.js";
import prisma from "../db/client.js";
import nowpaymentsService from "../services/cryptoPayment.js";
import { formatCurrency, calculateMaturityDate } from "../lib/helpers.js";
import bot from "../index.js";
import { config } from "../config/env.js";
import CurrencyService from "../services/currency.js";
import axios from "axios";
import puppeteer from "puppeteer";

type SessionContext = any;

// Browser pooling for performance
let cachedBrowser: any = null;

async function getOrCreateBrowser(launchOptions: any) {
  if (cachedBrowser) {
    try {
      await cachedBrowser.version(); // Test if still alive
      return cachedBrowser;
    } catch {
      cachedBrowser = null;
    }
  }
  cachedBrowser = await puppeteer.launch(launchOptions);
  return cachedBrowser;
}

/**
 * Extract payment URL with multiple strategies and retry logic
 * GUARANTEES URL fetch or throws error with detailed diagnosis
 */
async function fetchInvoiceUrl(invoiceUrl: string): Promise<string> {
  if (!invoiceUrl) throw new Error("[CRYPTO] Invoice URL is empty");

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let browser = null;
    let page = null;
    
    try {
      logger.info(`[CRYPTO] Fetch attempt ${attempt}/${MAX_RETRIES}:`, {
        url: invoiceUrl.substring(0, 100),
      });

      // Detect platform and use appropriate browser
      let launchOptions: any = {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      };

      const fs = await import("fs");

      if (process.platform === "win32") {
        const chromeExe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
        if (fs.existsSync(chromeExe)) {
          launchOptions.executablePath = chromeExe;
          logger.info(`[CRYPTO] Using system Chrome`);
        }
      } else if (process.platform === "linux") {
        const chromiumPaths = [
          "/usr/bin/chromium-browser",
          "/usr/bin/chromium",
          "/snap/bin/chromium",
        ];
        for (const path of chromiumPaths) {
          if (fs.existsSync(path)) {
            launchOptions.executablePath = path;
            logger.info(`[CRYPTO] Using system Chromium at ${path}`);
            break;
          }
        }
      }

      browser = await getOrCreateBrowser(launchOptions);
      page = await browser.newPage();

      page.setDefaultNavigationTimeout(45000);
      page.setDefaultTimeout(45000);

      // Navigate to invoice page
      logger.info(`[CRYPTO] Navigating to invoice page...`);
      const response = await page.goto(invoiceUrl, {
        waitUntil: "domcontentloaded",
        timeout: 40000,
      });
      logger.info(`[CRYPTO] Page loaded with status: ${response?.status()}`);

      // STRATEGY 1: Wait for URL change (most reliable)
      logger.info(`[CRYPTO] Attempting URL extraction (Strategy 1: Navigation)...`);
      let finalUrl: string | null = null;

      try {
        await Promise.race([
          page.waitForNavigation({ timeout: 8000 }),
          new Promise(resolve => setTimeout(resolve, 3000)),
        ]);
        finalUrl = page.url();
        logger.info(`[CRYPTO] URL from navigation: ${finalUrl}`);
      } catch {
        logger.info(`[CRYPTO] Navigation timeout, trying next strategy...`);
      }

      // STRATEGY 2: Check window.location directly
      if (!finalUrl || finalUrl === "about:blank") {
        logger.info(`[CRYPTO] Attempting URL extraction (Strategy 2: window.location)...`);
        try {
          finalUrl = await page.evaluate(() => {
            if (window.location.href && window.location.href !== "about:blank") {
              return window.location.href;
            }
            return null;
          });
          if (finalUrl) logger.info(`[CRYPTO] URL from window.location: ${finalUrl}`);
        } catch (e) {
          logger.warn(`[CRYPTO] Failed to evaluate window.location:`, {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // STRATEGY 3: Search for payment/checkout links in DOM
      if (!finalUrl || finalUrl === "about:blank") {
        logger.info(`[CRYPTO] Attempting URL extraction (Strategy 3: DOM Links)...`);
        try {
          finalUrl = await page.evaluate(() => {
            const selectors = [
              'a[href*="payment"]',
              'a[href*="checkout"]',
              'a[href*="crypto"]',
              'a[href*="invoice"]',
              'a[href*="nowpayment"]',
              'button[onclick*="payment"]',
              'a[href^="http"]', // Any absolute link
            ];

            for (const selector of selectors) {
              const element = document.querySelector(selector) as any;
              if (element) {
                const href = element.getAttribute("href") || element.href;
                if (href && typeof href === "string" && href.startsWith("http")) {
                  return href;
                }
              }
            }
            return null;
          });
          if (finalUrl) logger.info(`[CRYPTO] URL from DOM: ${finalUrl}`);
        } catch (e) {
          logger.warn(`[CRYPTO] Failed to search DOM:`, {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // STRATEGY 4: Check for meta redirects and JS redirects
      if (!finalUrl || finalUrl === "about:blank") {
        logger.info(`[CRYPTO] Attempting URL extraction (Strategy 4: Meta/JS Redirects)...`);
        try {
          finalUrl = await page.evaluate(() => {
            // Meta refresh redirect
            const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
            if (metaRefresh) {
              const content = metaRefresh.getAttribute("content");
              const urlMatch = content?.match(/url=([^;]+)/i);
              if (urlMatch && urlMatch[1]) {
                return urlMatch[1].trim().replace(/['"]/g, "");
              }
            }

            // Check for common JS redirect patterns
            if ((window as any).location?.href) {
              return (window as any).location.href;
            }

            return null;
          });
          if (finalUrl) logger.info(`[CRYPTO] URL from meta/JS: ${finalUrl}`);
        } catch (e) {
          logger.warn(`[CRYPTO] Failed meta/JS extraction:`, {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // STRATEGY 5: Wait longer and extract any final URL
      if (!finalUrl || finalUrl === "about:blank") {
        logger.info(`[CRYPTO] Attempting URL extraction (Strategy 5: Extended Wait)...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        try {
          finalUrl = await page.evaluate(() => {
            return window.location.href;
          });
          if (finalUrl && finalUrl !== "about:blank") {
            logger.info(`[CRYPTO] URL from extended wait: ${finalUrl}`);
          }
        } catch (e) {
          logger.warn(`[CRYPTO] Extended wait extraction failed`);
        }
      }

      // Success - return the URL
      if (finalUrl && finalUrl !== "about:blank") {
        logger.info(`[CRYPTO] ✓ Payment URL successfully fetched on attempt ${attempt}`, {
          url: finalUrl.substring(0, 150),
        });
        return finalUrl;
      }

      // Log failure for this attempt
      lastError = new Error(
        `[CRYPTO] All extraction strategies failed on attempt ${attempt}`
      );
      logger.warn(`[CRYPTO] Attempt ${attempt} failed, retrying...`, {
        strategies_tried: 5,
      });

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(`[CRYPTO] Attempt ${attempt} error:`, {
        message: lastError.message,
        attempt,
      });

      // Don't retry on network/invalid URL errors
      if (
        lastError.message.includes("net::ERR_") ||
        lastError.message.includes("Invalid URL")
      ) {
        throw new Error(
          `[CRYPTO] Invalid or unreachable URL: ${lastError.message}`
        );
      }
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          logger.debug(`[CRYPTO] Error closing page:`, {
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    // Wait before retry
    if (attempt < MAX_RETRIES) {
      const waitTime = Math.min(1000 * attempt, 5000);
      logger.info(`[CRYPTO] Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // All retries exhausted
  const errorMsg = `[CRYPTO] Failed to fetch payment URL after ${MAX_RETRIES} attempts. Last error: ${lastError?.message || "Unknown"}`;
  logger.error(errorMsg, { url: invoiceUrl.substring(0, 100) });
  throw new Error(errorMsg);
}

/**
 * Handle cryptocurrency selection from payment confirmation screen
 */
export async function handleSelectCryptocurrency(ctx: SessionContext): Promise<void> {
  try {
    const data = ctx.update.callback_query?.data || "";
    const match = data.match(/select_crypto_(.+?)_([A-Z]+)$/);
    
    if (!match || match.length < 3) {
      await ctx.reply("Invalid cryptocurrency selection. Please try again.");
      await ctx.answerCallbackQuery();
      return;
    }

    const investmentId = match[1];
    const selectedCrypto = match[2].toUpperCase();

    logger.info(`[CRYPTO] Cryptocurrency selected`, {
      investmentId,
      cryptocurrency: selectedCrypto,
    });

    const investment = await prisma.investment.findUnique({
      where: { id: investmentId },
      include: { user: true, package: true },
    });

    if (!investment) {
      await ctx.reply("Investment not found.");
      await ctx.answerCallbackQuery();
      return;
    }

    ctx.session.currentInvestment = {
      ...ctx.session.currentInvestment,
      investmentId,
      cryptocurrency: selectedCrypto,
    };

    await ctx.answerCallbackQuery();
    // Show blockchain selection for this crypto
    await showBlockchainSelection(ctx, investmentId, selectedCrypto);
  } catch (error) {
    logger.error("Error in handleSelectCryptocurrency:", error);
    await ctx.reply("Error processing cryptocurrency selection. Please try again.");
    await ctx.answerCallbackQuery();
  }
}

/**
 * Show blockchain selection for the chosen cryptocurrency
 */
async function showBlockchainSelection(
  ctx: SessionContext,
  investmentId: string,
  cryptocurrency: string
): Promise<void> {
  try {
    const blockchainsForCrypto: { [key: string]: string[] } = {
      USDT: ["ethereum", "polygon", "tron", "bsc", "arbitrum", "optimism"],
      USDC: ["ethereum", "polygon", "arbitrum", "optimism"],
      BTC: ["bitcoin"],
      ETH: ["ethereum"],
      ADA: ["cardano"],
      LTC: ["litecoin"],
      SOL: ["solana"],
      XRP: ["ripple"],
      DOGE: ["dogecoin"],
      BNB: ["bsc"],
      MATIC: ["polygon"],
      ALGO: ["algorand"],
    };

    const blockchains = blockchainsForCrypto[cryptocurrency] || ["mainnet"];

    let message = `<b>Select Blockchain Network</b>\n\n`;
    message += `You selected: <b>${cryptocurrency}</b>\n\n`;
    message += `Available networks:\n`;
    blockchains.forEach((bc) => {
      message += `• ${bc.charAt(0).toUpperCase() + bc.slice(1)}\n`;
    });
    message += `\nChoose a network to continue:​`;

    const buttons = blockchains.map((blockchain) => [
      {
        text: blockchain.charAt(0).toUpperCase() + blockchain.slice(1),
        callback_data: `select_blockchain_${investmentId}_${cryptocurrency}_${blockchain}`,
      },
    ]);

    buttons.push([
      {
        text: "❌ Back",
        callback_data: `cancel_investment_${investmentId}`,
      },
    ]);

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
  } catch (error) {
    logger.error("Error showing blockchain selection:", error);
    await ctx.reply("Error selecting blockchain. Please try again.");
  }
}

/**
 * Handle blockchain selection
 */
export async function handleSelectBlockchain(ctx: SessionContext): Promise<void> {
  try {
    const data = ctx.update.callback_query?.data || "";
    const match = data.match(/select_blockchain_(.+?)_([A-Z]+)_(.+?)$/);

    if (!match || match.length < 4) {
      await ctx.answerCallbackQuery();
      return;
    }

    const investmentId = match[1];
    const cryptocurrency = match[2].toUpperCase();
    const blockchain = match[3];

    // SYNCHRONOUS lock check - block immediately if already processing
    if (paymentsInitializing.has(investmentId)) {
      // Wait a moment for the first request to finish
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Fetch and display the existing payment
      const existingPayment = await prisma.cryptoPayment.findUnique({
        where: { investmentId },
        include: { investment: { include: { package: true } } },
      });

      if (existingPayment && existingPayment.investment) {
        const paymentData = {
          payment_id: existingPayment.nowpaymentsPaymentId,
          id: existingPayment.nowpaymentsPaymentId,
          invoice_url: existingPayment.paymentUrl,
          checkoutUrl: existingPayment.paymentUrl,
        };
        
        // If wallet address is missing, try to fetch it
        let walletAddress = existingPayment.paymentAddress;
        if (!walletAddress && existingPayment.nowpaymentsPaymentId) {
          try {
            logger.info(`[CRYPTO] Existing payment missing wallet address, fetching:`, {
              investmentId,
              paymentId: existingPayment.nowpaymentsPaymentId,
            });
            
            // Small delay to ensure NowPayments has processed
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Try to fetch with different ID approaches (service will try token_id first)
            const paymentDetails = await nowpaymentsService.getPaymentStatus(
              existingPayment.nowpaymentsPaymentId
            );
            
            logger.info(`[CRYPTO] Fetched payment details for existing payment:`, {
              investmentId,
              hasPaymentDetails: !!paymentDetails,
              paymentDetailsKeys: paymentDetails ? Object.keys(paymentDetails) : [],
              payAddress: paymentDetails?.pay_address,
            });
            
            if (paymentDetails?.pay_address) {
              // Update with wallet address
              const updatedPayment = await prisma.cryptoPayment.update({
                where: { investmentId },
                data: { paymentAddress: paymentDetails.pay_address },
              });
              walletAddress = updatedPayment.paymentAddress;
              logger.info(`[CRYPTO] Updated existing payment with wallet address:`, {
                investmentId,
                walletAddress: walletAddress ? `***${walletAddress.slice(-8)}` : "STILL MISSING",
              });
            } else {
              logger.warn(`[CRYPTO] Payment details has no pay_address field:`, {
                investmentId,
                allFields: paymentDetails ? JSON.stringify(paymentDetails) : "NULL",
              });
            }
          } catch (fetchError) {
            logger.error(`[CRYPTO] Error fetching wallet address for existing payment:`, {
              investmentId,
              error: fetchError instanceof Error ? fetchError.message : String(fetchError),
            });
          }
        }
        
        logger.info(`[CRYPTO] Showing existing payment widget:`, {
          investmentId,
          hasWalletAddress: !!walletAddress,
        });
        
        await showCryptoPaymentWidget(ctx, existingPayment.investment, paymentData, existingPayment.cryptocurrency, walletAddress);
      } else {
        await ctx.reply("Payment is being created. Please try again in a moment.");
      }
      
      await ctx.answerCallbackQuery();
      return;
    }

    // SET SYNCHRONOUS FLAG immediately
    paymentsInitializing.add(investmentId);

    try {
    logger.info(`[CRYPTO] Blockchain selected`, {
      investmentId,
      cryptocurrency,
      blockchain,
    });

      const investment = await prisma.investment.findUnique({
        where: { id: investmentId },
        include: { user: true, package: true },
      });

      if (!investment) {
        await ctx.reply("Investment not found.");
        await ctx.answerCallbackQuery();
        return;
      }

      ctx.session.currentInvestment = {
        ...ctx.session.currentInvestment,
        investmentId,
        cryptocurrency,
        blockchain,
      };

      await ctx.answerCallbackQuery();
      await createCryptoPayment(ctx, investment, investmentId, cryptocurrency, blockchain);
    } finally {
      // Always remove the synchronous flag when done
      paymentsInitializing.delete(investmentId);
    }
  } catch (error) {
    logger.error("Error in handleSelectBlockchain:", error);
    await ctx.reply("Error processing blockchain selection. Please try again.");
    await ctx.answerCallbackQuery();
  }
}

/**
 * Create crypto payment with NOWPayments
 */
// Map to track payments currently being created (prevent race conditions)
const paymentsBeingCreated = new Map<string, Promise<void>>();
// Set to track payments currently being initiated (synchronous flag)
const paymentsInitializing = new Set<string>();

async function createCryptoPayment(
  ctx: SessionContext,
  investment: any,
  investmentId: string,
  cryptocurrency: string,
  blockchain?: string
): Promise<void> {
  try {
      const userId = investment.userId;
      const webhookUrl = `${config.BOT_WEBHOOK_URL}/webhook/payment`;

      await ctx.editMessageText(
        `Processing ${cryptocurrency.toUpperCase()} Payment\n\nCreating payment...`,
        { parse_mode: "HTML" }
      );

    // Check for existing valid payment
      const existingPayment = await prisma.cryptoPayment.findUnique({
        where: { investmentId },
      });

      let paymentData: any = null;
      let isNewPayment = false;

      if (existingPayment) {
        const isPending = existingPayment.status === "PENDING";
        const isExpired = new Date() >= existingPayment.expiresAt;
        const isSameCrypto = existingPayment.cryptocurrency === cryptocurrency;
        const isSameBlockchain = existingPayment.blockchain === (blockchain || null);

        if (isPending && !isExpired && isSameCrypto && isSameBlockchain) {
          // Reuse existing payment
          logger.debug(`[CRYPTO] Reusing existing payment for ${investmentId}`);
          
          paymentData = {
            payment_id: existingPayment.nowpaymentsPaymentId,
            id: existingPayment.nowpaymentsPaymentId,
            address: existingPayment.paymentAddress,
            amount: parseFloat(existingPayment.amountCrypto || "0"),
            checkoutUrl: existingPayment.paymentUrl,
            amountUsd: existingPayment.amountUsd,
            cryptocurrency: existingPayment.cryptocurrency,
            invoice_url: existingPayment.paymentUrl,
          };
          
          isNewPayment = false;
        } else {
          // Delete and create new
          logger.debug(`[CRYPTO] Creating new payment (existing was invalid) for ${investmentId}`);
          
          await prisma.cryptoPayment.delete({
            where: { investmentId },
          });
          
          paymentData = await nowpaymentsService.createPayment(
            investmentId,
            investment.userId,
            investment.amount,
            cryptocurrency,
            webhookUrl,
            blockchain
          );
          isNewPayment = true;
        }
      } else {
        // Create new payment
        paymentData = await nowpaymentsService.createPayment(
          investmentId,
          investment.userId,
          investment.amount,
          cryptocurrency,
          webhookUrl,
          blockchain
        );
        isNewPayment = true;
      }

      if (!paymentData) {
        throw new Error("Failed to create payment");
      }

      // Save new payment to database
      if (isNewPayment) {
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + config.PAYMENT_TIMEOUT_MINUTES);

        // Use the payment_id if available, otherwise use id
        const paymentIdToSave = String(paymentData.payment_id || paymentData.id);
        
        if (!paymentIdToSave || paymentIdToSave === 'undefined') {
          throw new Error("Payment data missing both payment_id and id fields");
        }
        
        logger.info(`[CRYPTO] Saving payment to database:`, {
          investmentId,
          paymentIdToSave,
          sourceField: paymentData.payment_id ? "payment_id" : "id",
          invoiceUrl: paymentData.checkoutUrl ?? paymentData.invoice_url,
        });

        await prisma.cryptoPayment.upsert({
          where: { investmentId },
          create: {
            investmentId,
            userId: userId,
            amountUsd: investment.amount,
            cryptocurrency: cryptocurrency,
            blockchain: blockchain || null,
            amountCrypto: (paymentData.amount ?? paymentData.pay_amount ?? "0").toString(),
            paymentAddress: paymentData.address || paymentData.pay_address || null,
            paymentUrl: paymentData.checkoutUrl ?? paymentData.invoice_url ?? null,
            nowpaymentsPaymentId: paymentIdToSave,
            status: "PENDING",
            paystatus: paymentData.payment_status ?? paymentData.payment_status ?? "pending",
            expiresAt,
          },
          update: {
            amountCrypto: (paymentData.amount ?? paymentData.pay_amount ?? "0").toString(),
            paymentAddress: paymentData.address || paymentData.pay_address || null,
            paymentUrl: paymentData.checkoutUrl ?? paymentData.invoice_url ?? null,
            blockchain: blockchain || null,
            nowpaymentsPaymentId: paymentIdToSave,
            status: "PENDING",
            paystatus: paymentData.payment_status ?? paymentData.payment_status ?? "pending",
            expiresAt,
            updatedAt: new Date(),
          },
        });
      }

      // Fetch the currently saved payment
      const savedPayment = await prisma.cryptoPayment.findUnique({
        where: { investmentId },
      });

      // Fetch payment details to get wallet address if not already present
      let walletAddress = savedPayment?.paymentAddress;
      
      // First, try to use wallet address from initial payment response
      if (!walletAddress && paymentData?.pay_address) {
        logger.info(`[CRYPTO] Using wallet address from initial payment response:`, {
          investmentId,
          walletAddress: paymentData.pay_address,
        });
        walletAddress = paymentData.pay_address;
        
        // Save it to database
        try {
          await prisma.cryptoPayment.update({
            where: { investmentId },
            data: { paymentAddress: walletAddress },
          });
        } catch (updateErr) {
          logger.warn(`[CRYPTO] Could not save wallet address from response:`, {
            error: updateErr instanceof Error ? updateErr.message : String(updateErr),
          });
        }
      }
      
      // If still no address, fetch from API
      if (!walletAddress && isNewPayment) {
        try {
          const paymentIdToFetch = String(paymentData.payment_id || paymentData.id);
          const tokenIdToFetch = paymentData.token_id ? String(paymentData.token_id) : undefined;
          
          logger.info(`[CRYPTO] Attempting to fetch wallet address from API:`, {
            investmentId,
            paymentId: paymentIdToFetch,
            tokenId: tokenIdToFetch,
            paymentIdType: typeof paymentIdToFetch,
          });

          // Try fetching with a small delay to let NowPayments assign wallet
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Pass both IDs - service will try token_id first
          const paymentDetails = await nowpaymentsService.getPaymentStatus(paymentIdToFetch, tokenIdToFetch);
          
          logger.info(`[CRYPTO] Payment details API response:`, {
            investmentId,
            hasPaymentDetails: !!paymentDetails,
            paymentDetailsKeys: paymentDetails ? Object.keys(paymentDetails) : [],
            payAddress: paymentDetails?.pay_address,
          });
          
          if (paymentDetails) {
            if (paymentDetails.pay_address) {
              logger.info(`[CRYPTO] Got wallet address from API:`, {
                investmentId,
                walletAddress: paymentDetails.pay_address,
              });
              
              // Update the saved payment with wallet address
              const updatedPayment = await prisma.cryptoPayment.update({
                where: { investmentId },
                data: { paymentAddress: paymentDetails.pay_address },
              });
              
              walletAddress = updatedPayment.paymentAddress;
              logger.info(`[CRYPTO] Database updated with wallet address:`, {
                investmentId,
                walletAddress: walletAddress ? `***${walletAddress.slice(-8)}` : "FAILED",
              });
            } else {
              logger.warn(`[CRYPTO] API response missing pay_address field:`, {
                investmentId,
                allFields: JSON.stringify(Object.keys(paymentDetails)),
              });
            }
          } else {
            logger.warn(`[CRYPTO] getPaymentStatus returned null:`, {
              investmentId,
              paymentId: paymentIdToFetch,
            });
          }
        } catch (fetchError) {
          logger.error(`[CRYPTO] Error fetching wallet address from API:`, {
            investmentId,
            error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          });
        }
      }

      logger.info(`[CRYPTO] Ready to fetch final payment URL:`, {
        investmentId,
        hasWalletAddress: !!walletAddress,
        walletAddressPreview: walletAddress ? `***${walletAddress.slice(-8)}` : "MISSING ⚠️",
      });

      // Define crypto variable for use in messages
      const crypto = cryptocurrency.toUpperCase();

      // Show loading message while fetching final payment URL
      let message = `<b>⏳ Preparing Payment Page...</b>\n\n`;
      message += `Fetching your secure payment link from NowPayments.\n`;
      message += `This should take just a moment...\n\n`;
      message += `💰 Amount: ${formatCurrency(investment.amount)} USD\n`;
      message += `💵 Method: ${crypto}`;

      await ctx.editMessageText(message, {
        parse_mode: "HTML",
      });

      // Fetch the final payment URL using Puppeteer
      let finalPaymentUrl = paymentData?.invoice_url || null;
      if (finalPaymentUrl) {
        try {
          logger.info(`[CRYPTO] Starting invoice URL fetch with Puppeteer...`);
          const extractedUrl = await fetchInvoiceUrl(finalPaymentUrl);
          
          logger.info(`[CRYPTO] Final payment URL extracted successfully:`, {
            url: extractedUrl.substring(0, 100),
          });
          
          finalPaymentUrl = extractedUrl;
          
          // Save extracted URL to database
          try {
            await prisma.cryptoPayment.update({
              where: { investmentId },
              data: { paymentUrl: extractedUrl },
            });
            logger.info(`[CRYPTO] Saved final payment URL to database`);
          } catch (dbErr) {
            logger.warn(`[CRYPTO] Could not save URL to database:`, {
              error: dbErr instanceof Error ? dbErr.message : String(dbErr),
            });
          }
        } catch (fetchErr) {
          logger.warn(`[CRYPTO] Error fetching final URL (will use original invoice URL as fallback):`, {
            error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
            fallbackUrl: finalPaymentUrl?.substring(0, 100),
          });
          // Continue with the original invoice URL as fallback
        }
      }

      // Now show the complete payment widget with the extracted final URL
      const updatedInvestment = await prisma.investment.findUnique({
        where: { id: investmentId },
        include: { package: true },
      });

      if (updatedInvestment) {
        await showCryptoPaymentWidget(
          ctx,
          updatedInvestment,
          { ...paymentData, paymentUrl: finalPaymentUrl },
          cryptocurrency,
          walletAddress
        );
        logger.info(`[CRYPTO] Displayed complete payment widget with final URL`);
      }
  } catch (error: any) {
    logger.error(`[CRYPTO] Failed to create payment:`, {
      investmentId,
      error: error.message,
    });

    let message = `<b>❌ Payment Creation Failed</b>\n\n`;
    message += `There was an issue creating the ${cryptocurrency.toUpperCase()} payment.\n\n`;
    message += `Error: ${error.message}\n\n`;
    message += `Troubleshooting:\n`;
    message += `1. Check your internet connection\n`;
    message += `2. Try again in a few moments\n`;
    message += `3. Contact support if the issue persists`;

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Try Again",
              callback_data: `select_crypto_${investmentId}_${cryptocurrency}`,
            },
          ],
          [
            {
              text: "Cancel Investment",
              callback_data: `cancel_investment_${investmentId}`,
            },
          ],
          [{ text: "Contact Support", callback_data: "support" }],
        ],
      },
    });
    
    await ctx.answerCallbackQuery();
  }
}

/**
 * Display complete in-Telegram payment widget
 */
async function showCryptoPaymentWidget(
  ctx: SessionContext,
  investment: any,
  paymentData: any,
  cryptocurrency: string,
  paymentAddress?: string | null
): Promise<void> {
  try {
    const crypto = cryptocurrency.toUpperCase();

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + config.PAYMENT_TIMEOUT_MINUTES);
    const timeLeftMs = expiresAt.getTime() - Date.now();
    const timeLeftMinutes = Math.ceil(timeLeftMs / 60000);

    // Prefer extracted payment URL from paymentData when available, otherwise fall back to invoice URL
    const fullPaymentUrl = paymentData?.paymentUrl ?? paymentData?.checkoutUrl ?? paymentData?.invoice_url ?? paymentData?.invoiceUrl ?? null;

    // Build streamlined message with only essential information
    let message = `<b>💳 Complete Your Payment</b>\n\n`;
    message += `<b>Amount:</b> ${formatCurrency(investment.amount)} USD\n`;
    message += `<b>Payment Currency:</b> ${crypto}\n\n`;
    
    if (paymentAddress) {
      message += `<b>Send to:</b>\n<code>${paymentAddress}</code>\n\n`;
    } else {
      message += `<b>Wallet Address:</b> Being generated...\n\n`;
    }
    
    message += `<b>⏰ Expires in:</b> ${timeLeftMinutes} minutes\n\n`;
    message += `✅ Payment auto-activates your investment`;

    // Build inline keyboard with main action button and utilities
    const buttons: any[][] = [];

    // Add payment page button if available
    if (fullPaymentUrl) {
      buttons.push([
        {
          text: "💳 Open Payment Page",
          url: fullPaymentUrl,
        } as any,
      ]);
    }

    // Add copy wallet button if we have the address
    if (paymentAddress) {
      buttons.push([
        {
          text: "📋 Copy Address",
          callback_data: `copy_address_${investment.id}`,
        } as any,
      ]);
    }
    
    // Status and cancel options
    buttons.push([
      {
        text: "🔄 Status",
        callback_data: `check_payment_${investment.id}`,
      } as any,
      {
        text: "❌ Cancel",
        callback_data: `cancel_investment_${investment.id}`,
      } as any,
    ]);

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: buttons,
      },
    });

    // Start auto-checking payment status using stored payment ID
    const idToCheck = paymentData.payment_id ?? paymentData.id;
    if (!isNaN(Number(idToCheck))) {
      startPaymentStatusChecker(ctx, investment.id, String(idToCheck), crypto);
    }
  } catch (error: any) {
    logger.error(`[CRYPTO] Error displaying payment widget:`, error);
    await ctx.reply(`Error displaying payment details: ${error.message}`);
  }
}

/**
 * Check payment status
 */
export async function handleCheckPaymentStatus(ctx: SessionContext): Promise<void> {
  try {
    const data = ctx.update.callback_query?.data || "";
    const match = data.match(/check_payment_(.+?)$/);
    
    if (!match) {
      await ctx.answerCallbackQuery();
      return;
    }

    const investmentId = match[1];
    await ctx.answerCallbackQuery({ text: "Checking payment status..." });

    const payment = await prisma.cryptoPayment.findUnique({
      where: { investmentId },
    });

    if (!payment || !payment.nowpaymentsPaymentId) {
      await ctx.answerCallbackQuery({ text: "Payment not found" });
      return;
    }

    try {
      const statusData = await nowpaymentsService.getPaymentStatus(
        Number(payment.nowpaymentsPaymentId),
        
      );

      const crypto = payment.cryptocurrency.toUpperCase();

      if (!statusData) {
        // Payment not found
        const statusMessage = `<b>Payment Status Update</b>\n\nPayment not found on provider. Please check the payment link or try again later.`;
        await ctx.editMessageText(statusMessage, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🔄 Refresh",
                  callback_data: `check_payment_${investmentId}`,
                },
              ],
              [
                {
                  text: "❌ Cancel",
                  callback_data: `cancel_investment_${investmentId}`,
                },
              ],
            ],
          },
        });
        return;
      }

      const status = statusData.status;
      const statusText = statusData.statusText || statusData.payment_status || "Unknown";
      const received = statusData.received || 0;

      let statusMessage = `<b>Payment Status Update</b>\n\n`;
      statusMessage += `Status: ${statusText}\n`;
      statusMessage += `Received: ${received} ${crypto}\n`;
      statusMessage += `Expected: ${payment.amountCrypto} ${crypto}\n`;

      if (status === 100) {
        // Payment confirmed
        statusMessage += `\n✅ Payment confirmed!\n`;
        statusMessage += `Your investment will be activated shortly.`;
      } else if (status > 0) {
        statusMessage += `\n⏳ Waiting for payment confirmation...\n`;
        statusMessage += `This may take a few minutes.`;
      } else {
        statusMessage += `\n⚠️ Payment not yet received.\n`;
        statusMessage += `Please check the wallet address and send the correct amount.`;
      }

      await ctx.editMessageText(statusMessage, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔄 Refresh",
                callback_data: `check_payment_${investmentId}`,
              },
            ],
            [
              {
                text: "❌ Cancel",
                callback_data: `cancel_investment_${investmentId}`,
              },
            ],
          ],
        },
      });
    } catch (statusError: any) {
      logger.error(`[CRYPTO] Error checking payment status:`, {
        message: statusError?.message,
        status: statusError?.response?.status,
        data: statusError?.response?.data,
      });
      await ctx.answerCallbackQuery({
        text: `Error: ${statusError.message}`,
        show_alert: true,
      });
    }
  } catch (error: any) {
    logger.error("Error in handleCheckPaymentStatus:", error);
    await ctx.answerCallbackQuery({ text: "Error checking status" });
  }
}

/**
 * Cancel crypto payment
 */
export async function handleCancelCryptoPayment(ctx: SessionContext): Promise<void> {
  try {
    const data = ctx.update.callback_query?.data || "";
    const match = data.match(/cancel_investment_(.+?)$/);
    
    if (!match) {
      await ctx.answerCallbackQuery();
      return;
    }

    const investmentId = match[1];
    await ctx.answerCallbackQuery({ text: "Cancelling investment..." });

    // Delete the payment and investment
    await prisma.cryptoPayment.deleteMany({
      where: { investmentId },
    });

    const investment = await prisma.investment.findUnique({
      where: { id: investmentId },
    });

    if (investment && investment.status === "AWAITING_PAYMENT") {
      await prisma.investment.delete({
        where: { id: investmentId },
      });
    }

    await ctx.editMessageText(`Investment cancelled. You can start a new investment anytime.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Back to Main Menu", callback_data: "menu" }],
        ],
      },
    });
  } catch (error: any) {
    logger.error("Error in handleCancelCryptoPayment:", error);
    await ctx.answerCallbackQuery({ text: "Error cancelling investment" });
  }
}

/**
 * Auto-check payment status periodically
 */
function startPaymentStatusChecker(
  ctx: SessionContext,
  investmentId: string,
  txid: string,
  cryptocurrency: string
): void {
  let checkCount = 0;
  const maxChecks = 60; // Check for up to 60 iterations
  const checkInterval = 10000; // Check every 10 seconds

  const checker = setInterval(async () => {
    try {
      checkCount++;

      if (checkCount > maxChecks) {
        clearInterval(checker);
        logger.debug(`[CRYPTO] Payment status check ${checkCount}/${maxChecks} for ${investmentId}`);
        return;
      }

      // Prefer the saved NowPayments payment ID from DB; fall back to provided txid
      const dbPayment = await prisma.cryptoPayment.findUnique({ where: { investmentId } });
      const idToCheck = Number(dbPayment?.nowpaymentsPaymentId ?? txid);

      if (isNaN(idToCheck)) {
        logger.warn(`[CRYPTO] Payment checker: invalid payment id for ${investmentId}. Skipping this check.`);
        return;
      }

      const statusData = await nowpaymentsService.getPaymentStatus(idToCheck);

      if (!statusData) {
        logger.warn(`[CRYPTO] Payment checker: payment not found for ${investmentId} (id ${idToCheck})`);
        return; // Try again on next interval
      }

      if (statusData.payment_status === "finished" || statusData.payment_status === "confirmed" || statusData.payment_status === "sending") {
        // Payment confirmed!
        clearInterval(checker);
        
        logger.info(`[CRYPTO] ✅ Payment confirmed for ${investmentId}`);

        // Get investment with package to recalculate maturity date
        const investmentWithPackage = await prisma.investment.findUnique({
          where: { id: investmentId },
          include: { package: true },
        });

        if (!investmentWithPackage) {
          logger.error(`[CRYPTO] Investment not found for payment confirmation: ${investmentId}`);
          return;
        }

        // Calculate new maturity date from activation time
        const activationTime = new Date();
        const newMaturityDate = calculateMaturityDate(investmentWithPackage.package.duration, activationTime);

        // Update payment status in database
        await prisma.cryptoPayment.update({
          where: { investmentId },
          data: {
            status: "CONFIRMED",
            paystatus: statusData.payment_status || "confirmed",
            confirmedAt: new Date(),
          },
        });

        // Update investment status with activation timestamp and recalculated maturity date
        await prisma.investment.update({
          where: { id: investmentId },
          data: {
            status: "ACTIVE",
            activatedAt: activationTime,
            maturityDate: newMaturityDate,
          },
        });

        // Notify user
        try {
          await ctx.editMessageText(
            `✅ <b>Payment Confirmed!</b>\n\nYour investment has been activated.\n\nYour investment will start earning returns immediately.`,
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "View Investment", callback_data: "my_investments" }],
                  [{ text: "Back to Menu", callback_data: "menu" }],
                ],
              },
            }
          );
        } catch (editError) {
          logger.debug(`[CRYPTO] Could not update message for confirmed payment`);
        }
      }
    } catch (error: any) {
        logger.debug(`[CRYPTO] Payment status check error: ${error.message}`);
    }
  }, checkInterval);
}

/**
 * Handle payment confirmation (called from webhook)
 */
export async function handlePaymentConfirmation(investmentId: string): Promise<void> {
  try {
    const investment = await prisma.investment.findUnique({
      where: { id: investmentId },
      include: { package: true },
    });

    if (!investment) {
      logger.error(`[CRYPTO] Investment not found for confirmation:`, {
        investmentId,
      });
      return;
    }

    // Calculate new maturity date from activation time
    const activationTime = new Date();
    const newMaturityDate = calculateMaturityDate(investment.package.duration, activationTime);

    // Update investment and payment with activation timestamp and recalculated maturity date
    await prisma.investment.update({
      where: { id: investmentId },
      data: {
        status: "ACTIVE",
        activatedAt: activationTime,
        maturityDate: newMaturityDate,
      },
    });

    await prisma.cryptoPayment.update({
      where: { investmentId },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });

    logger.info(`[CRYPTO] Payment confirmed and investment activated: ${investmentId}`);
  } catch (error: any) {
    logger.error(`[CRYPTO] Error handling payment confirmation:`, error);
  }
}

/**
 * Initiate crypto payment flow
 */
export async function handleInitiateCryptoPayment(ctx: SessionContext): Promise<void> {
  try {
    const data = ctx.update.callback_query?.data || "";
    const investmentId = data.replace("initiate_crypto_", "");

    const investment = await prisma.investment.findUnique({
      where: { id: investmentId },
      include: { package: true },
    });

    if (!investment) {
      await ctx.reply("Investment not found.");
      await ctx.answerCallbackQuery();
      return;
    }

    // Show cryptocurrency selection
    const cryptoList = (config.ACCEPTED_CRYPTOCURRENCIES || "BTC,ETH,USDT,LTC").split(",");
    
    const cryptoButtons = cryptoList.map((crypto) => [
      {
        text: crypto.trim().toUpperCase(),
        callback_data: `select_crypto_${investmentId}_${crypto.trim().toUpperCase()}`,
      },
    ]);

    cryptoButtons.push([
      {
        text: "Cancel",
        callback_data: `cancel_investment_${investmentId}`,
      },
    ]);

    await ctx.editMessageText(
      `<b>Select Cryptocurrency</b>\n\nChoose which cryptocurrency to use for your investment of ${formatCurrency(investment.amount)}:`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: cryptoButtons,
        },
      }
    );

    await ctx.answerCallbackQuery();
  } catch (error: any) {
    logger.error("Error in handleInitiateCryptoPayment:", error);
    await ctx.reply("Error initiating crypto payment. Please try again.");
    await ctx.answerCallbackQuery();
  }
}

/**
 * Copy address to clipboard
 */
export async function handleCopyAddress(ctx: SessionContext): Promise<void> {
  try {
    const data = ctx.update.callback_query?.data || "";
    const investmentId = data.replace("copy_address_", "");

    const payment = await prisma.cryptoPayment.findUnique({
      where: { investmentId },
    });

    if (!payment || !payment.paymentAddress) {
      await ctx.answerCallbackQuery({
        text: "No wallet address available",
        show_alert: false,
      });
      return;
    }

    // In Telegram, we can't actually copy to clipboard, but we can show the address
    await ctx.answerCallbackQuery({
      text: `Address: ${payment.paymentAddress}`,
      show_alert: true,
    });
  } catch (error: any) {
    logger.error("Error in handleCopyAddress:", error);
    await ctx.answerCallbackQuery({ text: "Error copying address" });
  }
}

