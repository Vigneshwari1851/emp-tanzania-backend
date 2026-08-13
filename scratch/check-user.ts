import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const users = await prisma.user.findMany({
        where: { is_deleted: false },
        select: {
            id: true,
            email: true,
            username: true,
            details: {
                select: {
                    first_name: true,
                    last_name: true,
                    department: {
                        select: {
                            id: true,
                            department_name: true,
                            branches: {
                                select: {
                                    id: true,
                                    branch_name: true,
                                    organization_id: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });
    console.log("Users:", JSON.stringify(users, null, 2));
}
main().finally(() => prisma.$disconnect());
