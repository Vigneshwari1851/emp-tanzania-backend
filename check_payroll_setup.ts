import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. All payroll groups
  const groups = await prisma.payrollGroup.findMany({
    include: {
      salary_structure: {
        include: {
          components: { include: { salary_component: true } }
        }
      }
    }
  });
  console.log(`\n=== Payroll Groups (${groups.length}) ===`);
  groups.forEach(g => {
    console.log(`  [${g.id}] ${g.name} -> structure: ${g.salary_structure?.name || 'NONE'} (components: ${g.salary_structure?.components.length ?? 0})`);
  });

  // 2. All salary structures
  const structs = await prisma.salaryStructure.findMany({
    include: { components: { include: { salary_component: true } } }
  });
  console.log(`\n=== Salary Structures (${structs.length}) ===`);
  structs.forEach(s => {
    console.log(`  [${s.id}] ${s.name} (status=${s.status}, components=${s.components.length})`);
    s.components.forEach(c => console.log(`      ${c.salary_component.name}: ${c.salary_component.type}, ${c.salary_component.calculation_type}, ${c.salary_component.value}`));
  });

  // 3. Active users with their base_salary
  const users = await prisma.user.findMany({
    where: { status: true },
    include: { details: true }
  });
  console.log(`\n=== Users with base_salary ===`);
  users.forEach(u => {
    if (u.details?.base_salary) {
      console.log(`  [${u.id}] ${u.email} - base_salary=${u.details.base_salary}, name=${u.details.first_name} ${u.details.last_name}, payroll_group_id=${u.details.payroll_group_id}`);
    }
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
