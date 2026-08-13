import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();

async function main() {
    const orgId = 2;

    // Find or create 'super admin' role (matches auth middleware bypass)
    let superAdminRole = await prisma.role.findFirst({ where: { organization_id: orgId, role_name: 'super admin' } });
    if (!superAdminRole) {
        superAdminRole = await prisma.role.create({
            data: { role_name: 'super admin', description: 'Super Admin with full access', organization_id: orgId }
        });
        console.log('Created super admin role:', superAdminRole.id);
    }

    // Create or find admin@testcorp.com
    const hash = await bcrypt.hash('test1234', 10);
    let user = await prisma.user.findUnique({ where: { email: 'admin@testcorp.com' } });
    if (!user) {
        user = await prisma.user.create({
            data: {
                username: 'admin',
                email: 'admin@testcorp.com',
                password: hash,
                status: true,
            }
        });
        console.log('Created user: admin@testcorp.com');
    }

    await prisma.userDetail.upsert({
        where: { user_id: user.id },
        update: { role_id: superAdminRole.id },
        create: { user_id: user.id, role_id: superAdminRole.id, currency: 'INR', country: 'India' }
    });

    const existingRole = await prisma.userRole.findFirst({ where: { user_id: user.id, role_id: superAdminRole.id } });
    if (!existingRole) {
        // Remove any old roles first
        await prisma.userRole.deleteMany({ where: { user_id: user.id } });
        await prisma.userRole.create({ data: { user_id: user.id, role_id: superAdminRole.id } });
    }

    console.log('\n✅ Org 2 Super Admin ready:');
    console.log('   Email: admin@testcorp.com');
    console.log('   Password: test1234');
    console.log('   Role: super admin (bypasses all permission checks)');
    console.log('   Org ID: 2');
}

main().finally(() => prisma.$disconnect());
