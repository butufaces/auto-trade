/*
  Warnings:

  - You are about to drop the column `referralBonusId` on the `Investment` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Investment" DROP CONSTRAINT "Investment_referralBonusId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralBonus" DROP CONSTRAINT "ReferralBonus_investmentId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralBonus" DROP CONSTRAINT "ReferralBonus_referredUserId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralBonus" DROP CONSTRAINT "ReferralBonus_referrerId_fkey";

-- AlterTable
ALTER TABLE "Investment" DROP COLUMN "referralBonusId";

-- AddForeignKey
ALTER TABLE "ReferralBonus" ADD CONSTRAINT "ReferralBonus_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralBonus" ADD CONSTRAINT "ReferralBonus_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralBonus" ADD CONSTRAINT "ReferralBonus_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
