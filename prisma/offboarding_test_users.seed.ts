import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Creating offboarding test users...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // Get Roles
    const superAdminRole = await prisma.role.findFirst({ where: { role_name: 'super admin' } });
    const adminRole = await prisma.role.findFirst({ where: { role_name: 'admin' } });
    const managerRole = await prisma.role.findFirst({ where: { role_name: 'manager' } });
    const userRole = await prisma.role.findFirst({ where: { role_name: 'user' } });

    if (!superAdminRole || !adminRole || !managerRole || !userRole) {
        console.error('Required roles not found. Please run main seed first.');
        return;
    }

    // Get Department
    const dept = await prisma.department.findFirst({ where: { department_name: 'Engineering' } });
    if (!dept) {
        console.error('Engineering department not found.');
        return;
    }

    // 1. Create Super Admin
    const superAdmin = await prisma.user.upsert({
        where: { email: 'superadmin_test@socedge.com' },
        update: { password: hashedPassword },
        create: {
            username: 'superadmin_test',
            email: 'superadmin_test@socedge.com',
            password: hashedPassword,
            status: true,
            details: {
                create: {
                    first_name: 'Super',
                    last_name: 'Admin',
                    employee_id: 'SUP001',
                    department_id: dept.id,
                    role_id: superAdminRole.id
                }
            }
        }
    });
    await prisma.userRole.upsert({
        where: { user_id_role_id: { user_id: superAdmin.id, role_id: superAdminRole.id } },
        update: {},
        create: { user_id: superAdmin.id, role_id: superAdminRole.id }
    });

    // 2. Create Admin
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin_test@socedge.com' },
        update: { password: hashedPassword },
        create: {
            username: 'admin_test',
            email: 'admin_test@socedge.com',
            password: hashedPassword,
            status: true,
            details: {
                create: {
                    first_name: 'Admin',
                    last_name: 'User',
                    employee_id: 'ADM001',
                    department_id: dept.id,
                    role_id: adminRole.id
                }
            }
        }
    });
    await prisma.userRole.upsert({
        where: { user_id_role_id: { user_id: adminUser.id, role_id: adminRole.id } },
        update: {},
        create: { user_id: adminUser.id, role_id: adminRole.id }
    });

    // 3. Create Manager
    const managerUser = await prisma.user.upsert({
        where: { email: 'manager_test@socedge.com' },
        update: { password: hashedPassword },
        create: {
            username: 'manager_test',
            email: 'manager_test@socedge.com',
            password: hashedPassword,
            status: true,
            details: {
                create: {
                    first_name: 'Manager',
                    last_name: 'Test',
                    employee_id: 'MGR001',
                    department_id: dept.id,
                    role_id: managerRole.id
                }
            }
        }
    });
    await prisma.userRole.upsert({
        where: { user_id_role_id: { user_id: managerUser.id, role_id: managerRole.id } },
        update: {},
        create: { user_id: managerUser.id, role_id: managerRole.id }
    });

    // 4. Create Employee (Reporting to Manager)
    const employeeUser = await prisma.user.upsert({
        where: { email: 'employee_test@socedge.com' },
        update: { password: hashedPassword },
        create: {
            username: 'employee_test',
            email: 'employee_test@socedge.com',
            password: hashedPassword,
            status: true,
            details: {
                create: {
                    first_name: 'Employee',
                    last_name: 'Test',
                    employee_id: 'EMP_TEST_001',
                    department_id: dept.id,
                    role_id: userRole.id,
                    reporting_manager_id: managerUser.id,
                    start_date: new Date('2022-01-01'),
                    employment_type: 'Full-time'
                }
            }
        }
    });
    await prisma.userRole.upsert({
        where: { user_id_role_id: { user_id: employeeUser.id, role_id: userRole.id } },
        update: {},
        create: { user_id: employeeUser.id, role_id: userRole.id }
    });

    console.log('Offboarding test users created successfully:');
    console.log('- Super Admin: superadmin_test@socedge.com / password123');
    console.log('- Admin: admin_test@socedge.com / password123');
    console.log('- Manager: manager_test@socedge.com / password123');
    console.log('- Employee: employee_test@socedge.com / password123 (Reports to Manager)');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
