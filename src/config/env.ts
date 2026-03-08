import { z } from "zod";

const envSchema = z.object({
  // Bot
  BOT_TOKEN: z.string().min(1),
  BOT_WEBHOOK_URL: z.string().optional(),
  BOT_WEBHOOK_PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Database
  DATABASE_URL: z.string().min(1),

  // Admin
  ADMIN_IDS: z.string().default(""),
  ADMIN_CHAT_ID: z.coerce.bigint().optional(),

  // Support
  SUPPORT_CHAT_ID: z.coerce.bigint().optional(),
  SUPPORT_USERNAME: z.string().optional(),

  // Email Configuration (Brevo API)
  BREVO_API_KEY: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().optional(),
  SMTP_FROM_NAME: z.string().default("Investment Bot"),
  EMAIL_VERIFICATION_TOKEN_EXPIRY_MINUTES: z.coerce.number().default(30),

  // Packages
  PACKAGES: z.string().default(""),

  // Investment Settings
  INVESTMENT_MIN_AMOUNT: z.coerce.number().default(100),
  INVESTMENT_MAX_AMOUNT: z.coerce.number().default(50000),
  AUTO_MATURITY_CHECK_INTERVAL_HOURS: z.coerce.number().default(24),
  ENABLE_AUTO_ROI_DISTRIBUTION: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  ROI_DISTRIBUTION_DAY_OF_MONTH: z.coerce.number().default(1),

  // User Settings
  ENABLE_USER_REVIEWS: z.enum(["true", "false"]).default("true"),
  ENABLE_USER_KYC: z.enum(["true", "false"]).default("false"),
  MIN_USERNAME_LENGTH: z.coerce.number().default(3),

  // Announcements
  ANNOUNCEMENT_ENABLED: z.enum(["true", "false"]).default("true"),
  BATCH_ANNOUNCEMENT_SIZE: z.coerce.number().default(50),
  ANNOUNCEMENT_BATCH_DELAY_MS: z.coerce.number().default(100),

  // Withdrawal
  ENABLE_WITHDRAWAL: z.enum(["true", "false"]).default("true"),
  MIN_WITHDRAWAL_AMOUNT: z.coerce.number().default(50),
  MAX_WITHDRAWAL_AMOUNT: z.coerce.number().default(50000),
  WITHDRAWAL_APPROVAL_REQUIRED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  WITHDRAWAL_PROCESS_TIMEOUT_HOURS: z.coerce.number().default(48),
  WITHDRAWAL_EMAIL_VERIFICATION_REQUIRED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  WITHDRAWAL_VERIFICATION_TOKEN_EXPIRY_MINUTES: z.coerce.number().default(10),

  // Currency & Localization
  CURRENCY_SYMBOL: z.string().default("$"),
  CURRENCY_CODE: z.string().default("USD"),
  TIMEZONE: z.string().default("UTC"),
  DATE_FORMAT: z.string().default("dd/MM/yyyy"),

  // Logging
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "debug"])
    .default("info"),
  LOG_DIR: z.string().default("./logs"),
  LOG_MAX_SIZE: z.string().default("10m"),
  LOG_MAX_FILES: z.coerce.number().default(14),

  // Limits
  USER_SESSION_TIMEOUT_MINUTES: z.coerce.number().default(30),
  MAX_INVESTMENTS_PER_USER: z.coerce.number().default(10),
  API_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().default(1),
  API_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Notifications
  NOTIFY_USER_ON_INVESTMENT_APPROVAL: z
    .enum(["true", "false"])
    .default("true"),
  NOTIFY_USER_ON_MATURITY: z.enum(["true", "false"]).default("true"),
  NOTIFY_USER_ON_WITHDRAWAL_STATUS: z
    .enum(["true", "false"])
    .default("true"),
  NOTIFY_ADMIN_ON_NEW_INVESTMENT: z
    .enum(["true", "false"])
    .default("true"),
  NOTIFY_ADMIN_ON_WITHDRAWAL_REQUEST: z
    .enum(["true", "false"])
    .default("true"),

  // Features
  FEATURE_REFERRAL_PROGRAM: z.enum(["true", "false"]).default("false"),
  FEATURE_LEADERBOARD: z.enum(["true", "false"]).default("false"),
  FEATURE_AUTO_REINVESTMENT: z.enum(["true", "false"]).default("false"),
  ENABLE_MAINTENANCE_MODE: z.enum(["true", "false"]).default("false"),
  MAINTENANCE_MESSAGE: z
    .string()
    .default("Bot is under maintenance. Please try again later."),

  // Platform Information
  PLATFORM_NAME: z.string().default("Investment Bot"),
  PLATFORM_ABOUT: z.string().default("Welcome to our investment platform!"),
  PLATFORM_WEBSITE: z.string().optional(),
  PLATFORM_SUPPORT_EMAIL: z.string().optional(),
  PLATFORM_MISSION: z.string().optional(),
  PLATFORM_VISION: z.string().optional(),
  PLATFORM_TERMS_URL: z.string().optional(),
  PLATFORM_PRIVACY_URL: z.string().optional(),

  // Referral Settings
  ENABLE_REFERRAL_BONUS: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  REFERRAL_BONUS_PERCENTAGE: z.coerce.number().default(5),
  MINIMUM_REFERRAL_PAYOUT: z.coerce.number().default(1000),

  // Daily Accrual Settings
  DAILY_PROFIT_REINVEST_PERCENTAGE: z.coerce.number().default(80),
  DAILY_PROFIT_WITHDRAWABLE_PERCENTAGE: z.coerce.number().default(20),
  AUTO_DAILY_ACCRUAL_ENABLED: z.enum(["true", "false"]).default("true"),
  AUTO_DAILY_ACCRUAL_TIME: z.string().default("00:00"),

  // NOWPayments Crypto Gateway
  NOWPAYMENTS_API_KEY: z.string().optional(),
  NOWPAYMENTS_IPN_SECRET: z.string().optional(),
  PAYMENT_TIMEOUT_MINUTES: z.coerce.number().default(15),
  ACCEPTED_CRYPTOCURRENCIES: z.string().default("BTC,ETH,USDT,LTC"),
  DEFAULT_CRYPTOCURRENCY: z.string().default("USDT"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const env = process.env;
  const result = envSchema.safeParse(env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    result.error.errors.forEach((error) => {
      console.error(`  ${error.path.join(".")}: ${error.message}`);
    });
    process.exit(1);
  }

  return result.data;
}

export const config = validateEnv();
