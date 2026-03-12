import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const admins = await prisma.user.findMany({
    where: { isAdmin: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      telegramId: true,
      email: true,
      status: true,
    },
  });

  console.log('\n=== ADMIN USERS IN DATABASE ===\n');
  console.log(`Total Admins: ${admins.length}\n`);
  
  if (admins.length === 0) {
    console.log('⚠️  NO ADMINS FOUND IN DATABASE');
  } else {
    admins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.firstName} ${admin.lastName || ''}`);
      console.log(`   Telegram ID: ${admin.telegramId || '❌ NOT SET'}`);
      console.log(`   Email: ${admin.email || 'N/A'}`);
      console.log(`   Status: ${admin.status}`);
      console.log('');
    });
  }

  process.exit(0);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
