const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const surveyId = "7e83d394-155f-4528-ba2e-4bfaae2f5127";
  
  const createdQuestions = [];
  const q1 = await prisma.question.create({
    data: {
      surveyId, type: "TEXT", label: "Q1", order: 101, required: false
    },
    include: { options: true }
  });
  createdQuestions.push(q1);

  const q2 = await prisma.question.create({
    data: {
      surveyId, type: "TEXT", label: "Q2", order: 102, required: false
    },
    include: { options: true }
  });
  createdQuestions.push(q2);

  const parentQ = createdQuestions.find(q => q.order === 101);
  const childQ = createdQuestions.find(q => q.order === 102);

  console.log("Updating child:", childQ.id, "with parent:", parentQ.id);

  const res = await prisma.question.update({
    where: { id: childQ.id },
    data: { parent_question_id: parentQ.id, trigger_option_id: null },
  });

  console.log("Updated result:", res);
  
  // delete them
  await prisma.question.delete({ where: { id: q1.id } });
  await prisma.question.delete({ where: { id: q2.id } });
}
main().finally(() => prisma.$disconnect());
