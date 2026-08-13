import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: { details: true }
  });
  console.log('Active Users:');
  users.forEach(u => {
    console.log(`- [ID: ${u.id}] Email: ${u.email}, Name: ${u.details?.first_name} ${u.details?.last_name}`);
  });

  // Find Vigneshwari
  const vignesh = users.find(u => u.details?.first_name?.toLowerCase().includes('vignesh'));
  if (vignesh) {
    console.log(`Found Vigneshwari at user ID: ${vignesh.id}`);
    await prisma.userDetail.update({
      where: { user_id: vignesh.id },
      data: {
        compensation_breakdown: {
          outstanding_loan: 2000,
          outstanding_advance: 10000
        }
      }
    });
    console.log('Successfully updated Vigneshwari with outstanding loan and advance values!');
  } else {
    console.log('Vigneshwari not found in database.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
