import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Seed started for Rafiki organization (complete bootstrap)...');

    // 0. Seed System Settings (Statutory Configs)
    const systemSettingsData = [
        { key: 'EPF_WAGE_CEILING', value: '15000' },
        { key: 'EPF_EMPLOYEE_RATE', value: '0.12' },
        { key: 'EPF_EMPLOYER_EPS_RATE', value: '0.0833' },
        { key: 'EPF_EMPLOYER_EPF_RATE', value: '0.0367' },
        { key: 'ESI_WAGE_CEILING', value: '21000' },
        { key: 'ESI_EMPLOYEE_RATE', value: '0.0075' },
        { key: 'ESI_EMPLOYER_RATE', value: '0.0325' },
        { key: 'GRATUITY_YEARS_THRESHOLD', value: '5' },
        { key: 'GRATUITY_MULTIPLIER', value: '15' },
        { key: 'GRATUITY_DIVISOR', value: '26' },
        { key: 'LEAVE_ENCASHMENT_DIVISOR', value: '30' },
        { key: 'STANDARD_DEDUCTION_OLD', value: '50000' },
        { key: 'STANDARD_DEDUCTION_NEW', value: '75000' },
        { key: 'HRA_METRO_PERCENT', value: '0.50' },
        { key: 'HRA_NON_METRO_PERCENT', value: '0.40' },
        { key: 'HRA_RENT_BASIC_PERCENT', value: '0.10' },
        { key: 'GLOBAL_80C_LIMIT', value: '150000' },
        { key: 'REBATE_87A_LIMIT_OLD', value: '500000' },
        { key: 'REBATE_87A_AMOUNT_OLD', value: '12500' },
        { key: 'REBATE_87A_LIMIT_NEW', value: '700000' },
        { key: 'REBATE_87A_AMOUNT_NEW', value: '25000' },
        { key: 'TAX_SLABS_OLD', value: '[[0,250000,0],[250000,500000,0.05],[500000,1000000,0.20],[1000000,null,0.30]]' },
        { key: 'TAX_SLABS_NEW', value: '[[0,300000,0],[300000,600000,0.05],[600000,900000,0.10],[900000,1200000,0.15],[1200000,1500000,0.20],[1500000,null,0.30]]' }
    ];

    for (const item of systemSettingsData) {
        await prisma.systemSetting.upsert({
            where: { key: item.key },
            update: { value: item.value },
            create: item,
        });
    }
    console.log('✔ System settings seeded.');

    // 1. Create Modules
    const modulesData = [
        { id: 'employees', label: 'Employees' },
        { id: 'attendance', label: 'Attendance' },
        { id: 'leaves', label: 'Leaves' },
        { id: 'roles', label: 'Roles & Permissions' },
        { id: 'users', label: 'User Management' },
        { id: 'departments', label: 'Departments' },
        { id: 'organization', label: 'Organization' },
        { id: 'recruitment', label: 'Recruitment' },
        { id: 'branches', label: 'Branches' },
        { id: 'policies', label: 'Policies' },
        { id: 'holidays', label: 'Holidays' },
    ];

    for (const mod of modulesData) {
        await prisma.module.upsert({
            where: { id: mod.id },
            update: { label: mod.label },
            create: mod,
        });
    }
    console.log('✔ Modules seeded.');

    // 2. Create Permissions
    const permissionsData = [
        { permission_name: 'create', key_name: 'employees.create', description: 'Can create employees', moduleId: 'employees' },
        { permission_name: 'read', key_name: 'employees.read', description: 'Can view employees', moduleId: 'employees' },
        { permission_name: 'update', key_name: 'employees.update', description: 'Can update employees', moduleId: 'employees' },
        { permission_name: 'delete', key_name: 'employees.delete', description: 'Can delete employees', moduleId: 'employees' },
        { permission_name: 'manage', key_name: 'roles.manage', description: 'Can manage roles', moduleId: 'roles' },
        { permission_name: 'read', key_name: 'roles.read', description: 'Can view roles', moduleId: 'roles' },
        { permission_name: 'create', key_name: 'users.create', description: 'Can create users', moduleId: 'users' },
        { permission_name: 'read', key_name: 'users.read', description: 'Can view users', moduleId: 'users' },
        { permission_name: 'update', key_name: 'users.update', description: 'Can update users', moduleId: 'users' },
        { permission_name: 'delete', key_name: 'users.delete', description: 'Can delete users', moduleId: 'users' },
        { permission_name: 'manage', key_name: 'departments.manage', description: 'Can manage departments', moduleId: 'departments' },
        { permission_name: 'read', key_name: 'departments.read', description: 'Can view departments', moduleId: 'departments' },
        { permission_name: 'apply', key_name: 'leaves.apply', description: 'Can apply for leave', moduleId: 'leaves' },
        { permission_name: 'approve', key_name: 'leaves.approve', description: 'Can approve leave', moduleId: 'leaves' },
        { permission_name: 'reject', key_name: 'leaves.reject', description: 'Can reject leave', moduleId: 'leaves' },
        { permission_name: 'read', key_name: 'attendance.read', description: 'Can view attendance', moduleId: 'attendance' },
        { permission_name: 'manage', key_name: 'attendance.manage', description: 'Can manage attendance', moduleId: 'attendance' },
        { permission_name: 'create', key_name: 'attendance.create', description: 'Can check-in/out', moduleId: 'attendance' },
        { permission_name: 'read', key_name: 'branches.read', description: 'Can view branches', moduleId: 'branches' },
        { permission_name: 'manage', key_name: 'branches.manage', description: 'Can manage branches', moduleId: 'branches' },
        { permission_name: 'view', key_name: 'organization.view', description: 'Can view organization details', moduleId: 'organization' },
        { permission_name: 'manage', key_name: 'organization.manage', description: 'Can manage organization', moduleId: 'organization' },
        { permission_name: 'read', key_name: 'policies.read', description: 'Can view policies', moduleId: 'policies' },
        { permission_name: 'manage', key_name: 'policies.manage', description: 'Can manage policies', moduleId: 'policies' },
        { permission_name: 'view', key_name: 'holidays.view', description: 'Can view holidays', moduleId: 'holidays' },
        { permission_name: 'create', key_name: 'holidays.create', description: 'Can create holidays', moduleId: 'holidays' },
        { permission_name: 'update', key_name: 'holidays.update', description: 'Can update holidays', moduleId: 'holidays' },
        { permission_name: 'delete', key_name: 'holidays.delete', description: 'Can delete holidays', moduleId: 'holidays' },
    ];

    const createdPermissions = [];
    for (const perm of permissionsData) {
        const p = await prisma.permission.upsert({
            where: { key_name: perm.key_name },
            update: { permission_name: perm.permission_name, description: perm.description, moduleId: perm.moduleId },
            create: perm,
        });
        createdPermissions.push(p);
    }
    console.log('✔ Permissions seeded.');

    // 3. Create Roles
    const rolesData = [
        { role_name: 'super admin', description: 'Full access to the system' },
        { role_name: 'admin', description: 'Administrative access' },
        { role_name: 'hr', description: 'Human resources access' },
        { role_name: 'finance', description: 'Financial access' },
        { role_name: 'manager', description: 'Managerial access' },
        { role_name: 'user', description: 'Standard user access' },
    ];

    const createdRoles = [];
    for (const role of rolesData) {
        let r = await prisma.role.findFirst({
            where: { organization_id: null, role_name: role.role_name }
        });
        if (!r) {
            r = await prisma.role.create({
                data: {
                    role_name: role.role_name,
                    description: role.description
                }
            });
        } else {
            r = await prisma.role.update({
                where: { id: r.id },
                data: { description: role.description }
            });
        }
        createdRoles.push(r);
    }
    console.log('✔ Roles seeded.');

    // 4. Assign All Permissions to Super Admin Role (with GLOBAL scope)
    for (const perm of createdPermissions) {
        await prisma.rolePermission.upsert({
            where: {
                role_id_permission_id: {
                    role_id: createdRoles[0]!.id,
                    permission_id: perm.id,
                },
            },
            update: { scope: 'GLOBAL' },
            create: {
                role_id: createdRoles[0]!.id,
                permission_id: perm.id,
                scope: 'GLOBAL',
            },
        });
    }

    // 5. Assign Permissions to other roles
    const excludedKeys = [
        'employees.create', 'employees.update', 'employees.delete', // Employee Management
        'branches.manage', 'departments.manage', 'organization.manage', // Company Structure
        'roles.manage', 'users.create', 'users.read', 'users.update', 'users.delete' // System Settings
    ];

    const adminManagerPermissions = createdPermissions.filter(p => !excludedKeys.includes(p.key_name!));
    const userPermissions = createdPermissions.filter(p => 
        ['employees.read', 'leaves.apply', 'leaves.read', 'attendance.read', 'attendance.create', 'policies.read'].includes(p.key_name!)
    );

    const adminRoleObj = createdRoles.find(r => r.role_name === 'admin')!;
    const hrRoleObj = createdRoles.find(r => r.role_name === 'hr')!;
    const financeRoleObj = createdRoles.find(r => r.role_name === 'finance')!;
    const managerRoleObj = createdRoles.find(r => r.role_name === 'manager')!;
    const userRoleObj = createdRoles.find(r => r.role_name === 'user')!;

    const rolePermissionMap = [
        { role: adminRoleObj, permissions: adminManagerPermissions },
        { role: hrRoleObj, permissions: adminManagerPermissions },
        { role: financeRoleObj, permissions: adminManagerPermissions },
        { role: managerRoleObj, permissions: adminManagerPermissions },
        { role: userRoleObj, permissions: userPermissions },
    ];

    for (const { role, permissions } of rolePermissionMap) {
        await prisma.rolePermission.deleteMany({
            where: { role_id: role.id }
        });

        for (const perm of permissions) {
            await prisma.rolePermission.create({
                data: {
                    role_id: role.id,
                    permission_id: perm.id,
                    scope: role.role_name === 'user' ? 'OWN' : 'GLOBAL',
                },
            });
        }
    }
    console.log('✔ Role-permissions seeded.');

    // 6. Seed Feature Modules (For Frontend Subscriptions check)
    const moduleCodes = [
        { code: 'COMPANY_STRUCTURE',   name: 'Company Structure' },
        { code: 'EMPLOYEE_MANAGEMENT', name: 'Employee Management' },
        { code: 'RECRUITMENT',         name: 'Recruitment' },
        { code: 'TIME_ATTENDANCE',     name: 'Time & Attendance' },
        { code: 'TEAM_CALENDAR',       name: 'Team Calendar' },
        { code: 'PAYROLL',             name: 'Payroll' },
        { code: 'LOANS_ADVANCES',      name: 'Loans & Advances' },
        { code: 'TALENT_GROWTH',       name: 'Talent & Growth' },
        { code: 'SURVEY',              name: 'Surveys' },
        { code: 'NOTIFICATIONS',       name: 'Notifications' },
        { code: 'ASSET_MANAGEMENT',    name: 'Asset Management' },
        { code: 'AUDIT',               name: 'Audit Logs' },
    ];

    const moduleMap: Record<string, number> = {};
    for (const m of moduleCodes) {
        const mod = await prisma.feature_modules.upsert({
            where: { code: m.code },
            update: { name: m.name },
            create: { code: m.code, name: m.name },
        });
        moduleMap[m.code] = mod.id;
    }
    console.log('✔ Feature Modules seeded.');

    // 7. Seed Editions (Subscriptions)
    const editions = [
        { code: 'ENTERPRISE', name: 'Enterprise', description: 'All modules enabled', modules: moduleCodes.map(m => m.code) },
        { code: 'STANDARD',   name: 'Standard',   description: 'Core HR & Payroll',  modules: ['COMPANY_STRUCTURE', 'EMPLOYEE_MANAGEMENT', 'TIME_ATTENDANCE', 'TEAM_CALENDAR', 'PAYROLL', 'NOTIFICATIONS'] },
        { code: 'BASIC',      name: 'Basic',      description: 'Employee Management', modules: ['EMPLOYEE_MANAGEMENT', 'TIME_ATTENDANCE', 'NOTIFICATIONS'] },
    ];

    for (const ed of editions) {
        const edition = await prisma.editions.upsert({
            where: { code: ed.code },
            update: { name: ed.name, description: ed.description },
            create: { code: ed.code, name: ed.name, description: ed.description },
        });

        for (const modCode of ed.modules) {
            await prisma.edition_modules.upsert({
                where: { editionId_featureModuleId: { editionId: edition.id, featureModuleId: moduleMap[modCode]! } },
                update: {},
                create: { editionId: edition.id, featureModuleId: moduleMap[modCode]! },
            });
        }
    }
    console.log('✔ Editions (Subscriptions) seeded.');

    // 8. Seed Default Tenant (id=1) pointing to Enterprise Subscription
    const enterprise = await prisma.editions.findUnique({ where: { code: 'ENTERPRISE' } });
    await prisma.tenants.upsert({
        where: { id: 1 },
        update: { editionId: enterprise!.id },
        create: { id: 1, name: 'Default Tenant', editionId: enterprise!.id },
    });
    console.log('✔ Default Tenant Subscription seeded (Enterprise).');

    // 9. Create or find Organization Rafiki (ID: 1)
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
    console.log('✔ Organization Rafiki seeded.');

    // 10. Find or create 'ADMIN' user type
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
    console.log('✔ Admin User Type seeded.');

    // 11. Create IT Admin User
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
                    role_id: adminRoleObj.id,
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
    console.log('✔ IT Admin User seeded.');

    // Assign Role Admin in UserRole table
    await prisma.userRole.upsert({
        where: { user_id_role_id: { user_id: adminUser.id, role_id: adminRoleObj.id } },
        update: {},
        create: { user_id: adminUser.id, role_id: adminRoleObj.id }
    });

    console.log('\n🎉 Successfully seeded complete database bootstrap!');
    console.log('Login credentials for IT Admin:');
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
