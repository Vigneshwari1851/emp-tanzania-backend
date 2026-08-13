const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { SurveyService } = require('./src/modules/survey/survey.service');

async function main() {
  const service = new SurveyService();
  const payload = {
    title: "Employee Pulse",
    questions: [
      {
        type: "TEXT",
        label: "Q1",
        order: 1,
        required: false
      },
      {
        type: "TEXT",
        label: "Q2",
        order: 2,
        required: false,
        parent_question_id: 1,
        trigger_option_id: null
      }
    ]
  };

  const surveyId = "7e83d394-155f-4528-ba2e-4bfaae2f5127";
  const updated = await service.update(surveyId, payload);
  console.log("Updated Survey Questions:");
  console.log(JSON.stringify(updated.questions, null, 2));
}

main().finally(() => prisma.$disconnect());
