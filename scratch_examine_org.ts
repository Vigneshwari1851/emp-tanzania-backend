import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- ALL DESIGNATIONS IN DB ---');
  const designations = await prisma.designation.findMany({
    where: { is_deleted: false },
    include: {
      parent: true,
      department: true,
      _count: {
        select: { userDetails: true }
      }
    }
  });

  for (const d of designations) {
    console.log(`Designation: ${d.designation_name} (Code: ${d.designation_code}, ID: ${d.id})`);
    console.log(`  Parent: ${d.parent ? `${d.parent.designation_name} (ID: ${d.parent_designation_id})` : 'NULL'}`);
    console.log(`  Department: ${d.department ? d.department.department_name : 'NULL'}`);
    console.log(`  Count of Employees: ${d._count.userDetails}`);
  }

  console.log('\n--- ROOT LEVEL DESIGNATIONS (PARENT IS NULL) ---');
  const roots = designations.filter(d => !d.parent_designation_id);
  for (const r of roots) {
    console.log(`- Root Designation: ${r.designation_name} (ID: ${r.id})`);
    // Find who are the employees with this designation
    const employees = await prisma.userDetail.findMany({
      where: { designation_id: r.id },
      select: {
        first_name: true,
        last_name: true,
        user: { select: { email: true } },
        reporting_manager: {
          select: {
            details: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          }
        }
      }
    });
    console.log(`  Employees:`);
    for (const e of employees) {
      console.log(`    * ${e.first_name} ${e.last_name} (${e.user.email}) - Reports to: ${e.reporting_manager?.details ? `${e.reporting_manager.details.first_name} ${e.reporting_manager.details.last_name}` : 'Nobody'}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
