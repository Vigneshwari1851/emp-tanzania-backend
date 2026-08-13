import { PrismaClient } from '@prisma/client';
import { SurveyService } from './src/modules/survey/survey.service';

const prisma = new PrismaClient();

async function main() {
  const service = new SurveyService();
  const payload = {
    title: "Employee Pulse Test",
    questions: [
      {
        type: "TEXT" as any,
        label: "Q1",
        order: 1,
        required: false
      },
      {
        type: "TEXT" as any,
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
  console.log(JSON.stringify(updated!.questions, null, 2));
}

main().finally(() => prisma.$disconnect());
