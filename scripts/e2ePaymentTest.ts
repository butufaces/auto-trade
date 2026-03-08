import prisma from '../src/db/client.js';
import nowpaymentsService from '../src/services/cryptoPayment.js';
import { config } from '../src/config/env.js';

async function main() {
  console.log('Starting E2E payment test using', config.DATABASE_URL);

  // Create or get a test package
  const pkg = await prisma.package.upsert({
    where: { name: 'E2E Test Package' },
    update: {},
    create: {
      name: 'E2E Test Package',
      minAmount: 1,
      maxAmount: 100000,
      duration: 30,
      durationType: 'FIXED',
      roiPercentage: 10,
      riskLevel: 'MEDIUM',
    } as any,
  });

  // Create or get a test user
  const user = await prisma.user.upsert({
    where: { telegramId: BigInt(999999999) },
    update: {},
    create: {
      telegramId: BigInt(999999999),
      username: 'e2e_test_user',
      firstName: 'E2E',
    } as any,
  });

  // Create an investment
  const amountUsd = 5; // small test amount
  const investment = await prisma.investment.create({
    data: {
      userId: user.id,
      packageId: pkg.id,
      amount: amountUsd,
      roiPercentage: 10,
      expectedReturn: amountUsd * 1.1,
      status: 'AWAITING_PAYMENT',
      maturityDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    } as any,
  });

  console.log('Created investment:', investment.id);

  // Call NowPayments createPayment
  const webhookUrl = `${config.BOT_WEBHOOK_URL || 'https://example.com'}/webhook/payment`;
  console.log('Calling NowPayments createPayment...');

  try {
    const payment = await nowpaymentsService.createPayment(
      investment.id,
      user.id,
      amountUsd,
      'USDT',
      webhookUrl,
      'tron'
    );

    console.log('Payment API response:', payment);

    // Save crypto payment (simulate handler save)
    const nowpaymentsId = String(payment.payment_id ?? payment.id ?? payment.token_id ?? '');
    const amountCrypto = (payment.pay_amount ?? payment.amount ?? amountUsd).toString();
    const payAddress = payment.pay_address ?? payment.address ?? null;
    const checkoutUrl = payment.checkout_url ?? payment.invoice_url ?? null;

    const cryptoPayment = await prisma.cryptoPayment.upsert({
      where: { investmentId: investment.id },
      create: {
        investmentId: investment.id,
        userId: user.id,
        amountUsd,
        cryptocurrency: 'USDT',
        amountCrypto,
        blockchain: 'tron',
        nowpaymentsPaymentId: nowpaymentsId,
        status: 'PENDING',
        paymentAddress: payAddress,
        paymentUrl: checkoutUrl,
        paystatus: payment.payment_status ?? 'pending',
        expiresAt: new Date(Date.now() + 1000 * 60 * config.PAYMENT_TIMEOUT_MINUTES),
      },
      update: {
        amountCrypto,
        paymentAddress: payAddress,
        paymentUrl: checkoutUrl,
        nowpaymentsPaymentId: nowpaymentsId,
        status: 'PENDING',
        paystatus: payment.payment_status ?? 'pending',
        expiresAt: new Date(Date.now() + 1000 * 60 * config.PAYMENT_TIMEOUT_MINUTES),
        updatedAt: new Date(),
      },
    });

    console.log('Saved cryptoPayment:', cryptoPayment);

    if (payAddress) {
      console.log('Wallet address available:', payAddress);
    } else {
      console.log('No wallet address returned by NowPayments for this invoice.');
    }
  } catch (err: any) {
    console.error('E2E payment test failed:', err?.message || err);
    if (err?.response?.data) console.error('API response:', err.response.data);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
