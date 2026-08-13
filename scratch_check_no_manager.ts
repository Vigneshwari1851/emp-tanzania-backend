import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- ALL USERS WITH NO REPORTING MANAGER ---');
  const details = await prisma.userDetail.findMany({
    where: {
      OR: [
        { reporting_manager_id: null },
        { reporting_manager_id: 0 }
      ]
    },
    include: {
      designation: true,
      user: true,
      department: true
    }
  });

  console.log(`Found ${details.length} employees with no manager:`);
  for (const d of details) {
    console.log(`  - ${d.first_name} ${d.last_name} (${d.employee_id}) - Email: ${d.user.email}`);
    console.log(`    Designation: ${d.designation?.designation_name} (ID: ${d.designation_id})`);
    console.log(`    Department: ${d.department?.department_name} (ID: ${d.department_id})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
