const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const loans = await prisma.loan.findMany({
        include: { userDetail: { include: { user: true } } }
    });
    const advances = await prisma.advance.findMany({
        include: { userDetail: { include: { user: true } } }
    });

    console.log('--- DIRECT LOANS ---');
    for (const l of loans) {
        console.log(`ID: ${l.id} | Status: ${l.status} | Active: ${l.isActive} | User: ${l.userDetail?.user?.email}`);
    }

    console.log('--- DIRECT ADVANCES ---');
    for (const a of advances) {
        console.log(`ID: ${a.id} | Status: ${a.status} | Active: ${a.isActive} | User: ${a.userDetail?.user?.email}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
