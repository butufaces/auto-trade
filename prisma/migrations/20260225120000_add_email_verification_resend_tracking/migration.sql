-- Add email verification resend tracking fields
ALTER TABLE "User" ADD COLUMN "lastResendAttempt" TIMESTAMP,
ADD COLUMN "resendAttempts" INTEGER NOT NULL DEFAULT 0;
