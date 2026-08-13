import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    let output = '--- Database Audit ---\n';

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
        output += `\nRole: ${role.role_name} (ID: ${role.id})\n`;
        const perms = role.permissions.map(rp => rp.permission?.key_name || 'NULL');
        output += `Permissions: ${perms.sort().join(', ')}\n`;
    }

    const users = await prisma.user.findMany({
        include: {
            roles: {
                include: {
                    role: true
                }
            }
        }
    });

    for (const user of users) {
        output += `\nUser: ${user.email} (ID: ${user.id})\n`;
        output += `Roles: ${user.roles.map(ur => ur.role.role_name).join(', ')}\n`;
    }

    fs.writeFileSync('audit_results.txt', output);
    console.log('Audit written to audit_results.txt');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
