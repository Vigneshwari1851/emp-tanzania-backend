import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Seed started for Rafiki organization (Tanzania focus)...');

    // 0. Seed System Settings (Statutory Configs for Tanzania)
    const systemSettingsData = [
        { key: 'EPF_WAGE_CEILING', value: '999999999' },
        { key: 'EPF_EMPLOYEE_RATE', value: '0.10' }, // 10% NSSF Employee rate
        { key: 'EPF_EMPLOYER_EPS_RATE', value: '0.10' }, // 10% NSSF Employer rate
        { key: 'EPF_EMPLOYER_EPF_RATE', value: '0.00' },
        { key: 'ESI_WAGE_CEILING', value: '999999999' },
        { key: 'ESI_EMPLOYEE_RATE', value: '0.03' }, // 3% NHIF Employee rate
        { key: 'ESI_EMPLOYER_RATE', value: '0.03' }, // 3% NHIF Employer rate
        { key: 'GRATUITY_YEARS_THRESHOLD', value: '5' },
        { key: 'GRATUITY_MULTIPLIER', value: '15' },
        { key: 'GRATUITY_DIVISOR', value: '26' },
        { key: 'LEAVE_ENCASHMENT_DIVISOR', value: '30' },
        { key: 'STANDARD_DEDUCTION_OLD', value: '0' },
        { key: 'STANDARD_DEDUCTION_NEW', value: '0' },
        { key: 'HRA_METRO_PERCENT', value: '0.00' },
        { key: 'HRA_NON_METRO_PERCENT', value: '0.00' },
        { key: 'HRA_RENT_BASIC_PERCENT', value: '0.00' },
        { key: 'GLOBAL_80C_LIMIT', value: '0' },
        { key: 'REBATE_87A_LIMIT_OLD', value: '0' },
        { key: 'REBATE_87A_AMOUNT_OLD', value: '0' },
        { key: 'REBATE_87A_LIMIT_NEW', value: '0' },
        { key: 'REBATE_87A_AMOUNT_NEW', value: '0' },
        // Tanzania progressive annual tax slabs (exceeding 270,000 TZS monthly -> 3,240,000 TZS annual)
        { key: 'TAX_SLABS_OLD', value: '[[0,3240000,0],[3240000,6240000,0.08],[6240000,9120000,0.20],[9120000,12000000,0.25],[12000000,null,0.30]]' },
        { key: 'TAX_SLABS_NEW', value: '[[0,3240000,0],[3240000,6240000,0.08],[6240000,9120000,0.20],[9120000,12000000,0.25],[12000000,null,0.30]]' }
    ];

    for (const item of systemSettingsData) {
        await prisma.systemSetting.upsert({
            where: { key: item.key },
            update: { value: item.value },
            create: item,
        });
    }
    console.log('✔ System settings seeded (Tanzania Statutory Values).');

    // 1. Create Modules
    const modulesData = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'org-setup', label: 'Org Setup' },
        { id: 'employees', label: 'Employee Management' },
        { id: 'leaves', label: 'Leave Management' },
        { id: 'attendance', label: 'Time & Attendance' },
        { id: 'calendar', label: 'Calendar' },
        { id: 'payroll', label: 'Payroll' },
        { id: 'loans-advances', label: 'Loans & Advances' },
        { id: 'reimbursements', label: 'Reimbursements' },
        { id: 'survey', label: 'Survey' },
        { id: 'notifications', label: 'Notification' },
        { id: 'document-hub', label: 'Doc Hub' },
        { id: 'news', label: 'Company News' },
        { id: 'report-builder', label: 'Report Builder' },
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
        { permission_name: 'manage', key_name: 'roles.manage', description: 'Can manage roles', moduleId: 'org-setup' },
        { permission_name: 'read', key_name: 'roles.read', description: 'Can view roles', moduleId: 'org-setup' },
        { permission_name: 'create', key_name: 'users.create', description: 'Can create users', moduleId: 'org-setup' },
        { permission_name: 'read', key_name: 'users.read', description: 'Can view users', moduleId: 'org-setup' },
        { permission_name: 'update', key_name: 'users.update', description: 'Can update users', moduleId: 'org-setup' },
        { permission_name: 'delete', key_name: 'users.delete', description: 'Can delete users', moduleId: 'org-setup' },
        { permission_name: 'manage', key_name: 'departments.manage', description: 'Can manage departments', moduleId: 'org-setup' },
        { permission_name: 'read', key_name: 'departments.read', description: 'Can view departments', moduleId: 'org-setup' },
        { permission_name: 'apply', key_name: 'leaves.apply', description: 'Can apply for leave', moduleId: 'leaves' },
        { permission_name: 'approve', key_name: 'leaves.approve', description: 'Can approve leave', moduleId: 'leaves' },
        { permission_name: 'reject', key_name: 'leaves.reject', description: 'Can reject leave', moduleId: 'leaves' },
        { permission_name: 'read', key_name: 'attendance.read', description: 'Can view attendance', moduleId: 'attendance' },
        { permission_name: 'manage', key_name: 'attendance.manage', description: 'Can manage attendance', moduleId: 'attendance' },
        { permission_name: 'create', key_name: 'attendance.create', description: 'Can check-in/out', moduleId: 'attendance' },
        { permission_name: 'read', key_name: 'branches.read', description: 'Can view branches', moduleId: 'org-setup' },
        { permission_name: 'manage', key_name: 'branches.manage', description: 'Can manage branches', moduleId: 'org-setup' },
        { permission_name: 'view', key_name: 'organization.view', description: 'Can view organization details', moduleId: 'org-setup' },
        { permission_name: 'manage', key_name: 'organization.manage', description: 'Can manage organization', moduleId: 'org-setup' },
        { permission_name: 'read', key_name: 'policies.read', description: 'Can view policies', moduleId: 'org-setup' },
        { permission_name: 'manage', key_name: 'policies.manage', description: 'Can manage policies', moduleId: 'org-setup' },
        { permission_name: 'view', key_name: 'holidays.view', description: 'Can view holidays', moduleId: 'calendar' },
        { permission_name: 'create', key_name: 'holidays.create', description: 'Can create holidays', moduleId: 'calendar' },
        { permission_name: 'update', key_name: 'holidays.update', description: 'Can update holidays', moduleId: 'calendar' },
        { permission_name: 'delete', key_name: 'holidays.delete', description: 'Can delete holidays', moduleId: 'calendar' },
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

    // 3. Create Global Roles
    const rolesData = [
        { role_name: 'tenant admin', description: 'Tenant Administrator (Global Full Access)' },
        { role_name: 'CEO', description: 'Chief Executive Officer' },
        { role_name: 'employee', description: 'Standard Employee' },
        { role_name: 'Manager', description: 'Manager' },
        { role_name: 'finance', description: 'Finance / Accountant' },
        { role_name: 'hr', description: 'Human Resources' },
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
    console.log('✔ Global Roles seeded.');

    // 4. Map Permissions based on roles (Global Scope Assignment)
    const excludedKeys = [
        'employees.create', 'employees.update', 'employees.delete', // Employee Management
        'branches.manage', 'departments.manage', 'organization.manage', // Company Structure
        'roles.manage', 'users.create', 'users.read', 'users.update', 'users.delete' // System Settings
    ];

    const adminManagerPermissions = createdPermissions.filter(p => !excludedKeys.includes(p.key_name!));
    const employeePermissions = createdPermissions.filter(p => 
        ['employees.read', 'leaves.apply', 'leaves.read', 'attendance.read', 'attendance.create', 'policies.read'].includes(p.key_name!)
    );

    const tenantAdminRoleObj = createdRoles.find(r => r.role_name === 'tenant admin')!;
    const ceoRoleObj = createdRoles.find(r => r.role_name === 'CEO')!;
    const hrRoleObj = createdRoles.find(r => r.role_name === 'hr')!;
    const financeRoleObj = createdRoles.find(r => r.role_name === 'finance')!;
    const managerRoleObj = createdRoles.find(r => r.role_name === 'Manager')!;
    const employeeRoleObj = createdRoles.find(r => r.role_name === 'employee')!;

    const rolePermissionMap = [
        { role: tenantAdminRoleObj, permissions: createdPermissions, scope: 'GLOBAL' },
        { role: ceoRoleObj, permissions: createdPermissions, scope: 'GLOBAL' },
        { role: hrRoleObj, permissions: adminManagerPermissions, scope: 'GLOBAL' },
        { role: financeRoleObj, permissions: adminManagerPermissions, scope: 'GLOBAL' },
        { role: managerRoleObj, permissions: adminManagerPermissions, scope: 'GLOBAL' },
        { role: employeeRoleObj, permissions: employeePermissions, scope: 'OWN' },
    ];

    for (const { role, permissions, scope } of rolePermissionMap) {
        await prisma.rolePermission.deleteMany({
            where: { role_id: role.id }
        });

        for (const perm of permissions) {
            await prisma.rolePermission.create({
                data: {
                    role_id: role.id,
                    permission_id: perm.id,
                    scope: scope as any,
                },
            });
        }
    }
    console.log('✔ Global Role-permissions mapped.');

    // 5. Seed Feature Modules (For Frontend Subscriptions check)
    const moduleCodes = [
        { code: 'COMPANY_STRUCTURE',   name: 'Company Structure' },
        { code: 'EMPLOYEE_MANAGEMENT', name: 'Employee Management' },
        { code: 'TIME_ATTENDANCE',     name: 'Time & Attendance' },
        { code: 'TEAM_CALENDAR',       name: 'Team Calendar' },
        { code: 'PAYROLL',             name: 'Payroll' },
        { code: 'LOANS_ADVANCES',      name: 'Loans & Advances' },
        { code: 'SURVEY',              name: 'Surveys' },
        { code: 'NOTIFICATIONS',       name: 'Notifications' },
        { code: 'DOC_HUB',             name: 'Document Hub' },
        { code: 'COMPANY_NEWS',        name: 'Company News' },
        { code: 'REPORT_BUILDER',      name: 'Report Builder' },
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

    // 6. Seed Editions (Subscriptions)
    const editions = [
        { code: 'ENTERPRISE', name: 'Enterprise', description: 'All modules enabled', modules: moduleCodes.map(m => m.code) },
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
    console.log('✔ Editions (Enterprise Subscription) seeded.');

    // 7. Seed Default Tenant pointing to Enterprise Subscription
    const enterprise = await prisma.editions.findUnique({ where: { code: 'ENTERPRISE' } });
    await prisma.tenants.upsert({
        where: { id: 1 },
        update: { editionId: enterprise!.id },
        create: { id: 1, name: 'Default Tenant', editionId: enterprise!.id },
    });
    console.log('✔ Default Tenant Subscription seeded (Enterprise).');

    // 8. Create Organization (Rafiki Microfinance)
    const org = await prisma.organization.upsert({
        where: { slug: 'rafiki' },
        update: {
            tin: 'TZ-1234567890',
            other_tax_id: '{"cin":"BRELA-987654"}',
        },
        create: {
            entity_name: 'Rafiki',
            company_code: 'RAFIKI',
            company_type: 'Sole Proprietorship',
            slug: 'rafiki',
            jurisdiction: 'Tanzania',
            currency: 'TZS',
            fiscal_year_end: 'December',
            tin: 'TZ-1234567890',
            other_tax_id: '{"cin":"BRELA-987654"}',
            address: 'Plot 123, Samora Avenue',
            city: 'Dar es Salaam',
            state: 'Dar es Salaam',
            country: 'Tanzania',
            zip: '11101',
            standard_working_hours_per_week: 40,
            working_days: JSON.parse('["Monday","Tuesday","Wednesday","Thursday","Friday"]'),
            public_holidays: JSON.parse('[]'),
            pay_frequency: 'Monthly',
            schedule_type: 'fixed',
            fixed_start_time: '08:00',
            fixed_end_time: '17:00',
            fixed_break_time: 60,
        },
    });
    console.log('✔ Organization seeded (Rafiki Microfinance).');

    // 9. Create Branch (Head Office)
    const branch = await prisma.branch.create({
        data: {
            organization_id: org.id,
            branch_name: 'Dar es Salaam HQ',
            branch_code: 'DSM-HQ',
            address: 'Plot 123, Samora Avenue',
            city: 'Dar es Salaam',
            state: 'Dar es Salaam',
            zip: '11101',
            country: 'Tanzania',
            time_zone: 'Africa/Dar_es_Salaam',
            tax_location: 'Dar es Salaam',
        },
    });
    console.log('✔ Branch seeded (Dar es Salaam HQ).');

    // 10. Create Department (Administration)
    const deptAdmin = await prisma.department.create({
        data: {
            department_name: 'Administration',
            department_code: 'ADMIN',
            branch_id: branch.id,
            description: 'Corporate Administration',
        },
    });
    console.log('✔ Department seeded (Administration).');

    // 11. Create Designation (System Administrator)
    const desigAdmin = await prisma.designation.create({
        data: {
            designation_name: 'System Administrator',
            designation_code: 'SYSADMIN',
            department_id: deptAdmin.id,
            organization_id: org.id,
        },
    });
    console.log('✔ Designation seeded (System Administrator).');

    // 12. Create Org-scoped Roles for Rafiki Microfinance
    const orgRolesToCreate = [
        { role_name: 'tenant admin', description: 'Tenant Administrator for Rafiki Microfinance', isFullAccess: true },
        { role_name: 'CEO', description: 'CEO for Rafiki Microfinance', isFullAccess: true },
        { role_name: 'hr', description: 'HR for Rafiki Microfinance', isFullAccess: false },
        { role_name: 'finance', description: 'Finance for Rafiki Microfinance', isFullAccess: false },
        { role_name: 'Manager', description: 'Manager for Rafiki Microfinance', isFullAccess: false },
        { role_name: 'employee', description: 'Employee for Rafiki Microfinance', isFullAccess: false },
    ];

    const seededOrgRoles: Record<string, any> = {};

    for (const item of orgRolesToCreate) {
        const createdOrgRole = await prisma.role.create({
            data: {
                role_name: item.role_name,
                organization_id: org.id,
                description: item.description,
            },
        });
        seededOrgRoles[item.role_name] = createdOrgRole;

        // Assign permissions
        const permsToAssign = item.isFullAccess 
            ? createdPermissions 
            : item.role_name === 'employee' 
                ? employeePermissions 
                : adminManagerPermissions;

        const scope = item.role_name === 'employee' ? 'OWN' : 'GLOBAL';

        for (const perm of permsToAssign) {
            await prisma.rolePermission.create({
                data: {
                    role_id: createdOrgRole.id,
                    permission_id: perm.id,
                    scope,
                },
            });
        }
    }
    console.log('✔ Org-scoped roles seeded.');

    // 13. Create User Types for the organization
    const userTypesData = [
        { name: 'Admin', system_key: 'ADMIN', description: 'Administrative access' },
        { name: 'Employee', system_key: 'EMPLOYEE', description: 'Standard employee access' },
        { name: 'HR Head', system_key: 'HR_HEAD', description: 'HR department head' },
        { name: 'Finance Manager', system_key: 'FINANCE_MANAGER', description: 'Finance department manager' },
        { name: 'Manager', system_key: 'MANAGER', description: 'Reporting manager access' },
    ];

    let adminUserTypeId: number | null = null;
    for (const ut of userTypesData) {
        const typeRecord = await prisma.user_types.create({
            data: {
                organization_id: org.id,
                name: ut.name,
                system_key: ut.system_key,
                description: ut.description,
            },
        });
        if (ut.system_key === 'ADMIN') adminUserTypeId = typeRecord.id;
    }
    console.log('✔ User types seeded.');

    // 14. Create OrganizationConfig (Tanzania Primary Color: #2153e8)
    await prisma.organizationConfig.create({
        data: {
            organization_id: org.id,
            primary_color: '#2153e8',
            secondary_color: '#1e40af',
            sso_provider: 'local',
            mfa_policy: 'email_otp',
            mfa_required_admins: true,
        },
    });
    console.log('✔ Organization config seeded.');

    // 15. Create Admin User linked to the organization (with tenant admin role)
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
                    employee_id: 'RAFIKI-001',
                    role_id: seededOrgRoles['tenant admin'].id,
                    department_id: deptAdmin.id,
                    designation_id: desigAdmin.id,
                    user_type_id: adminUserTypeId!,
                    employment_type: 'Full-Time',
                    start_date: new Date(),
                    joining_date: new Date(),
                    work_location: 'Dar es Salaam HQ',
                    country: 'Tanzania',
                    base_salary: 100000,
                    currency: 'TZS',
                    salary_frequency: 'Monthly',
                },
            },
        },
    });
    console.log('✔ Admin User seeded (linked to organization).');

    // Assign Tenant Admin Role in UserRole table
    await prisma.userRole.upsert({
        where: { user_id_role_id: { user_id: adminUser.id, role_id: seededOrgRoles['tenant admin'].id } },
        update: {},
        create: { user_id: adminUser.id, role_id: seededOrgRoles['tenant admin'].id },
    });

    console.log('\n🎉 Successfully seeded complete database bootstrap!');
    console.log('Organization: Rafiki Microfinance (slug: rafiki)');
    console.log('Branch: Dar es Salaam HQ');
    console.log('Department: Administration');
    console.log('Login credentials for Tenant Admin:');
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
