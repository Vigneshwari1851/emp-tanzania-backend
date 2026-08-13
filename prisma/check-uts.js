const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const uts = await p.user_types.findMany({ orderBy: { id: 'asc' } });
  console.log('User Types:');
  uts.forEach(u => console.log('  ' + u.id + ': ' + u.name + ' (' + u.system_key + ')'));
  await p.$disconnect();
})();
