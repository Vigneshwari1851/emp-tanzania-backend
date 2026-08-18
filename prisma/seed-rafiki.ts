import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Seed started for Rafiki organization (Tanzania focus)...');

    // 0. Seed System Settings (Statutory Configs for Tanzania)
    const systemSettingsData = [
        // --- Tanzania NSSF (10% employee + 10% employer, no ceiling) ---
        { key: 'TZ_NSSF_EMPLOYEE_RATE', value: '0.10' },
        { key: 'TZ_NSSF_EMPLOYER_RATE', value: '0.10' },
        { key: 'TZ_NSSF_WAGE_CEILING', value: '999999999' },
        // --- Tanzania SDL (3.5% employer-only, 10+ employees) ---
        { key: 'TZ_SDL_RATE', value: '0.035' },
        { key: 'TZ_SDL_MIN_EMPLOYEES', value: '10' },
        // --- Tanzania WCF (0.6% employer) ---
        { key: 'TZ_WCF_RATE', value: '0.006' },
        // --- Tanzania HESLB (15% of basic salary) ---
        { key: 'TZ_HESLB_RATE', value: '0.15' },
        // --- Tanzania PAYE monthly tax bands (TZS) ---
        // [upper_limit, rate] — processed sequentially
        { key: 'TZ_PAYE_BANDS', value: '[[270000,0],[520000,0.08],[760000,0.20],[1000000,0.25],[null,0.30]]' },
        // --- Tanzania PAYE monthly reliefs (TZS) ---
        { key: 'TZ_PERSONAL_RELIEF', value: '16250' },        // 195,000/yr = 16,250/mo
        { key: 'TZ_INSURANCE_RELIEF', value: '1250' },        // 15,000/yr = 1,250/mo
        { key: 'TZ_MORTGAGE_RELIEF_MAX', value: '40000' },    // max 40,000/mo
        { key: 'TZ_DISABLED_PERSON_RELIEF', value: '16250' },  // 195,000/yr
        // --- Non-resident flat rate ---
        { key: 'TZ_NON_RESIDENT_RATE', value: '0.15' },
        // --- Overtime ---
        { key: 'OVERTIME_MULTIPLIER', value: '1.5' },
        { key: 'TZ_OVERTIME_HOLIDAY_MULTIPLIER', value: '2.0' },
        // --- Legacy India keys (zeroed out for TZ context) ---
        { key: 'EPF_WAGE_CEILING', value: '0' },
        { key: 'EPF_EMPLOYEE_RATE', value: '0' },
        { key: 'EPF_EMPLOYER_EPS_RATE', value: '0' },
        { key: 'EPF_EMPLOYER_EPF_RATE', value: '0' },
        { key: 'ESI_WAGE_CEILING', value: '0' },
        { key: 'ESI_EMPLOYEE_RATE', value: '0' },
        { key: 'ESI_EMPLOYER_RATE', value: '0' },
        { key: 'GRATUITY_YEARS_THRESHOLD', value: '0' },
        { key: 'GRATUITY_MULTIPLIER', value: '0' },
        { key: 'GRATUITY_DIVISOR', value: '26' },
        { key: 'LEAVE_ENCASHMENT_DIVISOR', value: '30' },
        { key: 'STANDARD_DEDUCTION_OLD', value: '0' },
        { key: 'STANDARD_DEDUCTION_NEW', value: '0' },
        { key: 'HRA_METRO_PERCENT', value: '0' },
        { key: 'HRA_NON_METRO_PERCENT', value: '0' },
        { key: 'HRA_RENT_BASIC_PERCENT', value: '0' },
        { key: 'GLOBAL_80C_LIMIT', value: '0' },
        { key: 'REBATE_87A_LIMIT_OLD', value: '0' },
        { key: 'REBATE_87A_AMOUNT_OLD', value: '0' },
        { key: 'REBATE_87A_LIMIT_NEW', value: '0' },
        { key: 'REBATE_87A_AMOUNT_NEW', value: '0' },
        // Legacy tax slab keys (kept for backward compat, same as TZ bands)
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

    // 0b. Seed TZ-specific Tax Declaration Sections
    const tzTaxSections = [
        {
            section: 'INSURANCE',
            label: 'Insurance Relief',
            limit: 300000,  // TSh 300,000/yr max
            instruments: ['Life Insurance Premium', 'Health Insurance Premium', 'Education Insurance Premium'],
            status: true,
        },
        {
            section: 'MORTGAGE',
            label: 'Mortgage Interest Relief',
            limit: 480000,  // TSh 480,000/yr max (40k x 12)
            instruments: ['Primary Residence Mortgage Interest'],
            status: true,
        },
        {
            section: 'DISABLED',
            label: 'Disabled Person Relief',
            limit: 195000,  // TSh 195,000/yr
            instruments: ['Certified Disability'],
            status: true,
        },
        {
            section: 'DEPENDANTS',
            label: 'Dependant Relief',
            limit: 195000,  // TSh 195,000 per dependant (max 4 dependants)
            instruments: ['Child Under 18', 'Child in Full-Time Education', 'Dependant Spouse'],
            status: true,
        },
        {
            section: 'VOLUNTARY_PENSION',
            label: 'Voluntary Pension (Beyond NSSF)',
            limit: 600000,  // TSh 600,000/yr (50k x 12)
            instruments: ['Voluntary Pension Contribution', 'Approved Pension Fund'],
            status: true,
        },
    ];

    for (const sec of tzTaxSections) {
        const existing = await prisma.taxSection.findFirst({
            where: { section: sec.section },
        });
        if (!existing) {
            await prisma.taxSection.create({ data: sec });
        } else {
            await prisma.taxSection.update({
                where: { id: existing.id },
                data: sec,
            });
        }
    }
    console.log('✔ TZ tax declaration sections seeded (INSURANCE, MORTGAGE, DISABLED, DEPENDANTS, VOLUNTARY_PENSION).');

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

        // Payroll
        { permission_name: 'view', key_name: 'payroll.view', description: 'Can view payroll', moduleId: 'payroll' },
        { permission_name: 'manage', key_name: 'payroll.manage', description: 'Can manage payroll', moduleId: 'payroll' },
        { permission_name: 'process', key_name: 'payroll.process', description: 'Can process payroll', moduleId: 'payroll' },

        // Loans & Advances
        { permission_name: 'view', key_name: 'loans-advances.view', description: 'Can view loans & advances', moduleId: 'loans-advances' },
        { permission_name: 'manage', key_name: 'loans-advances.manage', description: 'Can manage loans & advances', moduleId: 'loans-advances' },

        // Company News
        { permission_name: 'view', key_name: 'news.view', description: 'Can view company news', moduleId: 'news' },
        { permission_name: 'manage', key_name: 'news.manage', description: 'Can manage company news', moduleId: 'news' },
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
        const mod = await prisma.featureModule.upsert({
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
        const edition = await prisma.edition.upsert({
            where: { code: ed.code },
            update: { name: ed.name, description: ed.description },
            create: { code: ed.code, name: ed.name, description: ed.description },
        });

        for (const modCode of ed.modules) {
            await prisma.editionModule.upsert({
                where: { editionId_featureModuleId: { editionId: edition.id, featureModuleId: moduleMap[modCode]! } },
                update: {},
                create: { editionId: edition.id, featureModuleId: moduleMap[modCode]! },
            });
        }
    }
    console.log('✔ Editions (Enterprise Subscription) seeded.');

    // 7. Seed Default Tenant pointing to Enterprise Subscription
    const enterprise = await prisma.edition.findUnique({ where: { code: 'ENTERPRISE' } });
    await prisma.tenant.upsert({
        where: { id: 1 },
        update: { editionId: enterprise!.id },
        create: { id: 1, tenantCode: 'rafiki', name: 'Default Tenant', editionId: enterprise!.id, billingEmail: 'billing@rafiki.com', status: 'ACTIVE' },
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
            tenantId: 1,
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
            standard_working_hours_per_week: 45,
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
    const existingDesig = await prisma.designation.findFirst({
        where: { organization_id: org.id, designation_code: 'SYSADMIN' },
    });
    const desigAdmin = existingDesig
        ? await prisma.designation.update({
            where: { id: existingDesig.id },
            data: { department_id: deptAdmin.id },
        })
        : await prisma.designation.create({
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
        const existingRole = await prisma.role.findFirst({
            where: { organization_id: org.id, role_name: item.role_name },
        });
        const createdOrgRole = existingRole
            ? await prisma.role.update({
                where: { id: existingRole.id },
                data: { description: item.description },
            })
            : await prisma.role.create({
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

        // Clear existing permissions for this role first
        await prisma.rolePermission.deleteMany({ where: { role_id: createdOrgRole.id } });

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
        const existing = await prisma.user_types.findFirst({
            where: { organization_id: org.id, name: ut.name },
        });
        const typeRecord = existing
            ? await prisma.user_types.update({
                where: { id: existing.id },
                data: { system_key: ut.system_key, description: ut.description },
            })
            : await prisma.user_types.create({
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
    const existingOrgConfig = await prisma.organizationConfig.findFirst({
        where: { organization_id: org.id },
    });
    if (existingOrgConfig) {
        await prisma.organizationConfig.update({
            where: { id: existingOrgConfig.id },
            data: {
                primary_color: '#2153e8',
                secondary_color: '#1e40af',
                sso_provider: 'local',
                mfa_policy: 'email_otp',
                mfa_required_admins: true,
            },
        });
    } else {
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
    }
    console.log('✔ Organization config seeded.');

    // 14b. Seed Tanzania Statutory Leave Policies
    const tzLeavePolicies = [
        {
            policy_name: 'Tanzania Maternity Leave',
            leave_type: 'Maternity',
            days_per_year: 84,
            carry_forward_days: 0,
            leave_category: 'paid',
            requires_document: true,
            description: 'Tanzania statutory maternity leave: 84 days fully paid. 100 days for multiple births (configure separately).',
        },
        {
            policy_name: 'Tanzania Maternity Leave (Multiple Births)',
            leave_type: 'Maternity',
            days_per_year: 100,
            carry_forward_days: 0,
            leave_category: 'paid',
            requires_document: true,
            description: 'Tanzania statutory maternity leave for multiple births: 100 days fully paid.',
        },
        {
            policy_name: 'Tanzania Paternity Leave',
            leave_type: 'Paternity',
            days_per_year: 3,
            carry_forward_days: 0,
            leave_category: 'paid',
            requires_document: true,
            description: 'Tanzania statutory paternity leave: 3 paid days, must be taken within 7 days of childbirth.',
        },
        {
            policy_name: 'Annual Leave',
            leave_type: 'Annual',
            days_per_year: 28,
            carry_forward_days: 7,
            leave_category: 'paid',
            requires_document: false,
            description: 'Tanzania Employment Act: 28 working days annual leave for employees with 12+ months of service.',
        },
        {
            policy_name: 'Sick Leave',
            leave_type: 'Sick',
            days_per_year: 126,
            carry_forward_days: 0,
            leave_category: 'paid',
            requires_document: true,
            description: 'Tanzania Employment Act: Up to 126 days sick leave (first 3 months paid, remainder unpaid).',
        },
    ];

    for (const policy of tzLeavePolicies) {
        await prisma.leavePolicy.upsert({
            where: { policy_name: policy.policy_name },
            update: {},
            create: policy,
        });
    }
    console.log('✔ Tanzania Statutory Leave Policies seeded.');

    // 15. Create Admin User linked to the organization (with tenant admin role)
    const adminPassword = await bcrypt.hash('password123', 10);
    const adminUser = await prisma.user.upsert({
        where: { tenantId_email: { tenantId: 1, email: 'admin@rafiki.com' } },
        update: { password: adminPassword },
        create: {
            tenantId: 1,
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
