import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        where: { email: { contains: 'testcorp' } },
        select: { id: true, email: true, status: true, is_deleted: true }
    });
    console.log('Users found:', JSON.stringify(users, null, 2));

    // Also check if the login endpoint is working
    const allTestEmails = ['employee@testcorp.com', 'manager@testcorp.com', 'hr@testcorp.com', 'finance@testcorp.com', 'sales@testcorp.com', 'senior@testcorp.com'];
    for (const email of allTestEmails) {
        const u = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, status: true, is_deleted: true } });
        console.log(`${email}: ${u ? `FOUND (id=${u.id}, status=${u.status}, deleted=${u.is_deleted})` : 'NOT FOUND'}`);
    }
}

main().finally(() => prisma.$disconnect());
