import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userDetails = await prisma.userDetail.findMany({
    select: {
      id: true,
      first_name: true,
      last_name: true,
      state: true,
      country: true,
      base_salary: true
    }
  });
  console.log("Employees detail states:", JSON.stringify(userDetails, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
