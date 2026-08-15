import prisma from './src/shared/prisma/client';

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: { not: 'admin@rafiki.com' },
      is_deleted: false
    },
    include: {
      details: {
        include: {
          department: true,
          designation: true,
          role: true
        }
      }
    }
  });

  console.log('Other users in DB:');
  console.dir(users, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
