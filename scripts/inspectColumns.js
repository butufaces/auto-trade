import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'CryptoPayment'`;
  console.log(cols);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
