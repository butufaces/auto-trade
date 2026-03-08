# NowPayments 400 Error Debugging Guide

## Issue Summary
Getting a 400 Bad Request error when attempting to create crypto payments via the NowPayments API.

## Improvements Made

### 1. Enhanced Logging
- **Request Logging**: All API requests now log the method, URL, request body, and headers (with API key masked)
- **Response Logging**: All API responses are logged with status code, response body, and headers
- **Interceptors**: Added Axios interceptors to log every request and response automatically
- **Error Details**: Comprehensive error information including status, statusText, and response data

### 2. Request Validation
Before making the API call, the following is now validated:
- ✅ Investment ID exists
- ✅ Amount is positive and valid
- ✅ Investment status is PENDING
- ✅ API key is configured
- ✅ IPN secret is configured
- ✅ Default cryptocurrency is configured
- ✅ Default cryptocurrency is in the accepted list

### 3. Configuration Validation
New methods added to validate NowPayments configuration:
- `validateConfiguration()` - Returns validation status and all errors
- `logConfiguration()` - Logs current configuration for debugging

## Common Issues & Solutions

### 400 Error Causes

#### 1. **IP Not Whitelisted** ⚠️ MOST COMMON
**Issue**: NowPayments requires IP address whitelisting for API access
- **Solution**: 
  - Go to NowPayments dashboard → Settings → API Keys → Edit
  - Add your server's IP address to the whitelist
  - Allow 5-10 minutes for changes to propagate

#### 2. **Invalid Cryptocurrency Code**
**Check the logs**: Look for the exact cryptocurrency being sent
```
[NOWPAYMENTS] Creating payment
  cryptocurrency: "usdt"  // Should match NowPayments supported codes
```
**Solution**: Verify `DEFAULT_CRYPTOCURRENCY` in `.env` is a valid NowPayments code
- Supported: BTC, ETH, USDT, LTC, BNB, ADA, XRP, DOGE, TRX, AVAX, MATIC, SHIB, UNI, SOL, DOT, LINK

#### 3. **API Key Invalid or Expired**
**Check the logs**: Look for authentication issues
```
[NOWPAYMENTS] Response Error
  status: 401 or 403
```
**Solution**: 
- Regenerate API key in NowPayments dashboard
- Update `NOWPAYMENTS_API_KEY` in `.env`
- Test with: `curl -H "x-api-key: YOUR_KEY" https://api.nowpayments.io/v1/status`

#### 4. **Missing Required Fields**
**Check the logs**: Each request logs all fields being sent
```
[NOWPAYMENTS] Full request payload
  data: {
    price_amount: 100,
    price_currency: "usd",
    pay_currency: "usdt",
    order_id: "abc123",
    order_description: "Investment abc123",
    ipn_callback_url: "https://your-bot.ngrok.io/webhook/payment"
  }
```
**Solution**: All fields shown above must be present and valid

#### 5. **Webhook URL Not Accessible**
**Issue**: NowPayments can't reach the IPN callback URL
**Check**: 
- Is ngrok tunnel running? `ngrok http 3000`
- Is the tunnel URL in `.env`? `BOT_WEBHOOK_URL=https://xxx.ngrok-free.dev`
- Can you access the URL from browser?

#### 6. **Amount Too Low or Too High**
**Issue**: Investment amount outside NowPayments limits
**Solution**:
- Check minimum/maximum limits in NowPayments for the cryptocurrency
- Ensure investment amount is within range: 
  - Check `INVESTMENT_MIN_AMOUNT` and `INVESTMENT_MAX_AMOUNT` in `.env`

#### 7. **Timeout**
**Error**: Request times out (takes longer than 30 seconds)
**Solution**: 
- Check network connection to NowPayments API
- Increase timeout in `src/services/cryptoPayment.ts` (currently 30s)
- Check NowPayments status page

## How to Debug

### 1. Check Logs
The enhanced logging now captures everything. Look for:
```bash
# In your bot logs
[NOWPAYMENTS] Creating payment for investment
[NOWPAYMENTS] Full request payload
[NOWPAYMENTS] API Error Response
```

### 2. Enable Debug Mode
If using the logger, set `LOG_LEVEL=debug` in `.env` to see all details:
```env
LOG_LEVEL=debug
```

### 3. Manual API Test
Test the API directly to isolate issues:
```bash
curl -X POST https://api.nowpayments.io/v1/invoice \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "price_amount": 100,
    "price_currency": "usd",
    "pay_currency": "usdt",
    "order_id": "test-123",
    "order_description": "Test payment",
    "ipn_callback_url": "https://your-webhook.url"
  }'
```

### 4. Get NowPayments Status
Check NowPayments API status:
```bash
curl https://api.nowpayments.io/v1/status
```

### 5. Check Webhook URL
Verify webhook is accessible:
```bash
curl https://your-ngrok-url.ngrok-free.dev/webhook/payment
```

## Configuration Checklist

- [ ] `NOWPAYMENTS_API_KEY` is set in `.env`
- [ ] `NOWPAYMENTS_IPN_SECRET` is set in `.env`
- [ ] `DEFAULT_CRYPTOCURRENCY` is set and valid (e.g., `USDT`)
- [ ] `BOT_WEBHOOK_URL` points to your ngrok tunnel or public server
- [ ] Your IP is whitelisted at NowPayments
- [ ] ngrok tunnel is running (if using ngrok)
- [ ] Investment amount is valid (not too low/high)
- [ ] Investment status is `PENDING` before crypto payment

## Log Examples

### Successful Payment Creation
```
[NOWPAYMENTS] Creating payment for investment cmm21ntpd0001nnrj0w2yt1uh
{
  amountUsd: 500,
  cryptocurrency: "usdt",
  apiKeyConfigured: true,
  requestPayload: {
    price_amount: 500,
    price_currency: "usd",
    pay_currency: "usdt",
    order_id: "cmm21ntpd0001nnrj0w2yt1uh",
    order_description: "Investment cmm21ntpd0001nnrj0w2yt1uh",
    ipn_callback_url: "https://xxx.ngrok-free.dev/webhook/payment"
  }
}

[NOWPAYMENTS] Payment created successfully: 1234567890
{
  paymentId: 1234567890,
  investmentId: "cmm21ntpd0001nnrj0w2yt1uh",
  payAddress: "0x...",
  checkoutUrl: "https://pay.nowpayments.io/..."
}
```

### Failed Request (400 Error)
```
[NOWPAYMENTS] API Error Response (400)
{
  status: 400,
  statusText: "Bad Request",
  data: {
    code: 400,
    message: "Invalid request"  // Check API docs for specific message
  }
}
```

## Next Steps

1. **Check your IP address**: 
   ```bash
   curl ifconfig.me  # Get your IP
   ```

2. **Whitelist in NowPayments**:
   - Dashboard → Settings → API Keys → Edit
   - Add IP address to whitelist
   - Wait 5-10 minutes

3. **Test again** and check the enhanced logs

4. **If still failing**:
   - Look at the exact error message in the logs
   - Compare with the "Common Issues" section
   - Contact NowPayments support with the full error response

## Code Changes

### New Methods in `NowpaymentsService`
- `validateConfiguration()` - Validates API setup
- `logConfiguration()` - Logs current config for debugging

### Enhanced Logging in Handler
- Investment details before API call
- Configuration validation
- Detailed error information

### Axios Interceptors
- Request logging (method, URL, data)
- Response logging (status, data)
- Error logging with full response

## Support

If problems persist after checking these items:
1. Save the full error logs and error response
2. Contact NowPayments support with:
   - Full error response body
   - API key (obfuscated)
   - Investment details (ID, amount, crypto)
   - Your IP address
   - Timestamp of error

