const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const latestSurvey = await prisma.survey.findFirst({
    orderBy: { updated_at: 'desc' },
    include: { questions: { include: { options: true } } }
  });
  console.log("UPDATED AT:", latestSurvey.updated_at);
  console.log(JSON.stringify(latestSurvey, null, 2));
}
main().finally(() => prisma.$disconnect());
