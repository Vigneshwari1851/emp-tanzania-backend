import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const ptSlabs = await prisma.stateProfessionalTax.findMany();
  console.log("Seeded PT Slabs Count:", ptSlabs.length);
  console.log("Seeded PT Slabs:", JSON.stringify(ptSlabs, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
