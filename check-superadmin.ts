import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'superadmin@gmail.com' },
        include: {
            details: {
                include: {
                    department: {
                        include: { branches: true }
                    }
                }
            },
            roles: {
                include: { role: true }
            }
        }
    });

    if (!user) { console.log('User not found'); return; }

    const u = user as any;
    console.log('Email:', user.email);
    console.log('Roles:', u.roles?.map((r: any) => r.role?.role_name));
    console.log('Department:', u.details?.department?.department_name);
    console.log('Branch:', u.details?.department?.branches?.branch_name);
    console.log('Org ID from department->branch:', u.details?.department?.branches?.organization_id);

    // Also check user_org_id if it exists
    const raw = await prisma.$queryRaw`SELECT id, email FROM users WHERE email = 'superadmin@gmail.com'`;
    console.log('Raw user:', raw);
}

main().finally(() => prisma.$disconnect());
