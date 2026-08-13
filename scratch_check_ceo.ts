import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Checking Designations ---');
  const designations = await prisma.designation.findMany({
    where: { is_deleted: false },
    include: {
      userDetails: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          employee_id: true,
          user: { select: { email: true } }
        }
      },
      parent: true
    }
  });

  for (const des of designations) {
    console.log(`Designation: ${des.designation_name} (${des.designation_code}) [ID: ${des.id}]`);
    console.log(`  Parent ID: ${des.parent_designation_id} (${des.parent?.designation_name || 'None'})`);
    console.log(`  Employees (${des.userDetails.length}):`);
    for (const ud of des.userDetails) {
      console.log(`    - ${ud.first_name} ${ud.last_name} (${ud.employee_id}) - ${ud.user.email}`);
    }
  }

  console.log('\n--- Checking Reporting Manager Structure ---');
  const userDetails = await prisma.userDetail.findMany({
    select: {
      id: true,
      first_name: true,
      last_name: true,
      designation: {
        select: {
          designation_name: true,
          id: true
        }
      },
      reporting_manager: {
        select: {
          email: true,
          details: {
            select: {
              first_name: true,
              last_name: true,
              designation: {
                select: {
                  designation_name: true
                }
              }
            }
          }
        }
      }
    }
  });

  console.log(`Total employee records: ${userDetails.length}`);
  const noManager = userDetails.filter(u => !u.reporting_manager);
  console.log(`Employees with NO reporting manager (${noManager.length}):`);
  for (const u of noManager) {
    console.log(`  - ${u.first_name} ${u.last_name} (Designation: ${u.designation?.designation_name || 'None'})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
