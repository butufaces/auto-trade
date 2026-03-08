-- Update WithdrawalRequest table to support crypto withdrawals with NOWPayments integration

-- Add new columns for crypto wallet details
ALTER TABLE "WithdrawalRequest" ADD COLUMN "walletId" TEXT;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "walletAddress" TEXT;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "cryptocurrency" TEXT;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "blockchain" TEXT;

-- Add NOWPayments integration columns
ALTER TABLE "WithdrawalRequest" ADD COLUMN "nowpaymentsPaymentId" TEXT;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "paymentStatus" TEXT;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "paymentUrl" TEXT;

-- Add admin approval tracking
ALTER TABLE "WithdrawalRequest" ADD COLUMN "approvedBy" TEXT;

-- Update status column to reflect new flow (PENDING, PROCESSING, COMPLETED, REJECTED)
-- Note: existing data remains unchanged, new records will use PROCESSING instead of APPROVED

-- Create indices for NOWPayments payment lookup
CREATE INDEX "WithdrawalRequest_nowpaymentsPaymentId_idx" ON "WithdrawalRequest"("nowpaymentsPaymentId");
CREATE INDEX "WithdrawalRequest_paymentStatus_idx" ON "WithdrawalRequest"("paymentStatus");
