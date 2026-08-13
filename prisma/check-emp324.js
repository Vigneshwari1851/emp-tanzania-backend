const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const empIds = ['EMP001', 'EMP002', 'EMP003', 'EMP004', 'EMP005', 'ADMIN001'];
  const users = await prisma.user.findMany({
    where: {
      details: {
        employee_id: { in: empIds }
      }
    },
    include: {
      roles: { include: { role: true } },
      details: true
    }
  });

  console.log('--- TEST USER DETAILS ---');
  for (const u of users) {
    const roleNames = u.roles.map(r => r.role?.role_name).join(', ');
    console.log(`Name: ${u.details.first_name} ${u.details.last_name} | EmpID: ${u.details.employee_id} | Email: ${u.email} | Roles: ${roleNames}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
