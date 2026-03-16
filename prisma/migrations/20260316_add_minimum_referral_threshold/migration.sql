-- Insert default minimum referral withdrawal threshold setting
INSERT INTO "Settings" (id, key, value, type, description, "updatedAt", "updatedBy") 
VALUES (
  'default_min_referral_threshold',
  'MINIMUM_REFERRAL_WITHDRAWAL_AMOUNT',
  '100',
  'number',
  'Minimum referral bonus amount required to initiate withdrawal (in dollars)',
  NOW(),
  'system'
)
ON CONFLICT (key) DO NOTHING;
