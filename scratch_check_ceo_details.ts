import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Searching for CEO or MD Designations ---');
  const ceos = await prisma.designation.findMany({
    where: {
      is_deleted: false,
      OR: [
        { designation_name: { contains: 'CEO' } },
        { designation_name: { contains: 'MD' } },
        { designation_name: { contains: 'Managing Director' } },
        { designation_name: { contains: 'Chief Executive' } }
      ]
    },
    include: {
      userDetails: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          employee_id: true,
          user: { select: { email: true } }
        }
      }
    }
  });

  for (const des of ceos) {
    console.log(`CEO Designation: ${des.designation_name} (${des.designation_code}) [ID: ${des.id}]`);
    console.log(`  Employees (${des.userDetails.length}):`);
    for (const ud of des.userDetails) {
      console.log(`    - ${ud.first_name} ${ud.last_name} (${ud.employee_id}) - ${ud.user.email}`);
    }
  }

  console.log('\n--- Checking all users with designation_id ---');
  const allUsers = await prisma.userDetail.findMany({
    where: {
      designation: {
        designation_name: { contains: 'CEO' }
      }
    },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      designation: {
        select: {
          id: true,
          designation_name: true
        }
      },
      reporting_manager: {
        select: {
          email: true
        }
      }
    }
  });
  console.log(`Found ${allUsers.length} users with CEO in designation:`);
  for (const u of allUsers) {
    console.log(`  User: ${u.first_name} ${u.last_name}, Designation ID: ${u.designation?.id} (${u.designation?.designation_name}), Manager: ${u.reporting_manager?.email || 'None'}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
