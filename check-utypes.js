const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const types = await prisma.userType.findMany({ select: { id: true, user_type_name: true } });
  console.log('User types:');
  types.forEach(t => console.log('  ' + t.id + ': ' + t.user_type_name));
  await prisma.$disconnect();
})();
