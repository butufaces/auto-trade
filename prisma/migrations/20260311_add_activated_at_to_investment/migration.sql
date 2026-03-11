-- Add activatedAt column to Investment table
ALTER TABLE "Investment" ADD COLUMN "activatedAt" TIMESTAMP(3);

-- Create index on activatedAt for faster queries
CREATE INDEX "Investment_activatedAt_idx" ON "Investment"("activatedAt");
