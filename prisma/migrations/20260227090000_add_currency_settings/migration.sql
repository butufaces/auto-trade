-- Create CurrencySettings table
CREATE TABLE "CurrencySettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "cryptocurrency" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "blockchains" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create unique constraint: one setting per cryptocurrency per type
CREATE UNIQUE INDEX "CurrencySettings_type_cryptocurrency_key" ON "CurrencySettings"("type", "cryptocurrency");

-- Create indexes for efficient querying
CREATE INDEX "CurrencySettings_type_idx" ON "CurrencySettings"("type");
CREATE INDEX "CurrencySettings_isEnabled_idx" ON "CurrencySettings"("isEnabled");

-- Fix updatedAt column - remove DEFAULT for @updatedAt directive
ALTER TABLE "CurrencySettings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Insert default USDT settings (enabled for both deposit and withdrawal)
INSERT INTO "CurrencySettings" ("id", "type", "cryptocurrency", "isEnabled", "blockchains", "createdAt", "updatedAt") 
VALUES 
  ('cur_deposit_usdt', 'DEPOSIT', 'USDT', true, '["ethereum", "polygon", "bsc", "tron"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cur_withdrawal_usdt', 'WITHDRAWAL', 'USDT', true, '["ethereum", "polygon", "bsc", "tron"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
