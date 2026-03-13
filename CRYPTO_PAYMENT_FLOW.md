# Crypto Payment Flow Implementation

## Overview
Users now pay for investments using cryptocurrencies via Nowpayments gateway instead of bank transfers.

## New Payment Flow

```
1. User confirms investment
   👇
2. Investment created (status: PENDING)
   👇
3. Crypto payment initiation screen shown
   👇
4. User clicks "Proceed to Crypto Payment"
   👇
5. Nowpayments payment created
   - CryptoPayment record stored in DB
   - 15-minute countdown timer starts
   👇
6. Payment widget displayed
   - Payment link provided
   - QR code shown
   - Wallet address displayed
   👇
7. User sends crypto
   👇
8. Nowpayments webhook received
   👇
9. Payment status updated
   👇
10a. CONFIRMED → Investment auto-activ ates
    - User notifications sent
    - Admin notifications sent
    👇
10b. FAILED/EXPIRED → Investment cancelled
    - User notified with retry option
    - Countdown expired? → Auto-cancelled & notified
```

## Database Schema

### CryptoPayment Table
```sql
- id (PK)
- investmentId (FK, Unique) → Links to Investment
- userId (FK) → Links to User
- nowpaymentsPaymentId (Unique) → Nowpayments payment ID
- amountUsd → Investment amount in USD
- cryptocurrency → BTC, ETH, USDT, LTC
- amountCrypto → Amount in crypto (string for precision)
- status → PENDING, PROCESSING, CONFIRMED, FAILED, EXPIRED, CANCELLED
- paymentAddress → Wallet address for payment
- paymentUrl → Nowpayments checkout link
- paystatus → Status from Nowpayments API
- expiresAt → When payment expires (15 minutes)
- confirmedAt → When payment was confirmed
- failedAt → When payment failed/expired
- retryCount → Number of retry attempts
- indexes: investmentId, userId, nowpaymentsPaymentId, status, expiresAt
```

## Environment Variables Required

```env
# Nowpayments Crypto Gateway
NOWPAYMENTS_API_KEY=your_api_key_here
NOWPAYMENTS_IPN_SECRET=your_ipn_secret_here
PAYMENT_TIMEOUT_MINUTES=15
ACCEPTED_CRYPTOCURRENCIES=BTC,ETH,USDT,LTC
DEFAULT_CRYPTOCURRENCY=USDT
```

## Get Nowpayments API Keys

1. Go to: https://nowpayments.io
2. Sign up for merchant account
3. Navigate to Settings → API
4. Copy:
   - API Key
   - IPN Secret
5. Configure webhook URL (bot's webhook URL + /webhook/payment)
6. Supported currencies: 300+
7. USDT (Tether) recommended for stability

## Key Components

### 1. CryptoPayment Service (`src/services/cryptoPayment.ts`)
- Create payment via Nowpayments API
- Verify IPN signatures
- Update payment status
- Get supported cryptocurrencies
- Database operations

**Key Methods:**
- `createPayment()` - Initiate crypto payment
- `getPaymentStatus()` - Check payment status
- `verifyIpnSignature()` - Verify webhook authenticity
- `saveCryptoPayment()` - Store payment in DB
- `updatePaymentStatus()` - Update after webhook

### 2. Crypto Payment Handler (`src/handlers/cryptoPayment.ts`)
- `handleInitiateCryptoPayment()` - Show payment widget
- `handleCheckPaymentStatus()` - Check payment status
- `handleCancelCryptoPayment()` - Cancel investment
- `handleCopyAddress()` - Copy wallet address

### 3. Payment Webhook Handler (`src/handlers/paymentWebhook.ts`)
- `handlePaymentWebhook()` - Process Nowpayments webhook
- Maps Nowpayments status to internal status
- Auto-activates investments on success
- Sends notifications to users/admins

### 4. Scheduler (`src/tasks/scheduler.ts`)
- `checkExpiredPayments()` - Runs every minute
- Finds pending payments past expiry time
- Cancels investments
- Notifies users with retry prompt

## Payment Status Flow

```
PENDING (waiting for payment)
  ↓
  ├─ [Payment sent] → CONFIRMED
  │                     ↓
  │              Investment AUTO-ACTIVE
  │              User + Admin notified ✅
  │
  ├─ [15 min expired] → EXPIRED
  │                        ↓
  │                 Trade REJECTED
  │                 User notified (retry) ❌
  │
  └─ [Nowpayments failure] → FAILED
                                 ↓
                          Trade REJECTED
                          User notified ❌
```

## Integration Points

### 1. User Investment Confirmation
**File:** `src/handlers/user.ts::handleConfirmInvestment()`
- Before: Showed bank details for manual payment
- Now: Shows crypto payment initiation screen
- User clicks "Proceed to Crypto Payment"

### 2. Callback Routing
**File:** `src/index.ts` - Callback handlers added:
- `initiate_crypto_` → `handleInitiateCryptoPayment()`
- `check_payment_status_` → `handleCheckPaymentStatus()`
- `cancel_investment_` → `handleCancelCryptoPayment()`
- `copy_address_` → `handleCopyAddress()`
- `retry_crypto_payment_` → Retry payment

### 3. Webhook Endpoint
**File:** `src/index.ts` - New webhook handler for `/webhook/payment`
- Receives Nowpayments IPN notifications
- Verifies signatures
- Updates payment/investment status
- Sends user notifications

## Notification Flow

### On Payment Confirmed:
1. **User gets:**
   - ✅ Payment Confirmed message
   - Investment details
   - Maturity date
   - "Your investment is now ACTIVE"

2. **Admin gets:**
   - ✅ Payment Confirmed notification
   - User details
   - Investment ID
   - "Investment auto-activated"

### On Payment Failed/Expired:
1. **User gets:**
   - ❌ Payment Failed message
   - Reason (expired or failed)
   - Retry button
   - Cancel button

2. **System:**
   - Investment marked REJECTED
   - Payment marked FAILED/EXPIRED
   - Auto-cleanup after 30 days

## Testing Checklist

- [ ] Nowpayments API credentials configured in .env
- [ ] Migration applied: `npm run prisma:push`
- [ ] Database schema includes CryptoPayment table
- [ ] User can confirm investment
- [ ] Crypto payment screen appears
- [ ] Payment widget loads
- [ ] Wallet address displayed
- [ ] Payment link clickable
- [ ] Copy address button works
- [ ] Check status shows countdown
- [ ] Cancel button cancels investment
- [ ] Webhook endpoint accessible
- [ ] Fake payment test → Investment activates
- [ ] Expired payment test → Investment cancelled
- [ ] Notifications sent on success/failure
- [ ] Scheduler runs every minute
- [ ] Old payments cleaned up

## Troubleshooting

### Payment gateway not loading
- Verify `NOWPAYMENTS_API_KEY` is set
- Check webhook URL is publicly accessible
- Verify `BOT_WEBHOOK_URL` is correct

### Webhook not receiving notifications
- Ensure webhook URL is public (not localhost)
- Verify `NOWPAYMENTS_IPN_SECRET` is correct
- Check Nowpayments settings has webhook configured

### Investment not auto-activating
- Check webhook logs for errors
- Verify IPN signature verification passes
- Check database for CryptoPayment record

### Expired payments not cancelling
- Scheduler runs every minute
- Check `PAYMENT_TIMEOUT_MINUTES` setting
- Verify database datetime fields

## Security Considerations

✅ IPN signature verification
✅ Database encryption for amounts
✅ Rate limiting on payment endpoints
✅ Timeout protection (15 min)
✅ Webhook URL validation
✅ Transaction atomicity

## Future Enhancements

- Multiple cryptocurrency support UI selector
- Payment history export
- Partial payment handling
- Refund processing
- Payment analytics dashboard
- QR code rendering
- Mobile wallet deep linking
