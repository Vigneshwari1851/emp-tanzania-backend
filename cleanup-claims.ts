import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // Delete old test claims so user can test the full flow fresh
    const deleted = await prisma.expenseClaim.deleteMany({
        where: { organization_id: 2 }
    });
    console.log(`Deleted ${deleted.count} old claims from Org 2`);
    console.log('Now submit fresh claims through the UI — they will sync to DB correctly.');
}

main().finally(() => prisma.$disconnect());
