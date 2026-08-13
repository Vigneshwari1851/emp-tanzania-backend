import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Jobs for Recruitment Candidate Flow...');
  
  // Clean up existing jobs to prevent duplicates during testing
  await prisma.job.deleteMany();
  console.log('🧹 Cleaned up existing jobs.');

  let firstOrg = await prisma.organization.findFirst();
  if (!firstOrg) {
    firstOrg = await prisma.organization.create({
      data: {
        entity_name: 'Lattium Tech',
        currency: 'INR',
        address: 'Main Street',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        zip: '600001',
        standard_working_hours_per_week: 40,
        working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        public_holidays: []
      }
    });
  }
  const orgId = firstOrg.id;

  const job1 = await prisma.job.create({
    data: {
      organization_id: orgId,
      title: 'Senior Full Stack Engineer (Next.js & Node.js)',
      description: 'We are looking for a Senior Full Stack Engineer with strong expertise in building enterprise-grade SaaS platforms. The ideal candidate will be responsible for end-to-end feature delivery, API engineering, schema optimization, and real-time state management.',
      department: 'Engineering',
      location: 'Chennai, India',
      employment_type: 'Full-time',
      experience_level: 'Senior Level',
      experience_required: '5-8 Years',
      openings_count: 3,
      remote_option: 'Hybrid',
      salary_type: 'RANGE',
      currency: 'INR',
      min_salary: 1500000,
      max_salary: 2500000,
      salary_period: 'Annual',
      job_summary: 'We are seeking a Senior Full Stack Engineer to lead the design and development of our core enterprise modules. You will work with Next.js, Node.js, TypeScript, and Prisma to deliver highly available, secure SaaS features.',
      responsibilities: [
        'Design scalable microservices and RESTful APIs',
        'Lead front-end engineering with React 19 and Tailwind CSS',
        'Mentor junior engineers and conduct high-quality code reviews',
        'Optimize database queries and Prisma ORM schemas for performance'
      ],
      requirements: [
        '5+ years of software development experience using modern JS frameworks',
        'Strong proficiency in React/Next.js, TypeScript, and Node.js',
        'Hands-on experience with relational databases (MySQL/PostgreSQL) and ORMs like Prisma',
        'Solid understanding of AWS, CI/CD pipelines, and web security protocols'
      ],
      required_skills: ['Next.js', 'Node.js', 'TypeScript', 'Prisma', 'MySQL'],
      preferred_skills: ['Docker', 'AWS S3', 'Redis', 'WebSockets'],
      benefits: [
        'Comprehensive Health & Dental Insurance',
        'Flexible Hybrid Work Policy (2 days remote)',
        'Annual Learning & Development Budget (₹50,000)',
        'Performance-based Annual Bonuses'
      ],
      status: 'OPEN'
    }
  });

  const job2 = await prisma.job.create({
    data: {
      organization_id: orgId,
      title: 'HR Manager - Talent Acquisition',
      description: 'We are hiring a mid-level Human Resources Manager specializing in end-to-end recruitment pipelines. You will lead technical sourcing campaigns, conduct cultural evaluations, coordinate interview rounds, manage offering negotiations, and facilitate employee conversion workflows.',
      department: 'Human Resources',
      location: 'Bangalore, India',
      employment_type: 'Full-time',
      experience_level: 'Mid Level',
      experience_required: '3-5 Years',
      openings_count: 1,
      remote_option: 'On-site',
      salary_type: 'RANGE',
      currency: 'INR',
      min_salary: 800000,
      max_salary: 1200000,
      salary_period: 'Annual',
      job_summary: 'We are looking for an experienced HR Manager who will drive candidate sourcing, interview scheduling, offer negotiation, and onboarding conversion pipelines.',
      responsibilities: [
        'Coordinate end-to-end recruitment pipeline workflows and stage tracking',
        'Liaise with hiring managers to define technical hiring criteria',
        'Manage candidate offer negotiations, digital consent, and background verifications',
        'Onboard new employees and foster standard corporate culture'
      ],
      requirements: [
        '3+ years of experience in talent acquisition or HR operations management',
        'Strong verbal and written communication skills with emotional intelligence',
        'Hands-on experience with modern ATS platforms and candidate onboarding systems',
        'Excellent negotiation and stakeholder management skills'
      ],
      required_skills: ['Talent Acquisition', 'Negotiation', 'Sourcing', 'Onboarding'],
      preferred_skills: ['HRMS Systems', 'Conflict Resolution', 'LinkedIn Recruiter'],
      benefits: [
        'Medical Cover for self and family',
        'Free Daily Catered Meals & Snacks',
        'Quarterly Team Building Events',
        'Generous Parental Leaves & Wellness Days'
      ],
      status: 'OPEN'
    }
  });

  console.log(`✅ Seeded Job 1: ${job1.title} (ID: ${job1.id})`);
  console.log(`✅ Seeded Job 2: ${job2.title} (ID: ${job2.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
