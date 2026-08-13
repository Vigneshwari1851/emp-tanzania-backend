const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const depts = await prisma.department.findMany({
    include: {
      parent_department: true,
      sub_departments: true
    }
  });

  depts.forEach(d => {
    console.log(`Dept ID: ${d.id}, Name: ${d.department_name}, Code: ${d.department_code}, Parent ID: ${d.parent_department_id}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
