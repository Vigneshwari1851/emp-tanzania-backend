import { PrismaClient } from '@prisma/client';
import { SurveyService } from '../src/modules/survey/survey.service';

const prisma = new PrismaClient();
const surveyService = new SurveyService();

async function main() {
  const sourceSurveyId = 'e91352c4-00af-4273-9a61-9a23c774ba01';
  
  // Find or create a response on the source survey
  let response = await prisma.surveyResponse.findFirst({
    where: { surveyId: sourceSurveyId },
    include: { answers: true }
  });

  if (!response) {
    console.log('No response found on source survey. Creating one...');
    const sourceSurvey = await prisma.survey.findUnique({
      where: { id: sourceSurveyId },
      include: { questions: { include: { options: true } } }
    });
    if (!sourceSurvey) {
      console.log('Source survey not found');
      return;
    }

    const q1 = sourceSurvey.questions.find(q => q.order === 1);
    const q2 = sourceSurvey.questions.find(q => q.order === 2);
    const q3 = sourceSurvey.questions.find(q => q.order === 3);
    const q4 = sourceSurvey.questions.find(q => q.order === 4);

    response = await prisma.surveyResponse.create({
      data: {
        surveyId: sourceSurveyId,
        userId: 1, // Superadmin
        answers: {
          create: [
            { questionId: q1!.id, valueNumber: 4 },
            { questionId: q2!.id, selectedOptionId: q2!.options[0].id },
            { questionId: q3!.id, selectedOptionId: q3!.options[0].id },
            { questionId: q4!.id, valueText: 'This is a test response' }
          ]
        }
      },
      include: { answers: true }
    });
    console.log('Created test response:', response.id);
  } else {
    console.log('Found existing test response:', response.id);
  }

  // Now clone the survey
  console.log('Cloning survey...');
  const cloned = await surveyService.clone(1, sourceSurveyId);
  if (!cloned) {
    console.log('Clone failed');
    return;
  }
  console.log(`Cloned Survey ID: ${cloned.id}`);

  // Fetch responses for the cloned survey
  console.log('Fetching responses for the cloned survey...');
  const responses = await surveyService.getResponses(cloned.id);
  console.log(`Retrieved ${responses.length} responses.`);
  
  for (const resp of responses) {
    console.log(`Response ID: ${resp.id}, Survey ID: ${resp.surveyId}`);
    for (const ans of resp.answers) {
      console.log(`  - Answer ID: ${ans.id}`);
      console.log(`    Question ID (mapped): ${ans.questionId}`);
      console.log(`    Selected Option ID (mapped): ${ans.selectedOptionId}`);
      console.log(`    Selected Option Label (mapped): ${ans.selectedOption?.label}`);
    }
  }

  // Print the cloned survey's questions and options for comparison
  console.log('\nCloned Survey Questions & Options:');
  const freshCloned = await prisma.survey.findUnique({
    where: { id: cloned.id },
    include: { questions: { include: { options: true } } }
  });
  for (const q of freshCloned!.questions) {
    console.log(`  - Question [Order ${q.order}] ID: ${q.id}`);
    console.log(`    Options: ${q.options.map(o => `[${o.order}] ID: ${o.id} Label: ${o.label}`).join(', ')}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
