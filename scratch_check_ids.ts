import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { email: 'superadmin@gmail.com' } });
  console.log('superadmin user:', admin);

  const admin2 = await prisma.user.findFirst({ where: { email: 'admin@demo.com' } });
  console.log('admin@demo.com user:', admin2);

  const firstSeeded = await prisma.userDetail.findFirst({
    where: { employee_id: 'EMP101' },
    include: { user: true }
  });
  console.log('EMP101 userDetail:', firstSeeded);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
