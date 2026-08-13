const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('DELETE FROM candidate_offers');
  console.log('Offers deleted via raw sql');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
