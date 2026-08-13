import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'superadmin@gmail.com' } });
  if (!user) throw new Error('User not found');

  const course = await prisma.lmsCourse.create({
    data: {
      organization_id: 1, 
      title: 'LMS Quiz Live Demo',
      description: 'Enterprise Quiz and MCQ Verification Course',
      course_type: 'TECHNICAL',
      level: 'INTERMEDIATE',
      status: 'PUBLISHED',
      duration: '15 Mins',
      instructor_id: user.id,
      modules: {
        create: [
          {
            title: 'Knowledge Check',
            order: 1,
            contents: {
              create: [
                {
                  title: 'Architecture & MCQ Test',
                  content_type: 'QUIZ',
                  order: 1,
                  content_body: JSON.stringify({
                    passingScore: 50,
                    questions: [
                      {
                        question: "What is the primary role of a Solution Architect?",
                        type: "SINGLE",
                        options: ["Painting", "System Structure & Design", "Recruiting"],
                        correctAnswer: 1,
                        explanation: "Architects focus on the overall structure and high-level design of the solution."
                      },
                      {
                        question: "Which of these are cloud service models?",
                        type: "MULTI",
                        options: ["IaaS", "PaaS", "SaaS", "VaaS"],
                        correctAnswer: [0, 1, 2],
                        explanation: "IaaS, PaaS, and SaaS are standard cloud models. VaaS is not a standard one."
                      }
                    ]
                  })
                }
              ]
            }
          }
        ]
      }
    }
  });

  console.log('Course Created ID:', course.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
