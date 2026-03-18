-- CreateTable PayoutProof
CREATE TABLE "PayoutProof" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "transactionLink" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "blockchain" TEXT NOT NULL,
    "cryptocurrency" TEXT NOT NULL DEFAULT 'USDT',
    "submittedBy" TEXT NOT NULL,
    "description" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "proofDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex PayoutProof
CREATE INDEX "PayoutProof_blockchain_idx" ON "PayoutProof"("blockchain");
CREATE INDEX "PayoutProof_createdAt_idx" ON "PayoutProof"("createdAt");
CREATE INDEX "PayoutProof_isVerified_idx" ON "PayoutProof"("isVerified");

-- CreateTable BotVisitor
CREATE TABLE "BotVisitor" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "firstVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisitedAt" TIMESTAMP(3) NOT NULL,
    "hasRegistered" BOOLEAN NOT NULL DEFAULT false,
    "registeredUserId" TEXT,

    CONSTRAINT "BotVisitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex BotVisitor
CREATE UNIQUE INDEX "BotVisitor_telegramId_key" ON "BotVisitor"("telegramId");
CREATE INDEX "BotVisitor_telegramId_idx" ON "BotVisitor"("telegramId");
CREATE INDEX "BotVisitor_hasRegistered_idx" ON "BotVisitor"("hasRegistered");
CREATE INDEX "BotVisitor_firstVisitedAt_idx" ON "BotVisitor"("firstVisitedAt");
