const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- STARTING ORG STRUCTURE CLEANUP ---');

  // 1. Set Engineering (ID 1) parent to null so it reports to CEO/MD
  await prisma.department.update({
    where: { id: 1 },
    data: { parent_department_id: null }
  });
  console.log('✓ Set Engineering parent_department_id to null');

  // 2. Rename Designation 1 to fix typo: "Chief Executive Officerr" -> "Chief Executive Officer"
  await prisma.designation.update({
    where: { id: 1 },
    data: { designation_name: 'Chief Executive Officer' }
  });
  console.log('✓ Fixed CEO name typo');

  // 3. Delete lowercase duplicate cto designation (ID 16) if it has 0 users
  const ctoDup = await prisma.designation.findUnique({
    where: { id: 16 },
    include: { userDetails: true }
  });

  if (ctoDup) {
    if (ctoDup.userDetails.length === 0) {
      await prisma.designation.delete({ where: { id: 16 } });
      console.log('✓ Deleted duplicate "cto" designation (ID 16)');
    } else {
      console.log('⚠ Duplicate "cto" (ID 16) has users mapped, not deleting');
    }
  }

  // 4. Delete dummy test departments: Qw (7), Ss (8), New (9) if they have 0 users
  const dummyDeptIds = [7, 8, 9];
  for (const id of dummyDeptIds) {
    const dept = await prisma.department.findUnique({
      where: { id },
      include: { userDetails: true }
    });

    if (dept) {
      if (dept.userDetails.length === 0) {
        await prisma.department.delete({ where: { id } });
        console.log(`✓ Deleted dummy department: ${dept.department_name} (ID ${id})`);
      } else {
        console.log(`⚠ Dummy department ${dept.department_name} (ID ${id}) has users, not deleting`);
      }
    }
  }

  console.log('--- CLEANUP COMPLETED ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
