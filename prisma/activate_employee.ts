import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const user = await p.user.update({
    where: { email: 'employee@socedge.com' },
    data: { status: true }
  });
  console.log('Activated:', user.email, 'ID:', user.id);
  await p.$disconnect();
}
main();
