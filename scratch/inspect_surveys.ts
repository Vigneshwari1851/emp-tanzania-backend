import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const surveys = await prisma.survey.findMany({
    include: {
      questions: {
        include: {
          options: true,
        },
      },
    },
  });

  console.log(`Found ${surveys.length} surveys in total.`);
  for (const s of surveys) {
    console.log(`\nSurvey ID: ${s.id}`);
    console.log(`Title: ${s.title}`);
    console.log(`Is Clone: ${s.is_clone}, Cloned From ID: ${s.cloned_from_id}`);
    console.log(`Questions Count: ${s.questions.length}`);
    for (const q of s.questions) {
      console.log(`  - Question [Order ${q.order}]: "${q.label}" (Type: ${q.type}, ID: ${q.id})`);
      console.log(`    Parent Question ID: ${q.parent_question_id}, Trigger Option ID: ${q.trigger_option_id}`);
      console.log(`    Options: ${q.options.map(o => `[${o.order}] ${o.label} (ID: ${o.id})`).join(', ') || 'None'}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
