import { PrismaClient } from '@prisma/client';
import process from 'process';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Master Enterprise Seed...');

  const organization = await prisma.organization.findFirst();
  if (!organization) {
    console.log('No organization found. Please create one first.');
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: 'superadmin@gmail.com' },
  });
  
  const employee = await prisma.user.findUnique({
    where: { email: 'vigneshs@gmail.com' },
  });

  if (!user || !employee) {
    console.error('Test users not found.');
    return;
  }

  const organizationId = organization.id;

  // Course Definitions
  const courseData = [
    {
      title: 'Modern Workplace Communication',
      desc: 'Master professional communication in a digital-first environment.',
      status: 'PUBLISHED',
      progress: 100, // Completed
      lessons: ['Email Etiquette', 'Slack Collaboration', 'Effective Feedback', 'Active Listening']
    },
    {
      title: 'Cybersecurity Essentials 2026',
      desc: 'Protect organization data against AI-driven phishing and social engineering.',
      status: 'PUBLISHED',
      progress: 50, // In Progress
      lessons: ['Phishing Trends 2026', 'Password Security', 'Data Handling', 'Secure Remote Work']
    },
    {
      title: 'Leadership & Team Management',
      desc: 'Core skills for first-time managers and aspiring leaders.',
      status: 'PUBLISHED',
      progress: 0, // Not Started
      lessons: ['Building Trust', 'Delegation Skills', 'Conflict Resolution', 'Performance Reviews']
    },
    {
      title: 'Product Management Fundamentals',
      desc: 'Building products that solve real customer problems.',
      status: 'PUBLISHED',
      progress: 25, // In Progress
      lessons: ['Market Research', 'Roadmap Creation', 'Prioritization', 'Product Analytics']
    },
    {
      title: 'Advanced React & TypeScript',
      desc: 'Building scalable enterprise applications with modern patterns.',
      status: 'PUBLISHED',
      progress: 100, // Completed
      lessons: ['Custom Hooks', 'Generics', 'State Management', 'Performance Optimization']
    },
    {
      title: 'Data Privacy & GDPR',
      desc: 'Stay compliant with global data protection regulations.',
      status: 'PUBLISHED',
      progress: 0, // Not Started
      lessons: ['GDPR Basics', 'Consent Management', 'Data Subject Rights', 'Breach Notification']
    }
  ];

  for (const c of courseData) {
    // 1. Create Course
    const course = await prisma.lmsCourse.create({
      data: {
        organization_id: organizationId,
        instructor_id: user.id,
        title: c.title,
        description: c.desc,
        status: c.status as any,
        thumbnail_url: `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60`
      }
    });

    // 2. Create Module
    const module = await prisma.lmsModule.create({
      data: {
        course_id: course.id,
        title: 'Core Curriculum',
        order: 1
      }
    });

    // 3. Create Content & Progress for BOTH users
    for (let i = 0; i < c.lessons.length; i++) {
      const content = await prisma.lmsContent.create({
        data: {
          module_id: module.id,
          title: c.lessons[i],
          content_type: 'VIDEO',
          content_body: `This is the lesson content for ${c.lessons[i]}.`,
          order: i + 1
        }
      });

      // Calculate if this lesson should be marked as completed based on course progress
      const shouldComplete = (i + 1) <= (c.lessons.length * (c.progress / 100));

      if (shouldComplete) {
        // Mark progress for admin
        await prisma.lmsProgress.create({
          data: {
            user_id: user.id,
            module_id: module.id,
            content_id: content.id,
            completed: true,
            completed_at: new Date()
          }
        });
        // Mark progress for employee
        await prisma.lmsProgress.create({
          data: {
            user_id: employee.id,
            module_id: module.id,
            content_id: content.id,
            completed: true,
            completed_at: new Date()
          }
        });
      }
    }

    // 4. Create Assignments
    const assignmentStatus = c.progress === 100 ? 'COMPLETED' : c.progress > 0 ? 'IN_PROGRESS' : 'ASSIGNED';
    
    await prisma.lmsAssignment.create({
      data: { user_id: user.id, course_id: course.id, status: assignmentStatus }
    });
    await prisma.lmsAssignment.create({
      data: { user_id: employee.id, course_id: course.id, status: assignmentStatus }
    });
  }

  console.log('Seeding completed successfully with 6 diverse courses!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
