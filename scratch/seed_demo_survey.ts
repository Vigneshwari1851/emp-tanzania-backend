import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { status: true, is_deleted: false } });
  if (!user) {
    console.log('No active user found. Skipping.');
    return;
  }

  // Delete existing demo survey if present
  const existing = await prisma.survey.findFirst({ where: { title: 'Employee Experience Survey Q2 2025' } });
  if (existing) {
    await prisma.survey.delete({ where: { id: existing.id } });
    console.log('Deleted existing demo survey.');
  }

  // Create survey with conditional questions
  const survey = await prisma.survey.create({
    data: {
      title: 'Employee Experience Survey Q2 2025',
      description: 'Help us understand your experience and preferences. Some questions will appear based on your previous answers.',
      is_active: true,
      created_by: user.id,
      start_date: new Date('2025-06-01'),
      end_date: new Date('2025-07-15'),
      questions: {
        create: [
          {
            type: 'YES_NO',
            label: 'Do you have prior experience working in a similar role before joining us?',
            order: 1,
            required: true,
            options: {
              create: [
                { label: 'Yes', value: 'yes', order: 1 },
                { label: 'No', value: 'no', order: 2 },
              ],
            },
          },
          {
            type: 'TEXT',
            label: 'Tell us about your previous experience and how it helps you in your current role.',
            order: 2,
            required: true,
            options: { create: [] },
          },
          {
            type: 'YES_NO',
            label: 'Would you be interested in additional training programs?',
            order: 3,
            required: true,
            options: {
              create: [
                { label: 'Yes', value: 'yes', order: 1 },
                { label: 'No', value: 'no', order: 2 },
              ],
            },
          },
          {
            type: 'SINGLE_CHOICE',
            label: 'Which training area interests you the most?',
            order: 4,
            required: true,
            options: {
              create: [
                { label: 'Technical Skills', value: 'technical', order: 1 },
                { label: 'Leadership & Management', value: 'leadership', order: 2 },
                { label: 'Communication Skills', value: 'communication', order: 3 },
                { label: 'Domain Knowledge', value: 'domain', order: 4 },
              ],
            },
          },
          {
            type: 'TEXT',
            label: 'What kind of training or support would you like us to provide?',
            order: 5,
            required: true,
            options: { create: [] },
          },
        ],
      },
    },
    include: { questions: { include: { options: true } } },
  });

  // Now set up conditional relationships
  // Q3 (Would you be interested in training?) should only show if Q1 (prior experience) answer is "Yes"
  // Q4 (Which training area?) should only show if Q3 answer is "Yes"
  // Q5 (What training support?) should only show if Q1 answer is "No"

  const q1 = survey.questions.find(q => q.order === 1); // YES_NO: prior experience
  const q3 = survey.questions.find(q => q.order === 3); // YES_NO: interested in training
  const q4 = survey.questions.find(q => q.order === 4); // SINGLE_CHOICE: which training area
  const q5 = survey.questions.find(q => q.order === 5); // TEXT: what training support

  const yesOptionQ1 = q1?.options.find(o => o.value === 'yes');
  const noOptionQ1 = q1?.options.find(o => o.value === 'no');
  const yesOptionQ3 = q3?.options.find(o => o.value === 'yes');

  if (q1 && q3 && yesOptionQ1) {
    await prisma.question.update({
      where: { id: q3.id },
      data: { parent_question_id: q1.id, trigger_option_id: yesOptionQ1.id },
    });
    console.log('Q3 → conditional on Q1 = Yes');
  }

  if (q3 && q4 && yesOptionQ3) {
    await prisma.question.update({
      where: { id: q4.id },
      data: { parent_question_id: q3.id, trigger_option_id: yesOptionQ3.id },
    });
    console.log('Q4 → conditional on Q3 = Yes');
  }

  if (q1 && q5 && noOptionQ1) {
    await prisma.question.update({
      where: { id: q5.id },
      data: { parent_question_id: q1.id, trigger_option_id: noOptionQ1.id },
    });
    console.log('Q5 → conditional on Q1 = No');
  }

  console.log('\n✅ Demo survey created with conditional logic!');
  console.log(`Survey ID: ${survey.id}`);
  console.log('\nFlow:');
  console.log('  Q1: Do you have prior experience? (Yes/No)');
  console.log('    ├─ Yes → Q3: Interested in training? (Yes/No)');
  console.log('    │         └─ Yes → Q4: Which training area?');
  console.log('    └─ No  → Q5: What training/support would you like?');
  console.log('\nQ2 (Tell us about your experience) is always shown.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
