import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const email = "admin@testing.com";
    let user = await prisma.user.findUnique({
        where: { email },
        include: {
            details: {
                include: {
                    department: {
                        include: {
                            branches: true
                        }
                    },
                    role: true,
                    user_types: true
                }
            },
            roles: {
                include: {
                    role: {
                        include: {
                            permissions: {
                                include: {
                                    permission: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!user) {
        console.log("User not found!");
        return;
    }
    const u = user as any;
    let orgId = u.details?.department?.branches?.organization_id || null;
    console.log("Resolved orgId initially:", orgId);
    console.log("Details department branches keys:", Object.keys(u.details?.department?.branches || {}));
    console.log("Full branches info:", u.details?.department?.branches);
}
main().finally(() => prisma.$disconnect());
