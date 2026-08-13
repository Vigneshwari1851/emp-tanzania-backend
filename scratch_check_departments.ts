import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- ALL DEPARTMENTS IN DB ---');
  const departments = await prisma.department.findMany({
    where: { is_deleted: false }
  });

  for (const d of departments) {
    const parent = departments.find(p => p.id === d.parent_department_id);
    console.log(`Department: ${d.department_name} (Code: ${d.department_code}, ID: ${d.id})`);
    console.log(`  Parent Department ID: ${d.parent_department_id} (${parent ? parent.department_name : 'NULL'})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
