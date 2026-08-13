import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // Check what permissions exist
    const allPermissions = await prisma.permission.findMany();
    console.log('--- All Permissions ---');
    for (const p of allPermissions) {
        console.log(`  ${p.id}: ${p.permission_name} (key: ${p.key_name})`);
    }

    console.log('\n--- Org 2 Roles ---');
    const allRoles = await prisma.role.findMany({
        where: { organization_id: 2 },
        include: {
            permissions: {
                include: { permission: true }
            }
        }
    });
    for (const role of allRoles) {
        console.log(`\n${role.role_name} (id: ${role.id}):`);
        console.log('  Permissions:', role.permissions.map((rp: any) => rp.permission?.permission_name || rp.permission?.key_name).filter(Boolean));
    }

    // Also check Org 1 finance role
    console.log('\n--- Org 1 Roles ---');
    const org1Roles = await prisma.role.findMany({
        where: { organization_id: 1 },
        include: {
            permissions: {
                include: { permission: true }
            }
        }
    });
    for (const role of org1Roles) {
        console.log(`\n${role.role_name} (id: ${role.id}):`);
        console.log('  Permissions:', role.permissions.map((rp: any) => rp.permission?.permission_name || rp.permission?.key_name).filter(Boolean));
    }
}

main().finally(() => prisma.$disconnect());
