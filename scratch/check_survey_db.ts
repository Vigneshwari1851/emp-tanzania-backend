import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const survey = await prisma.survey.findUnique({
    where: { id: "4c008f3a-055d-439f-9cc5-cbba9d7700ea" },
    include: {
      questions: {
        include: {
          options: true
        }
      }
    }
  });
  console.log(JSON.stringify(survey, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
