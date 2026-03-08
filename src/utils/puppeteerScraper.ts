import axios, { AxiosInstance } from "axios";
import logger from "../config/logger.js";

/**
 * Extract the final URL after page redirects using axios
 * @param startUrl The initial URL to visit
 * @param timeoutMs Maximum time to wait for response (default: 15000ms)
 * @returns The final URL after all redirects, or null if failed
 */
export async function extractFinalUrl(
  startUrl: string,
  timeoutMs: number = 15000
): Promise<string | null> {
  try {
    logger.info(`[URL_EXTRACTOR] Starting to extract final URL from: ${startUrl}`);

    // Axios automatically follows redirects by default (maxRedirects: 5)
    const response = await axios.get(startUrl, {
      timeout: timeoutMs,
      maxRedirects: 10,
      validateStatus: () => true, // Accept all status codes
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    // Get the final URL after all redirects
    const finalUrl = response.request.res.responseUrl || response.config.url;

    logger.info(`[URL_EXTRACTOR] Final URL extracted successfully:`, {
      startUrl,
      finalUrl,
      statusCode: response.status,
    });

    return finalUrl || startUrl;
  } catch (error: any) {
    logger.error(`[URL_EXTRACTOR] Failed to extract final URL:`, {
      startUrl,
      error: error instanceof Error ? error.message : String(error),
      code: error.code,
    });

    return null;
  }
}

/**
 * Extract final URL in background (non-blocking)
 * Logs results but doesn't wait for completion
 */
export function extractFinalUrlBackground(
  startUrl: string,
  onSuccess: (finalUrl: string) => Promise<void>,
  onError?: (error: Error) => Promise<void>
): void {
  // Fire and forget - don't await
  extractFinalUrl(startUrl)
    .then(async (finalUrl) => {
      if (finalUrl) {
        try {
          await onSuccess(finalUrl);
        } catch (err) {
          logger.error(`[URL_EXTRACTOR] Error calling onSuccess callback:`, err);
        }
      } else {
        const error = new Error(
          `Failed to extract final URL from ${startUrl}`
        );
        if (onError) {
          try {
            await onError(error);
          } catch (err) {
            logger.error(
              `[URL_EXTRACTOR] Error calling onError callback:`,
              err
            );
          }
        } else {
          logger.warn(`[URL_EXTRACTOR] Final URL extraction returned null`, {
            startUrl,
          });
        }
      }
    })
    .catch(async (err) => {
      logger.error(`[URL_EXTRACTOR] Unhandled error in background task:`, err);
      if (onError) {
        try {
          await onError(err);
        } catch (cbErr) {
          logger.error(
            `[URL_EXTRACTOR] Error calling onError callback:`,
            cbErr
          );
        }
      }
    });
}

