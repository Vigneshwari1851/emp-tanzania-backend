const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const depts = await prisma.department.findMany({
    include: {
      userDetails: true
    }
  });

  depts.forEach(d => {
    console.log(`Dept: ${d.department_name} (Code: ${d.department_code}), Users count: ${d.userDetails.length}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
