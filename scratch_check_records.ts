import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const leaves = await prisma.leaveRequest.findMany({
    take: 2,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          details: { select: { first_name: true, last_name: true, employee_id: true } }
        }
      },
      leave_policy: true,
    }
  });
  console.log('SAMPLE LEAVE HISTORY RECORD:');
  console.dir(leaves, { depth: null });

  const exits = await prisma.exitRequest.findMany({
    take: 2,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          details: {
            select: {
              first_name: true,
              last_name: true,
              employee_id: true,
              profile_picture: true,
            }
          }
        }
      }
    }
  });
  console.log('SAMPLE EXIT RECORD:');
  console.dir(exits, { depth: null });
}

main().catch(err => {
  console.error(err);
}).finally(() => {
  prisma.$disconnect();
});
