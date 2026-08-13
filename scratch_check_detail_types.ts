import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const detail = await prisma.userDetail.findFirst();
  console.log('SAMPLE USER DETAIL IN DB:');
  console.dir(detail, { depth: null });
}

main().catch(err => {
  console.error(err);
}).finally(() => {
  prisma.$disconnect();
});
