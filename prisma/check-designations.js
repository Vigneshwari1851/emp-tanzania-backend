const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const depts = await prisma.department.findMany({
    where: { is_deleted: false }
  });
  const designations = await prisma.designation.findMany({
    where: { is_deleted: false },
    include: { department: true }
  });

  console.log('=== DEPARTMENTS ===');
  depts.forEach(d => console.log(`- ID: ${d.id}, Name: ${d.department_name}, Code: ${d.department_code}`));

  console.log('\n=== DESIGNATIONS ===');
  designations.forEach(dg => {
    console.log(`- ID: ${dg.id}, Name: ${dg.designation_name}, Code: ${dg.designation_code}, Dept ID: ${dg.department_id}, Dept Name: ${dg.department?.department_name || 'Global'}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
