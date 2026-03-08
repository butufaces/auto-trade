-- CreateEnum
CREATE TYPE "PaymentProofStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- AlterEnum
ALTER TYPE "InvestmentStatus" ADD VALUE 'AWAITING_PAYMENT';

-- AlterTable
ALTER TABLE "Investment" ADD COLUMN     "paymentProofFileId" TEXT,
ADD COLUMN     "paymentProofStatus" "PaymentProofStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "paymentProofUrl" TEXT,
ADD COLUMN     "paymentVerificationNotes" TEXT,
ADD COLUMN     "paymentVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PaymentAccount" (
    "id" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "instructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentAccount_isActive_idx" ON "PaymentAccount"("isActive");

-- CreateIndex
CREATE INDEX "PaymentAccount_createdAt_idx" ON "PaymentAccount"("createdAt");

-- CreateIndex
CREATE INDEX "Investment_paymentProofStatus_idx" ON "Investment"("paymentProofStatus");
