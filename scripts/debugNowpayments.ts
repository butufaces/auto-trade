import nowpaymentsService from '../src/services/cryptoPayment.js';

(async () => {
  try {
    const amount = 5; // USD
    const crypto = 'USDT';
    console.log('Running debugApiResponse for', amount, crypto);
    const res = await nowpaymentsService.debugApiResponse(amount, crypto);
    console.log('Result:', JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
