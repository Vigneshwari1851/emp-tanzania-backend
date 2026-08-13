import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- List of Employees under CEO/CTO ---');
  const details = await prisma.userDetail.findMany({
    where: {
      designation_id: { in: [1, 2, 3, 6, 8, 12, 14] }
    },
    include: {
      designation: true,
      user: true
    }
  });

  for (const d of details) {
    console.log(`Employee: ${d.first_name} ${d.last_name} (${d.employee_id})`);
    console.log(`  Designation: ${d.designation?.designation_name} (ID: ${d.designation_id})`);
    console.log(`  Email: ${d.user.email}`);
    console.log(`  Reporting Manager ID: ${d.reporting_manager_id}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
