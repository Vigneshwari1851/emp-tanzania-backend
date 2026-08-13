import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function check() {
  const courses = await prisma.lmsCourse.findMany({
    include: { modules: { include: { contents: true } } }
  });
  console.log(JSON.stringify(courses, null, 2));
}
check();
