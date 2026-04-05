-- CreateEnum
CREATE TYPE "BonusStatus" AS ENUM ('PENDING', 'LOCKED', 'UNLOCKED', 'APPLIED', 'EXPIRED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "registrationBonusAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "registrationBonusStatus" "BonusStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "registrationBonusExpiryDate" TIMESTAMP(3),
ADD COLUMN "hasCompletedFirstTrade" BOOLEAN NOT NULL DEFAULT false;
