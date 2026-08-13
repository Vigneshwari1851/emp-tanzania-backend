// Run: npx ts-node src/scripts/seed-documents.ts
// Or:   npm run seed:documents

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Document Hub data...');

  const firstUser = await prisma.user.findFirst({ orderBy: { id: 'asc' } });
  if (!firstUser) {
    console.log('No users found. Skipping document seed.');
    return;
  }

  const uploadedBy = firstUser.id;

  const documents = [
    {
      title: 'New Employee Onboarding Guide',
      description: 'Comprehensive guide covering your first 30/60/90 days — tools, culture, team structure, and key contacts.',
      category: 'Onboarding',
      tab: 'statutory',
      file_url: '/upload/sample-onboarding.pdf',
      file_type: 'application/pdf',
      file_size: 4404019,
      downloads_count: 120,
      views_count: 842,
      is_restricted: false,
      tags: ['onboarding', 'new-hire', 'guide'],
      version: '2.1',
    },
    {
      title: 'Leadership Development Program Handbook',
      description: 'Curriculum and resources for the HorizonHR Leadership Track — eligibility, modules, and assessment criteria.',
      category: 'Career Growth',
      tab: 'learning',
      file_url: '/upload/sample-leadership.pdf',
      file_type: 'application/pdf',
      file_size: 2936012,
      downloads_count: 45,
      views_count: 316,
      is_restricted: false,
      tags: ['leadership', 'career', 'development'],
      version: '1.0',
    },
    {
      title: 'Technical Skills Training Catalogue 2025',
      description: 'Full catalogue of sponsored certifications, workshops, and e-learning courses available to employees.',
      category: 'Training',
      tab: 'learning',
      file_url: '/upload/sample-training.pdf',
      file_type: 'application/pdf',
      file_size: 1572864,
      downloads_count: 78,
      views_count: 528,
      is_restricted: false,
      tags: ['training', 'certifications', 'skills'],
      version: '3.0',
    },
    {
      title: 'Soft Skills & Communication Workshop Series',
      description: 'Slide decks and reading materials from Q1 interpersonal skills workshops, including conflict resolution and presentation skills.',
      category: 'Training',
      tab: 'learning',
      file_url: '/upload/sample-softskills.doc',
      file_type: 'application/msword',
      file_size: 3250585,
      downloads_count: 32,
      views_count: 214,
      is_restricted: false,
      tags: ['soft-skills', 'communication', 'workshop'],
      version: '1.2',
    },
    {
      title: 'Product & Platform Overview Deck',
      description: 'Internal introduction to our product suite — key features, architecture overview, and roadmap highlights.',
      category: 'Product',
      tab: 'learning',
      file_url: '/upload/sample-product.pdf',
      file_type: 'application/pdf',
      file_size: 9122611,
      downloads_count: 67,
      views_count: 483,
      is_restricted: false,
      tags: ['product', 'overview', 'platform'],
      version: '2.0',
    },
    {
      title: 'Manager Essentials: Performance Review Framework',
      description: 'Step-by-step guide for managers on how to conduct effective performance reviews using the OKR framework.',
      category: 'Management',
      tab: 'conduct',
      file_url: '/upload/sample-performance.doc',
      file_type: 'application/msword',
      file_size: 2306867,
      downloads_count: 28,
      views_count: 178,
      is_restricted: true,
      tags: ['managers', 'performance', 'review', 'okr'],
      version: '1.5',
    },
    {
      title: 'Annual Leave Policy 2025',
      description: 'Detailed policy covering annual leave accrual, carry-over limits, and approval workflows.',
      category: 'HR',
      tab: 'leave',
      file_url: '/upload/sample-leave-policy.pdf',
      file_type: 'application/pdf',
      file_size: 1153433,
      downloads_count: 210,
      views_count: 1205,
      is_restricted: false,
      tags: ['leave', 'policy', 'hr'],
      version: '1.0',
    },
    {
      title: 'IT Security & Acceptable Use Policy',
      description: 'Mandatory reading on password policies, device management, and data protection guidelines.',
      category: 'IT',
      tab: 'operational',
      file_url: '/upload/sample-it-security.pdf',
      file_type: 'application/pdf',
      file_size: 3565158,
      downloads_count: 156,
      views_count: 940,
      is_restricted: false,
      tags: ['security', 'it', 'policy', 'data-protection'],
      version: '2.3',
    },
    {
      title: 'Code of Conduct & Ethics',
      description: 'Company-wide code of conduct outlining expected behaviors, ethical standards, and reporting procedures.',
      category: 'HR',
      tab: 'conduct',
      file_url: '/upload/sample-conduct.pdf',
      file_type: 'application/pdf',
      file_size: 1887436,
      downloads_count: 89,
      views_count: 634,
      is_restricted: false,
      tags: ['conduct', 'ethics', 'compliance'],
      version: '1.0',
    },
    {
      title: 'Remote Work Policy',
      description: 'Guidelines for remote and hybrid work arrangements, including expectations, tools, and productivity standards.',
      category: 'HR',
      tab: 'operational',
      file_url: '/upload/sample-remote-work.pdf',
      file_type: 'application/pdf',
      file_size: 1048576,
      downloads_count: 134,
      views_count: 789,
      is_restricted: false,
      tags: ['remote', 'hybrid', 'work-from-home'],
      version: '1.1',
    },
  ];

  for (const doc of documents) {
    const existing = await prisma.document.findFirst({
      where: { title: doc.title },
    });

    if (!existing) {
      await prisma.document.create({
        data: {
          ...doc,
          uploaded_by: uploadedBy,
          created_at: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        },
      });
      console.log(`  Created: ${doc.title}`);
    } else {
      console.log(`  Skipped (exists): ${doc.title}`);
    }
  }

  console.log('Document seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error seeding documents:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
