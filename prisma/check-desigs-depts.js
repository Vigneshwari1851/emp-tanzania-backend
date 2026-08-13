const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const desigs = await prisma.designation.findMany({
    include: {
      department: true
    }
  });
  desigs.forEach(d => {
    console.log(`Desig ID: ${d.id}, Name: ${d.designation_name}, Code: ${d.designation_code}, Parent ID: ${d.parent_designation_id}, Dept ID: ${d.department_id}, Dept Name: ${d.department?.department_name}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
