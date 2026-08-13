import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Assign all employees who have base_salary but no payroll_group
  // to "Permanent Tech Staff" (id=11) which has Engineer structure (5 components)
  const TARGET_GROUP_ID = 11;

  const result = await prisma.userDetail.updateMany({
    where: {
      payroll_group_id: null,
      base_salary: { not: null }
    },
    data: {
      payroll_group_id: TARGET_GROUP_ID
    }
  });

  console.log(`✅ Updated ${result.count} employees → payroll_group_id=${TARGET_GROUP_ID} (Permanent Tech Staff → Engineer structure)`);

  // Verify
  const updated = await prisma.userDetail.findMany({
    where: { payroll_group_id: TARGET_GROUP_ID },
    include: { user: { select: { email: true } } }
  });
  updated.forEach(ud => {
    console.log(`  ✓ ${ud.user.email} - base_salary=${ud.base_salary} → group=${TARGET_GROUP_ID}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
