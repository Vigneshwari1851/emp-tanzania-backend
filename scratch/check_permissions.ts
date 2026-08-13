import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany({
    include: {
      organizations: true,
      permissions: {
        take: 3,
        include: { permission: true }
      }
    }
  });
  console.log(JSON.stringify(roles, null, 2));
}

main().finally(() => prisma.$disconnect());
