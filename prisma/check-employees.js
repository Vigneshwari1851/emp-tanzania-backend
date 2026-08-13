const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { is_deleted: false },
    include: {
      roles: { include: { role: true } },
      details: {
        include: {
          department: true,
          role: true
        }
      }
    }
  });

  console.log('Total Active Users:', users.length);
  for (const u of users) {
    console.log(`- ID: ${u.id}, Email: ${u.email}, Status: ${u.status}, Role Name in Details: ${u.details?.role?.role_name}, Roles: ${u.roles.map(r => r.role?.role_name).join(', ')}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
