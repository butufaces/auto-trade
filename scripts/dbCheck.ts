import prisma from '../src/db/client.js';
import { config } from '../src/config/env.js';

console.log('config DB URL:', config.DATABASE_URL);

(async () => {
  try {
    console.log('About to query packages...');
    const pkgs = await prisma.package.findMany();
    console.log('Packages count:', pkgs.length);
  } catch (err: any) {
    console.error('DB check error:', err?.message || err);
    if (err?.stack) console.error(err.stack);
  } finally {
    await prisma.$disconnect();
  }
})();
