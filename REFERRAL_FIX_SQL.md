# REFERRAL BONUS FIX - SQL INSTRUCTIONS

## Problem Identified
- Akanji was NOT registered with referral code
- So `referredBy` field is NULL
- When investment becomes ACTIVE, creditReferralBonus() returns early (no referredBy = no bonus)
- Result: $0.00 earnings despite 1 active referral

## SOLUTION - Execute in order:

### Step 1: Find the IDs (UPDATE THESE BASED ON YOUR DATA)
```sql
-- Get referrer ID (bitcoinbiz247@gmail.com user)
SELECT id, referralCode, referralEarnings 
FROM "User" 
WHERE referralCode LIKE 'REF_7227777071%';
-- → Copy the referrer ID from results

-- Get Akanji's ID and investment
SELECT u.id, u.firstName, u.referredBy, i.id as investmentId, i.amount, i.status
FROM "User" u
LEFT JOIN "Investment" i ON u.id = i.userId
WHERE u.firstName = 'Akanji'
ORDER BY i.createdAt DESC;
-- → Copy Akanji's user ID and investment ID(s)
```

### Step 2: Set Akanji's referredBy field
```sql
-- Replace AKANJI_ID with actual ID from Step 1
-- Replace REF_7227777071_MMHORAD8 with exact referrer code
UPDATE "User"
SET "referredBy" = 'REF_7227777071_MMHORAD8'
WHERE id = 'AKANJI_ID';

-- Verify it was set
SELECT id, firstName, referredBy FROM "User" WHERE firstName = 'Akanji';
```

### Step 3: Check if bonus records already exist
```sql
-- Replace INVESTMENT_ID with actual ID from Step 1
SELECT * FROM "ReferralBonus" WHERE "investmentId" = 'INVESTMENT_ID';
-- If results are empty, proceed to Step 4
```

### Step 4: Create ReferralBonus record (ONLY if Step 3 returned nothing)
```sql
-- Get the exact IDs first
WITH referrer_data AS (
  SELECT id as referrerId, referralCode
  FROM "User" 
  WHERE referralCode LIKE 'REF_7227777071%'
)
INSERT INTO "ReferralBonus" (
  id,
  "referrerId",
  "investmentId",
  "referredUserId",
  "bonusAmount",
  "bonusPercentage",
  "investmentAmount",
  status,
  "creditedAt",
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid(),
  (SELECT "referrerId" FROM referrer_data),
  'INVESTMENT_ID',
  'AKANJI_ID',
  220.00,  -- 10% of $2200
  10,
  2200.00,
  'CREDITED',
  NOW(),
  NOW(),
  NOW()
);
```

### Step 5: Update referrer's earnings
```sql
-- Replace REFERRER_ID with actual ID from Step 1
UPDATE "User"
SET 
  "referralEarnings" = "referralEarnings" + 220.00,
  "totalEarned" = "totalEarned" + 220.00,
  "updatedAt" = NOW()
WHERE id = 'REFERRER_ID';

-- Verify the update
SELECT id, firstName, referralEarnings, totalEarned 
FROM "User" 
WHERE id = 'REFERRER_ID';
```

### Step 6: Verify in App
- Refresh the referral stats in Telegram
- Should now show: Total Referral Earnings: $220.00

---

## If You Have Multiple Referred Investments

Repeat Steps 3-5 for each investment:
- For each ACTIVE investment from referred users
- Calculate bonus: amount × 10% = bonus amount
- Create ReferralBonus record
- Update referrer earnings

---

## IMPORTANT: For Future Referrals

To prevent this issue again:
1. **Make sure users enter referral code during signup**
2. **Require referral code in registration flow (not optional)**
3. **Test with a real referral before deploying**

The logging changes I added will help catch this next time in the logs.
