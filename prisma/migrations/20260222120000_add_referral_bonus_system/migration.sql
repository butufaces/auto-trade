-- Add referral tracking to User model
ALTER TABLE "User" ADD COLUMN "referralEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Create ReferralBonus table
CREATE TABLE "ReferralBonus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referrerId" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL UNIQUE,
    "referredUserId" TEXT NOT NULL,
    "bonusAmount" DOUBLE PRECISION NOT NULL,
    "bonusPercentage" DOUBLE PRECISION NOT NULL,
    "investmentAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREDITED',
    "creditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralBonus_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "ReferralBonus_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment" ("id") ON DELETE CASCADE,
    CONSTRAINT "ReferralBonus_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User" ("id") ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX "ReferralBonus_referrerId_idx" ON "ReferralBonus"("referrerId");
CREATE INDEX "ReferralBonus_investmentId_idx" ON "ReferralBonus"("investmentId");
CREATE INDEX "ReferralBonus_status_idx" ON "ReferralBonus"("status");
CREATE INDEX "ReferralBonus_createdAt_idx" ON "ReferralBonus"("createdAt");
CREATE INDEX "ReferralBonus_creditedAt_idx" ON "ReferralBonus"("creditedAt");

-- Add referralBonus relation to Investment (optional - for easier querying)
ALTER TABLE "Investment" ADD COLUMN "referralBonusId" TEXT;
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_referralBonusId_fkey" FOREIGN KEY ("referralBonusId") REFERENCES "ReferralBonus" ("id") ON DELETE SET NULL;
