const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.userDetail.findMany({
    where: {
      designation_id: 1
    },
    include: {
      user: true,
      department: true
    }
  });

  users.forEach(u => {
    console.log(`User ID: ${u.user_id}, Name: ${u.first_name} ${u.last_name}, Email: ${u.user?.email}, Dept: ${u.department?.department_name}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
