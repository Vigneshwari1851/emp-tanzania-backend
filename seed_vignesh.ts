import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'vigneshs@gmail.com' },
  });

  if (!user) {
    console.log('User vigneshs@gmail.com not found. Skipping assignment.');
    return;
  }

  const courses = await prisma.lmsCourse.findMany({
    where: { status: 'PUBLISHED' },
    take: 1
  });

  if (courses.length > 0) {
    await prisma.lmsAssignment.upsert({
      where: {
        id: 0 // Dummy for upsert
      },
      update: {},
      create: {
        user_id: user.id,
        course_id: courses[0].id,
        status: 'IN_PROGRESS'
      }
    });
    console.log(`Assigned course ${courses[0].title} to Vignesh.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
