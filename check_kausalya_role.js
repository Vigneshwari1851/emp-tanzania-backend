const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      roles: {
        include: {
          role: true
        }
      },
      details: {
        include: {
          role: true
        }
      }
    }
  });

  const staff = users.filter(u => {
    const roleNames = u.roles.map(ur => ur.role.role_name.toUpperCase());
    const detailRole = (u.details?.role?.role_name || '').toUpperCase();
    return roleNames.some(r => ['HR', 'ADMIN', 'SUPER_ADMIN', 'SUPER ADMIN', 'FINANCE'].includes(r)) || 
           ['HR', 'ADMIN', 'SUPER_ADMIN', 'SUPER ADMIN', 'FINANCE'].includes(detailRole);
  });

  console.log('Staff Users:');
  staff.forEach(u => {
    console.log(`- ID: ${u.id}, Username: ${u.username}, Roles:`, u.roles.map(ur => ur.role.role_name), `Detail Role:`, u.details?.role?.role_name);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
