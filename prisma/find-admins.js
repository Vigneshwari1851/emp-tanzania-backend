const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const adminUsers = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: {
            role_name: {
              in: ['admin', 'super_admin', 'super-admin', 'Admin', 'Super Admin']
            }
          }
        }
      }
    },
    include: {
      roles: { include: { role: true } }
    }
  });

  adminUsers.forEach(u => {
    console.log(`Admin User: ${u.email}, Roles: ${u.roles.map(r => r.role?.role_name).join(', ')}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
