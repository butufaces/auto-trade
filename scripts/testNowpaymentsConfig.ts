import nowpaymentsService from '../src/services/cryptoPayment.js';

console.log('Valid config:', nowpaymentsService.validateConfiguration());
nowpaymentsService.logConfiguration();
