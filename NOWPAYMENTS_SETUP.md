# Nowpayments Crypto Payment Setup Guide

## Step 1: Create Nowpayments Merchant Account

1. Visit: **https://nowpayments.io**
2. Click **"Sign Up"** button
3. Enter your email and password
4. Verify email address
5. Complete KYC (Business information)
6. Account activated!

## Step 2: Get API Credentials

1. Log into Nowpayments dashboard
2. Go to **Settings → API Keys**
3. Click **"Generate API Key"**
4. Copy the API Key (keep it safe!)
5. Find your **IPN Secret** in settings

## Step 3: Configure Webhook

1. In Nowpayments dashboard → **Settings → IPN**
2. Add webhook URL: `https://yourdomain.com/webhook/payment`
3. Select events: **"Payment confirmed"**, **"Payment failed"**, **"Payment expired"**
4. Save changes

⚠️ **Important:** Replace `yourdomain.com` with your actual bot's webhook URL (use ngrok for testing)

## Step 4: Update .env File

```env
# Nowpayments Crypto Gateway
NOWPAYMENTS_API_KEY=your_api_key_here
NOWPAYMENTS_IPN_SECRET=your_ipn_secret_here
PAYMENT_TIMEOUT_MINUTES=15
ACCEPTED_CRYPTOCURRENCIES=BTC,ETH,USDT,LTC
DEFAULT_CRYPTOCURRENCY=USDT
```

**Recommended currencies:**
- **USDT** (Tether - USD Stablecoin) ⭐ **Best for stability**
- BTC (Bitcoin) 
- ETH (Ethereum)
- LTC (Litecoin)

## Step 5: Database Migration

```bash
# Apply the new CryptoPayment table
npm run prisma:push

# Or if using migrations:
npm run prisma:migrate deploy
```

## Step 6: Restart Bot

```bash
npm run dev    # Development
npm start      # Production
```

## Testing with Sandbox

Nowpayments doesn't have a sandbox, but you can test with:
- Small amounts
- Test transactions
- Testnet cryptocurrencies

**Or simulate locally:**

```bash
# Send test webhook from terminal
curl -X POST http://localhost:3000/webhook/payment \
  -H "Content-Type: application/json" \
  -H "x-nowpayments-sig: test_signature" \
  -d '{
    "payment_id": 12345,
    "payment_status": "finished",
    "order_id": "investment_id",
    "pay_amount": 10,
    "pay_currency": "USDT"
  }'
```

## Supported Payment Methods by User

Users can pay using:
- **Wallets:** MetaMask, Trust Wallet, Coinbase Wallet, etc.
- **Exchanges:** Binance, Kraken, Coinbase, etc.
- **Direct:** Using wallet apps/hardware wallets

## Payment Process for Users

1. User confirms investment → Crypto payment screen
2. User sees:
   - Payment link (clickable button)
   - Wallet address (copyable)
   - QR code
   - Countdown timer (15 minutes)
3. User sends exactly the crypto amount shown
4. Nowpayments receives payment
5. **Automatic activation** when confirmed

## Monitoring Payments

### In production:
```bash
# View logs
pm2 logs invest-bot

# Check database
psql -U postgres -d investbot
SELECT * FROM "CryptoPayment" WHERE status = 'PENDING';
```

### Check payment status:
```bash
curl -X GET "https://api.nowpayments.io/v1/payment/12345" \
  -H "x-api-key: YOUR_API_KEY"
```

## Troubleshooting

### Error: "API key not configured"
- [ ] Check `.env` file has `NOWPAYMENTS_API_KEY`
- [ ] Restart bot after updating `.env`

### Error: "Webhook signature verification failed"
- [ ] Verify `NOWPAYMENTS_IPN_SECRET` is correct
- [ ] Check `.env` file
- [ ] Restart bot

### Payments not confirming
- [ ] Check Nowpayments IPN settings
- [ ] Verify webhook URL is publicly accessible
- [ ] Check bot logs for webhook errors
- [ ] Test webhook manually (see Testing section)

### "Payment gateway not loading"
- [ ] Verify `BOT_WEBHOOK_URL` is correct
- [ ] Check internet connection
- [ ] Verify API key is active
- [ ] Check Nowpayments status page

### Expired payments issue
- [ ] Scheduler runs every 60 seconds
- [ ] Verify `PAYMENT_TIMEOUT_MINUTES=15`
- [ ] Check database datetime is correct

## Fee Structure (Reference)

Nowpayments charges:
- **Transaction fee:** 0.5% - 2% (varies by crypto)
- **Withdrawal:** Network fees only
- **No monthly fees**

## Support

**Nowpayments Support:** https://support.nowpayments.io
**API Documentation:** https://documenter.getpostman.com/view/7907941/S1a32RSP

## Security Best Practices

✅ Keep `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET` secret
✅ Use HTTPS for webhook URLs
✅ Verify IPN signatures on every webhook
✅ Rotate API keys periodically
✅ Monitor payment logs regularly
✅ Set up alerts for failed payments

## Going Live Checklist

- [ ] Nowpayments merchant account active
- [ ] API keys obtained and configured
- [ ] Webhook URL set in Nowpayments
- [ ] `.env` file updated with credentials
- [ ] Database migration applied
- [ ] Bot restarted
- [ ] Test payment completed successfully
- [ ] User notifications working
- [ ] Admin notifications working
- [ ] Scheduler task monitoring payments
- [ ] Error logging configured
- [ ] Monitoring/alerts set up

**You're ready to accept crypto payments!**
