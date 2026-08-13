const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.userDetail.findFirst({
    where: { first_name: 'Chandran' },
    include: { designation: true }
  });
  console.log(user);
}

main().catch(console.error).finally(() => prisma.$disconnect());
