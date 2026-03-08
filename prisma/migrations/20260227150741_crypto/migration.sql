-- DropIndex
DROP INDEX "WithdrawalRequest_nowpaymentsPaymentId_idx";

-- AlterTable
ALTER TABLE "CryptoPayment" ADD COLUMN     "blockchain" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "lastResendAttempt" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cryptocurrency" TEXT NOT NULL,
    "blockchain" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_cryptocurrency_idx" ON "Wallet"("cryptocurrency");

-- CreateIndex
CREATE INDEX "Wallet_blockchain_idx" ON "Wallet"("blockchain");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_walletAddress_cryptocurrency_blockchain_key" ON "Wallet"("userId", "walletAddress", "cryptocurrency", "blockchain");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
