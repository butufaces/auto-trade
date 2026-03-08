-- Add Algorand (ALGO) to deposit and withdrawal currencies
INSERT INTO "CurrencySettings" ("id", "type", "cryptocurrency", "isEnabled", "blockchains", "createdAt", "updatedAt") 
VALUES 
  ('cur_deposit_algo', 'DEPOSIT', 'ALGO', true, '["algorand"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cur_withdrawal_algo', 'WITHDRAWAL', 'ALGO', true, '["algorand"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
