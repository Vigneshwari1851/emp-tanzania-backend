import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Database Audit ---');

    // 1. Check all modules
    const modules = await (prisma as any).modules.findMany();
    console.log(`Modules: ${modules.map((m: any) => m.id).join(', ')}`);

    // 2. Check all permissions
    const permissions = await prisma.permission.findMany();
    console.log(`Total Permissions: ${permissions.length}`);

    // 3. Check roles and their permissions
    const roles = await prisma.role.findMany({
        include: {
            permissions: {
                include: {
                    permission: true
                }
            }
        }
    });

    for (const role of roles) {
        console.log(`\nRole: ${role.role_name} (ID: ${role.id})`);
        const perms = role.permissions.map(rp => rp.permission?.key_name || 'NULL');
        console.log(`Permissions: ${perms.join(', ')}`);
    }

    // 4. Check a specific user (the one from the user's token if id is 3)
    const testUser = await prisma.user.findUnique({
        where: { id: 3 },
        include: {
            roles: {
                include: {
                    role: true
                }
            }
        }
    });

    if (testUser) {
        console.log(`\nUser ID 3: ${testUser.email}`);
        console.log(`Roles: ${testUser.roles.map(ur => ur.role.role_name).join(', ')}`);
    } else {
        console.log(`\nUser ID 3 not found`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
