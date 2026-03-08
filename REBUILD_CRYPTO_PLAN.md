# Crypto Payment Rebuild Plan

## What We're Building
A **complete in-Telegram payment experience** using NOWPayments API, with NO external links.

## Features
1. ✅ Wallet address displayed in Telegram
2. ✅ QR code generated from wallet address
3. ✅ Exact amount to send (in crypto)
4. ✅ Countdown timer (15 minutes)
5. ✅ Auto-polling for payment status (updates every 10 seconds)
6. ✅ All messages stay in Telegram (no external links)

## Flow

```
User clicks "Pay via Crypto"
    ↓
Bot creates payment on NOWPayments
    ↓
Bot fetches payment details → Gets wallet address
    ↓
Bot creates message in Telegram:
    • "Please send X.XXX BTC"
    • Wallet address (copy button)
    • QR code
    • Countdown timer
    • "Check Status" button
    ↓
User sends crypto
    ↓
Bot auto-checks status every 10 seconds
    ↓
On payment received:
    • Update message with ✅ Payment Confirmed
    • Auto-activate investment
    • Remove check status button
```

## Implementation Steps

### 1. Clean Service Layer
- `createPayment()` - Create invoice on NOWPayments
- `getPaymentDetails()` - Fetch payment + wallet address
- `checkPaymentStatus()` - Check if payment arrived

### 2. Handler Layer
- `handleSelectCryptocurrency()` - Initiate payment creation
- `handlePaymentWidget()` - Display payment UI
- `handleCheckStatus()` - Auto-poll and update message
- `handleCancelPayment()` - Cancel investment

### 3. UI in Telegram
```
═══════════════════════════════════════
💰 BTC Payment - Send Crypto Now

Amount: $500 USD
Receive: 0.01234567 BTC

📬 SEND TO THIS ADDRESS:
3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy

⏱️ Time Remaining: 14:45

📸 [QR Code Image]

[✅ Check Status Button]
[❌ Cancel Button]
═══════════════════════════════════════
```

## Database Fields
- `investmentId` - Payment linked to investment
- `nowpaymentsPaymentId` - Payment ID from NOWPayments
- `paymentAddress` - Wallet address to send to
- `amountCrypto` - Amount in crypto
- `amountUsd` - Amount in USD
- `status` - PENDING, CONFIRMED, FAILED, EXPIRED
- `expiresAt` - Expires in 15 minutes
- `confirmedAt` - When payment confirmed

## Key Implementation Details

1. **Payment Creation:**
   ```
   Create invoice via /invoice endpoint
   Store: paymentId, amountUsd, crypto
   ```

2. **Get Wallet Address:**
   ```
   Fetch /payment/{paymentId}
   Extract: wallet address, amount in crypto
   Store in database
   ```

3. **Display in Telegram:**
   ```
   Send message with:
   - Wallet address
   - Amount to send
   - QR code
   - Timer countdown
   - Check status button
   ```

4. **Auto-Poll Status:**
   ```
   Every 10 seconds:
   - Check /payment/{paymentId}
   - If status = 'finished' → Mark CONFIRMED
   - Update message with ✅
   - Stop polling
   ```

## API Endpoints Used
- `POST /invoice` - Create payment
- `GET /payment/{id}` - Get payment details (includes wallet)
- `GET /v1/currencies` - Get supported cryptocurrencies
- `POST /v1/estimate` - Get conversion rates

## What Changes From Current
- ❌ Remove external payment links
- ✅ Show wallet address in Telegram
- ✅ Generate QR codes for easy scanning
- ✅ Auto-update status without clicking
- ✅ Countdown timer that updates in place
- ✅ Everything happens in Telegram
