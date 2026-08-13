const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.designation.updateMany({
    where: { id: { in: [2, 3, 4, 5] } },
    data: { department_id: 1 },
  });
  await prisma.designation.updateMany({
    where: { id: { in: [6, 7] } },
    data: { department_id: 3 },
  });
  await prisma.designation.updateMany({
    where: { id: { in: [8, 9] } },
    data: { department_id: 4 },
  });
  console.log('Updated DB');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
