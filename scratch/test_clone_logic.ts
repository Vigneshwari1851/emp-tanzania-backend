import { PrismaClient } from '@prisma/client';
import { SurveyService } from '../src/modules/survey/survey.service';

const prisma = new PrismaClient();
const surveyService = new SurveyService();

async function main() {
  const targetSurveyId = 'e91352c4-00af-4273-9a61-9a23c774ba01';
  console.log(`Cloning survey: ${targetSurveyId}`);

  try {
    const cloned = await surveyService.clone(1, targetSurveyId);
    if (!cloned) {
      console.log('Cloned survey is null');
      return;
    }
    console.log(`Successfully cloned! New Survey ID: ${cloned.id}`);
    console.log(`New Survey Title: ${cloned.title}`);
    console.log(`Questions Count: ${cloned.questions.length}`);
    for (const q of cloned.questions) {
      console.log(`  - Question [Order ${q.order}]: "${q.label}" (Type: ${q.type}, ID: ${q.id})`);
      console.log(`    Parent Question ID: ${q.parent_question_id}, Trigger Option ID: ${q.trigger_option_id}`);
      // @ts-ignore
      console.log(`    Options: ${q.options ? q.options.map((o: any) => `[${o.order}] ${o.label} (ID: ${o.id})`).join(', ') : 'None'}`);
    }
  } catch (err) {
    console.error('Cloning failed with error:', err);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
