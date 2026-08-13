import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning LMS tables...');
  await prisma.lmsProgress.deleteMany({});
  await prisma.lmsAssignment.deleteMany({});
  await prisma.lmsContent.deleteMany({});
  await prisma.lmsModule.deleteMany({});
  await prisma.lmsCourse.deleteMany({});
  console.log('Cleanup done.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
