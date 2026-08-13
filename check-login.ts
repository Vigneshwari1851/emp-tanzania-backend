import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
const prisma = new PrismaClient();

async function main() {
    const email = 'employee@testcorp.com';
    const password = 'test1234';

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { console.log('User not found!'); return; }
    console.log('User found:', user.id, user.email, 'status:', user.status, 'deleted:', user.is_deleted);

    const valid = await bcrypt.compare(password, user.password);
    console.log('Password valid:', valid);
}

main().finally(() => prisma.$disconnect());
