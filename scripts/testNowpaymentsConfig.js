import nowpaymentsService from '../dist/services/cryptoPayment.js';

console.log('Valid config:', nowpaymentsService.validateConfiguration());
nowpaymentsService.logConfiguration();
