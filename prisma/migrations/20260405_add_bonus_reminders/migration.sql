-- Add bonus reminder field to User
ALTER TABLE "User" ADD COLUMN "lastBonusReminderSentAt" TIMESTAMP(3);

-- Add bonus reminder settings (if they don't exist, they'll be inserted by application code)
-- These are informational comments about what settings will be used:
-- BONUS_REMINDER_ENABLED: true/false
-- BONUS_REMINDER_FREQUENCY_HOURS: integer (default 6)
-- BONUS_REMINDER_MESSAGE: text with variables like {daysLeft}, {bonusAmount}
