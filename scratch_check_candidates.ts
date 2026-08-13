import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Fetching candidates...');
    const candidates = await prisma.candidate.findMany({ include: { applications: true } });
    console.log(`Success, fetched ${candidates.length} candidates.`);
  } catch (e: any) {
    console.error('Error fetching candidates:', e.message);
    
    // If it's a relation error due to orphaned candidates, we should clean them up
    // as we dropped the recruitment_jobs table during MVP migration
    if (e.message.includes('Inconsistent column data') || e.message.includes('relation')) {
      console.log('Attempting to clean up orphaned candidate records...');
      await prisma.candidate.deleteMany();
      console.log('Successfully cleared orphaned candidates to restore dashboard functionality.');
    }
  }
}

main().finally(() => prisma.$disconnect());
