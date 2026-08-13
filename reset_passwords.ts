import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const newHash = await bcrypt.hash('12345678', 10);
  
  const targets = [
    'financemanager@demo.com',
    'financeexecutive@demo.com',
    'admin@demo.com',
    'manager@demo.com',
    'hrmanager@demo.com',
    'hrexecutive@demo.com',
    'employee@socedge.com',
  ];

  for (const email of targets) {
    const updated = await prisma.user.updateMany({
      where: { email },
      data: { password: newHash },
    });
    console.log(`${email} → updated ${updated.count} record(s)`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
