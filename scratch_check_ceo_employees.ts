import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Searching for Employees with Designation Code = CEO or Name = Chief Executive Officer ---');
  const employees = await prisma.userDetail.findMany({
    where: {
      OR: [
        { designation: { designation_code: 'CEO' } },
        { designation: { designation_name: 'Chief Executive Officer' } }
      ]
    },
    include: {
      designation: true,
      user: true
    }
  });

  console.log(`Found ${employees.length} employees:`);
  for (const e of employees) {
    console.log(`  - ${e.first_name} ${e.last_name} (${e.employee_id}) - Email: ${e.user.email} [Designation: ${e.designation?.designation_name} (${e.designation?.designation_code})]`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
