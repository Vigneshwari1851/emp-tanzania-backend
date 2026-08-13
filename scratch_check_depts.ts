import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const depts = await prisma.department.findMany();
  console.log('DEPARTMENTS IN DB:');
  console.dir(depts, { depth: null });

  const users = await prisma.user.findMany({
    take: 5,
    include: {
      details: {
        include: {
          department: true,
          designation: true,
          role: true
        }
      }
    }
  });
  console.log('FIRST 5 USERS IN DB:');
  console.dir(users.map(u => ({
    id: u.id,
    email: u.email,
    details: u.details ? {
      first_name: u.details.first_name,
      last_name: u.details.last_name,
      department_id: u.details.department_id,
      department: u.details.department,
      designation_id: u.details.designation_id,
      designation: u.details.designation,
      role_id: u.details.role_id,
      role: u.details.role
    } : null
  })), { depth: null });
}

main().catch(err => {
  console.error(err);
}).finally(() => {
  prisma.$disconnect();
});
