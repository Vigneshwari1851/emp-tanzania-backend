const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        include: {
            roles: { include: { role: true } },
            details: { include: { role: true } }
        }
    });

    console.log('--- ALL USERS AND ROLES ---');
    for (const u of users) {
        const uRoles = u.roles.map(r => r.role?.role_name || r.role_name);
        const detailsRole = u.details?.role?.role_name || u.details?.role_id;
        console.log(`User ID: ${u.id} | Email: ${u.email}`);
        console.log(`  System Roles (u.roles):`, uRoles);
        console.log(`  Details Role (u.details.role):`, detailsRole);
        console.log(`  Static Role Field (u.role):`, u.role);
        console.log('-----------------------------');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
