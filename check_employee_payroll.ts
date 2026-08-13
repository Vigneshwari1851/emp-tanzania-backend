import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find users with "employee" role - get their payroll data
  const users = await prisma.user.findMany({
    where: { status: true },
    include: {
      details: {
        include: {
          payroll_group: {
            include: {
              salary_structure: {
                include: {
                  components: {
                    include: { salary_component: true }
                  }
                }
              },
              reimbursement_types: true
            }
          }
        }
      }
    },
    take: 10
  });

  for (const u of users) {
    console.log(`\n--- User: ${u.email} (id=${u.id}) ---`);
    console.log(`  base_salary: ${u.details?.base_salary}`);
    console.log(`  payroll_group_id: ${u.details?.payroll_group_id}`);
    if (u.details?.payroll_group) {
      const pg = u.details.payroll_group;
      console.log(`  payroll_group: ${pg.name} (salary_structure_id=${pg.salary_structure_id})`);
      if (pg.salary_structure) {
        console.log(`  salary_structure: ${pg.salary_structure.name}`);
        console.log(`  components: ${pg.salary_structure.components.length}`);
        pg.salary_structure.components.forEach(sc => {
          console.log(`    - ${sc.salary_component.name} (${sc.salary_component.type}, ${sc.salary_component.calculation_type}, ${sc.salary_component.value})`);
        });
      } else {
        console.log(`  salary_structure: NONE LINKED`);
      }
      console.log(`  reimbursement_types: ${pg.reimbursement_types.length}`);
    } else {
      console.log(`  payroll_group: NONE`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
