-- CreateTable "CryptoPayment"
CREATE TABLE "CryptoPayment" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "nowpaymentsPaymentId" TEXT,
    "userId" TEXT NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "cryptocurrency" TEXT NOT NULL,
    "amountCrypto" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentAddress" TEXT,
    "paymentUrl" TEXT,
    "paystatus" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CryptoPayment_investmentId_key" ON "CryptoPayment"("investmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoPayment_nowpaymentsPaymentId_key" ON "CryptoPayment"("nowpaymentsPaymentId");

-- CreateIndex
CREATE INDEX "CryptoPayment_investmentId_idx" ON "CryptoPayment"("investmentId");

-- CreateIndex
CREATE INDEX "CryptoPayment_userId_idx" ON "CryptoPayment"("userId");

-- CreateIndex
CREATE INDEX "CryptoPayment_nowpaymentsPaymentId_idx" ON "CryptoPayment"("nowpaymentsPaymentId");

-- CreateIndex
CREATE INDEX "CryptoPayment_status_idx" ON "CryptoPayment"("status");

-- CreateIndex
CREATE INDEX "CryptoPayment_expiresAt_idx" ON "CryptoPayment"("expiresAt");

-- CreateIndex
CREATE INDEX "CryptoPayment_createdAt_idx" ON "CryptoPayment"("createdAt");

-- AddForeignKey
ALTER TABLE "CryptoPayment" ADD CONSTRAINT "CryptoPayment_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoPayment" ADD CONSTRAINT "CryptoPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
