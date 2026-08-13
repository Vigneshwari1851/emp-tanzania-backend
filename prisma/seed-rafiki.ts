import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Seed started for Rafiki organization (minimal)...');

    // 1. Create or find organization Rafiki (ID: 1)
    const org = await prisma.organization.upsert({
        where: { id: 1 },
        update: {
            slug: 'rafiki',
            entity_name: 'Rafiki',
        },
        create: {
            id: 1,
            slug: 'rafiki',
            entity_name: 'Rafiki',
            company_code: 'RAF001',
            currency: 'INR',
            address: 'Dar es Salaam HQ',
            city: 'Dar es Salaam',
            state: 'Dar es Salaam',
            country: 'Tanzania',
            zip: '00000',
            standard_working_hours_per_week: 40,
            working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            public_holidays: []
        }
    });

    // 2. Find or create 'admin' role
    let adminRole = await prisma.role.findFirst({
        where: { organization_id: null, role_name: 'admin' }
    });
    if (!adminRole) {
        adminRole = await prisma.role.create({
            data: {
                role_name: 'admin',
                description: 'Administrative access'
            }
        });
    }

    // 3. Find or create 'ADMIN' user type
    let adminUserType = await prisma.user_types.findFirst({
        where: { organization_id: org.id, system_key: 'ADMIN' }
    });
    if (!adminUserType) {
        adminUserType = await prisma.user_types.create({
            data: {
                organization_id: org.id,
                name: 'Admin',
                system_key: 'ADMIN',
                description: 'Administrative access'
            }
        });
    }

    // 4. Create IT Admin User
    const adminPassword = await bcrypt.hash('password123', 10);
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@rafiki.com' },
        update: { password: adminPassword },
        create: {
            username: 'rafiki_admin',
            email: 'admin@rafiki.com',
            password: adminPassword,
            status: true,
            details: {
                create: {
                    first_name: 'Rafiki',
                    last_name: 'Admin',
                    employee_id: 'RAF-ADM-001',
                    role_id: adminRole.id,
                    user_type_id: adminUserType.id,
                    employment_type: 'Full-time',
                    start_date: new Date(),
                    work_location: 'Dar es Salaam',
                    base_salary: 100000,
                    currency: 'INR',
                    salary_frequency: 'Monthly',
                }
            }
        }
    });

    // Assign Role Admin in UserRole table
    await prisma.userRole.upsert({
        where: { user_id_role_id: { user_id: adminUser.id, role_id: adminRole.id } },
        update: {},
        create: { user_id: adminUser.id, role_id: adminRole.id }
    });

    console.log('Successfully completed minimal Rafiki seed setup!');
    console.log('Login credentials:');
    console.log('Email: admin@rafiki.com');
    console.log('Password: password123');
    console.log('Tenant Slug: rafiki');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
