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

  console.log('USERS FOUND IN DB:', users.length);
  users.forEach(u => {
    let roleStr = 'N/A';
    if (u.details?.role?.role_name) {
      roleStr = u.details.role.role_name;
    } else if (u.roles && u.roles.length > 0) {
      roleStr = u.roles.map(r => r.role.role_name).join(', ');
    }
    console.log({
      id: u.id,
      username: u.username,
      email: u.email,
      fullName: u.details ? `${u.details.first_name || ''} ${u.details.last_name || ''}` : 'N/A',
      role: roleStr,
      job_role: u.details?.job_role
    });
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
