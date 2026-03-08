import axios from 'axios';

(async () => {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    console.error('NOWPAYMENTS_API_KEY not set');
    process.exit(1);
  }

  const api = axios.create({
    baseURL: 'https://api.nowpayments.io/v1',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    timeout: 30000,
  });

  try {
    const payload = {
      price_amount: 5,
      price_currency: 'usd',
      // Trying alphanumeric-only pay_currency (NowPayments requires alpha-numeric)
      pay_currency: 'usdttrc20',
      order_id: `TEST-${Date.now()}`,
      order_description: 'Test invoice for USDT TRC20',
      ipn_callback_url: 'https://example.com/ipn',
    };

    const response = await api.post('/invoice', payload);
    console.log('Invoice response:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error('Error creating invoice:');
    console.error(err.response?.data || err.message);
    process.exit(1);
  }
})();
