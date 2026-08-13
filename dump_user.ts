import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const u = await (prisma as any).user.findUnique({
    where: { email: 'financemanager@demo.com' },
    include: { roles: { include: { role: true } }, details: true }
  });
  console.log(JSON.stringify(u, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
