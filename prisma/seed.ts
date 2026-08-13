import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Seed started...');

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
    console.log('System settings seeded.');

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

    // 2. Create Permissions
    const permissionsData = [
        // Employee Management
        { permission_name: 'create', key_name: 'employees.create', description: 'Can create employees', moduleId: 'employees' },
        { permission_name: 'read', key_name: 'employees.read', description: 'Can view employees', moduleId: 'employees' },
        { permission_name: 'update', key_name: 'employees.update', description: 'Can update employees', moduleId: 'employees' },
        { permission_name: 'delete', key_name: 'employees.delete', description: 'Can delete employees', moduleId: 'employees' },

        // Role & Permission Management
        { permission_name: 'manage', key_name: 'roles.manage', description: 'Can manage roles', moduleId: 'roles' },
        { permission_name: 'read', key_name: 'roles.read', description: 'Can view roles', moduleId: 'roles' },

        // User Management
        { permission_name: 'create', key_name: 'users.create', description: 'Can create users', moduleId: 'users' },
        { permission_name: 'read', key_name: 'users.read', description: 'Can view users', moduleId: 'users' },
        { permission_name: 'update', key_name: 'users.update', description: 'Can update users', moduleId: 'users' },
        { permission_name: 'delete', key_name: 'users.delete', description: 'Can delete users', moduleId: 'users' },

        // Department Management
        { permission_name: 'manage', key_name: 'departments.manage', description: 'Can manage departments', moduleId: 'departments' },
        { permission_name: 'read', key_name: 'departments.read', description: 'Can view departments', moduleId: 'departments' },

        // Leave Management
        { permission_name: 'apply', key_name: 'leaves.apply', description: 'Can apply for leave', moduleId: 'leaves' },
        { permission_name: 'approve', key_name: 'leaves.approve', description: 'Can approve leave', moduleId: 'leaves' },
        { permission_name: 'reject', key_name: 'leaves.reject', description: 'Can reject leave', moduleId: 'leaves' },

        // Attendance
        { permission_name: 'read', key_name: 'attendance.read', description: 'Can view attendance', moduleId: 'attendance' },
        { permission_name: 'manage', key_name: 'attendance.manage', description: 'Can manage attendance', moduleId: 'attendance' },
        { permission_name: 'create', key_name: 'attendance.create', description: 'Can check-in/out', moduleId: 'attendance' },

        // Branches
        { permission_name: 'read', key_name: 'branches.read', description: 'Can view branches', moduleId: 'branches' },
        { permission_name: 'manage', key_name: 'branches.manage', description: 'Can manage branches', moduleId: 'branches' },

        // Organization
        { permission_name: 'view', key_name: 'organization.view', description: 'Can view organization details', moduleId: 'organization' },
        { permission_name: 'manage', key_name: 'organization.manage', description: 'Can manage organization', moduleId: 'organization' },

        // Policies
        { permission_name: 'read', key_name: 'policies.read', description: 'Can view policies', moduleId: 'policies' },
        { permission_name: 'manage', key_name: 'policies.manage', description: 'Can manage policies', moduleId: 'policies' },

        // Holidays
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

    // 3. Create Roles
    const rolesData = [
        { role_name: 'super admin', description: 'Full access to the system' },
        { role_name: 'admin', description: 'Administrative access' },
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

    const rolePermissionMap = [
        { role: createdRoles[1]!, permissions: adminManagerPermissions }, // admin
        { role: createdRoles[2]!, permissions: adminManagerPermissions }, // manager
        { role: createdRoles[3]!, permissions: userPermissions }, // user
    ];

    for (const { role, permissions } of rolePermissionMap) {
        // Clear existing permissions for this role to ensure we only have what's specified
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

    // 6. Create Super Admin User
    const hashedPassword = await bcrypt.hash('12345678', 10);
    const superAdmin = await prisma.user.upsert({
        where: { email: 'superadmin@gmail.com' },
        update: { password: hashedPassword },
        create: {
            username: 'superAdmin',
            email: 'superadmin@gmail.com',
            password: hashedPassword,
            status: true,
        },
    });

    // Assign All Roles to Super Admin User
    for (const role of createdRoles) {
        await prisma.userRole.upsert({
            where: {
                user_id_role_id: {
                    user_id: superAdmin.id,
                    role_id: role.id,
                },
            },
            update: {},
            create: {
                user_id: superAdmin.id,
                role_id: role.id,
            },
        });
    }

    // 7. Create South Indian Banks
    const banksData = [
        "State Bank of India", "Canara Bank", "Union Bank of India", "Indian Bank",
        "Bank of Baroda", "Punjab National Bank", "Indian Overseas Bank", "UCO Bank",
        "Bank of India", "Central Bank of India", "Bank of Maharashtra", "HDFC Bank",
        "ICICI Bank", "Axis Bank", "Federal Bank", "South Indian Bank",
        "Karnataka Bank", "Karur Vysya Bank", "Tamilnad Mercantile Bank", "Lakshmi Vilas Bank",
        "City Union Bank", "Catholic Syrian Bank", "Dhanlaxmi Bank", "Kalyan Janata Sahakari Bank",
        "Saraswat Bank", "SVC Bank", "IDBI Bank", "Kotak Mahindra Bank",
        "IDFC FIRST Bank", "IndusInd Bank", "Yes Bank", "Bandhan Bank",
        "RBL Bank", "Standard Chartered Bank", "HSBC India", "Citibank India",
        "Deutsche Bank India", "DBS Bank India", "JPMorgan Chase Bank", "Barclays Bank",
        "Karnataka Gramin Bank", "Kerala Gramin Bank", "Tamil Nadu Grama Bank", "Andhra Pragathi Grameena Bank",
        "Chaitanya Godavari Grameena Bank", "Sapthagiri Grameena Bank", "Telangana Grameena Bank", "Andhra Pradesh Grameena Vikas Bank",
        "Pallavan Grama Bank", "Pandyan Grama Bank"
    ];

    for (const name of banksData) {
        await prisma.bank.upsert({
            where: { name },
            update: {},
            create: { name }
        });
    }

    // 8. Create Salary Components
    const componentsData = [
        { name: 'Basic Salary', type: 'earning', calculation_type: 'percentage', value: 40, is_taxable: true, is_statutory: false },
        { name: 'HRA', type: 'earning', calculation_type: 'percentage', value: 20, is_taxable: true, is_statutory: false },
        { name: 'Special Allowance', type: 'earning', calculation_type: 'percentage', value: 30, is_taxable: true, is_statutory: false },
        { name: 'PF Employee', type: 'deduction', calculation_type: 'percentage', value: 12, is_taxable: false, is_statutory: true },
        { name: 'Professional Tax', type: 'deduction', calculation_type: 'fixed', value: 200, is_taxable: false, is_statutory: true },
    ];

    const createdComponents = [];
    for (const comp of componentsData) {
        let c = await prisma.salaryComponent.findFirst({
            where: { name: comp.name }
        });
        if (!c) {
            c = await prisma.salaryComponent.create({
                data: comp
            });
        } else {
            c = await prisma.salaryComponent.update({
                where: { id: c.id },
                data: comp
            });
        }
        createdComponents.push(c);
    }

    // 9. Create Salary Structures
    const structuresData = [
        { name: 'Software Engineer Standard', level: 'role' },
        { name: 'Senior Developer Standard', level: 'role' },
    ];

    for (const struct of structuresData) {
        let s = await prisma.salaryStructure.findFirst({
            where: { name: struct.name }
        });
        if (!s) {
            s = await prisma.salaryStructure.create({
                data: struct
            });
        } else {
            s = await prisma.salaryStructure.update({
                where: { id: s.id },
                data: struct
            });
        }

        // Assign components to structures
        for (let i = 0; i < createdComponents.length; i++) {
            await prisma.salaryStructureComponent.upsert({
                where: {
                    salary_structure_id_salary_component_id: {
                        salary_structure_id: s.id,
                        salary_component_id: createdComponents[i]!.id
                    }
                },
                update: { order: i },
                create: {
                    salary_structure_id: s.id,
                    salary_component_id: createdComponents[i]!.id,
                    order: i
                }
            });
        }
    }

    // 10. Create Tax Sections
    const taxSectionsData = [
        { section: '80C', label: 'Life Insurance, PPF, ELSS, etc.', limit: 150000, instruments: ['PPF', 'ELSS', 'LIC', 'Children Tuition Fee'] },
        { section: '80D', label: 'Medical Insurance Premia', limit: 25000, instruments: ['Self/Family Health Insurance', 'Preventive Health Checkup'] },
        { section: '24(b)', label: 'Interest on Home Loan', limit: 200000, instruments: ['Self Occupied Property Interest'] },
        { section: '80CCD(1B)', label: 'NPS Contribution', limit: 50000, instruments: ['NPS Tier 1'] },
    ];

    for (const sec of taxSectionsData) {
        const existing = await prisma.taxSection.findFirst({
            where: { section: sec.section }
        });
        if (!existing) {
            await prisma.taxSection.create({
                data: sec
            });
        } else {
            await prisma.taxSection.update({
                where: { id: existing.id },
                data: sec
            });
        }
    }

    // 11. Create Reimbursement Types
    const reimbusData = [
        { type: 'Fuel', label: 'Fuel and Maintenance', limit: 3000, period: 'Monthly' },
        { type: 'Medical', label: 'Medical Reimbursement', limit: 15000, period: 'Annually' },
        { type: 'Travel', label: 'Business Travel Claims', limit: 50000, period: 'Monthly' },
        { type: 'Food', label: 'Monthly Food Coupons', limit: 2200, period: 'Monthly' },
    ];

    for (const r of reimbusData) {
        const existing = await prisma.reimbursementType.findFirst({
            where: { type: r.type }
        });
        if (!existing) {
            await prisma.reimbursementType.create({
                data: r
            });
        } else {
            await prisma.reimbursementType.update({
                where: { id: existing.id },
                data: r
            });
        }
    }

    // 12. Create Payroll Groups
    const groupData = [
        { name: 'Mumbai - Engineering', criteria: 'Location: Mumbai, Dept: Engineering' },
        { name: 'Delhi - Sales', criteria: 'Location: Delhi, Dept: Sales' },
    ];

    for (const g of groupData) {
        const existing = await prisma.payrollGroup.findFirst({
            where: { name: g.name }
        });
        if (!existing) {
            await prisma.payrollGroup.create({
                data: g
            });
        } else {
            await prisma.payrollGroup.update({
                where: { id: existing.id },
                data: g
            });
        }
    }

    // 13. Create Pay Cycle
    await prisma.payCycle.upsert({
        where: { id: 1 },
        update: {},
        create: {
            frequency: 'Monthly',
            pay_day: 'Last Day',
            attendance_start_day: '1',
            attendance_end_day: '30',
            cutoff_day: '25'
        }
    });

    // 13.5. Seed State Professional Tax slabs
    const statePtData = [
        {
            state: 'Maharashtra',
            slabs: [
                { min: 0, max: 7500, amount: 0 },
                { min: 7501, max: 10000, amount: 175 },
                { min: 10001, max: null, amount: 200 }
            ]
        },
        {
            state: 'Karnataka',
            slabs: [
                { min: 0, max: 25000, amount: 0 },
                { min: 25001, max: null, amount: 200 }
            ]
        },
        {
            state: 'Tamil Nadu',
            slabs: [
                { min: 0, max: 21000, amount: 0 },
                { min: 21001, max: 30000, amount: 22.50 },
                { min: 30001, max: 45000, amount: 52.50 },
                { min: 45001, max: 60000, amount: 115 },
                { min: 60001, max: 75000, amount: 171 },
                { min: 75001, max: null, amount: 208 }
            ]
        },
        {
            state: 'Andhra Pradesh',
            slabs: [
                { min: 0, max: 15000, amount: 0 },
                { min: 15001, max: 20000, amount: 150 },
                { min: 20001, max: null, amount: 200 }
            ]
        },
        {
            state: 'Telangana',
            slabs: [
                { min: 0, max: 15000, amount: 0 },
                { min: 15001, max: 20000, amount: 150 },
                { min: 20001, max: null, amount: 200 }
            ]
        },
        {
            state: 'Gujarat',
            slabs: [
                { min: 0, max: 6000, amount: 0 },
                { min: 6001, max: 9000, amount: 80 },
                { min: 9001, max: 12000, amount: 150 },
                { min: 12001, max: null, amount: 200 }
            ]
        },
        {
            state: 'West Bengal',
            slabs: [
                { min: 0, max: 10000, amount: 0 },
                { min: 10001, max: 15000, amount: 110 },
                { min: 15001, max: 25000, amount: 130 },
                { min: 25001, max: 40000, amount: 150 },
                { min: 40001, max: null, amount: 200 }
            ]
        },
        {
            state: 'Madhya Pradesh',
            slabs: [
                { min: 0, max: 18750, amount: 0 },
                { min: 18751, max: 25000, amount: 125 },
                { min: 25001, max: null, amount: 208 }
            ]
        },
        {
            state: 'Odisha',
            slabs: [
                { min: 0, max: 13300, amount: 0 },
                { min: 13301, max: 25000, amount: 125 },
                { min: 25001, max: null, amount: 208 }
            ]
        }
    ];

    for (const item of statePtData) {
        await prisma.stateProfessionalTax.upsert({
            where: { state: item.state },
            update: { slabs: item.slabs },
            create: item
        });
    }
    console.log('State Professional Tax slabs seeded.');

    // 14. Create Demo Organization Structure
    const org = await prisma.organization.upsert({
        where: { id: 1 },
        update: {},
        create: {
            slug: 'socedge',
            entity_name: 'SocEdge Technologies',
            company_code: 'SET001',
            currency: 'INR',
            address: '123 Tech Park, HSR Layout',
            city: 'Bangalore',
            state: 'Karnataka',
            country: 'India',
            zip: '560102',
            standard_working_hours_per_week: 40,
            working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            public_holidays: []
        }
    });

    const branch = await prisma.branch.upsert({
        where: { id: 1 },
        update: {},
        create: {
            organization_id: org.id,
            branch_name: 'Bangalore HQ',
            branch_code: 'BLR01',
            address: '123 Tech Park, HSR Layout',
            city: 'Bangalore',
            state: 'Karnataka',
            zip: '560102',
            country: 'India',
            time_zone: 'IST',
            tax_location: 'Karnataka'
        }
    });

    const dept = await prisma.department.upsert({
        where: { id: 1 },
        update: {},
        create: {
            department_name: 'Engineering',
            department_code: 'ENG',
            branch_id: branch.id,
            description: 'Core Engineering Team'
        }
    });

    // 15. Create Demo Employee
    const demoEmployeePassword = await bcrypt.hash('password123', 10);
    const demoEmployee = await prisma.user.upsert({
        where: { email: 'employee@socedge.com' },
        update: { password: demoEmployeePassword },
        create: {
            username: 'john_doe',
            email: 'employee@socedge.com',
            password: demoEmployeePassword,
            status: true,
            details: {
                create: {
                    first_name: 'John',
                    last_name: 'Doe',
                    employee_id: 'EMP001',
                    department_id: dept.id,
                    role_id: createdRoles.find(r => r.role_name === 'user')?.id,
                    employment_type: 'Full-time',
                    start_date: new Date('2023-01-01'),
                    work_location: 'Bangalore',
                    base_salary: 80000,
                    currency: 'INR',
                    salary_frequency: 'Monthly',
                    bank_name: 'HDFC Bank',
                    account_number: '50100123456789',
                    ifsc_code: 'HDFC0000123'
                }
            }
        }
    });

    // Assign 'user' role to demo employee
    const userRole = createdRoles.find(r => r.role_name === 'user');
    if (userRole) {
        await prisma.userRole.upsert({
            where: {
                user_id_role_id: {
                    user_id: demoEmployee.id,
                    role_id: userRole.id
                }
            },
            update: {},
            create: {
                user_id: demoEmployee.id,
                role_id: userRole.id
            }
        });
    }

    // 16. Create Demo Payroll Data (only if not already present)
    const existingPayslips = await prisma.payslip.findFirst({
        where: { user_id: demoEmployee.id }
    });

    if (!existingPayslips) {
        const months = ['January 2026', 'February 2026', 'March 2026'];
        for (const month of months) {
            await prisma.payslip.create({
                data: {
                    user_id: demoEmployee.id,
                    month: month,
                    gross_amount: 80000,
                    deduction_amount: 5000,
                    net_amount: 75000,
                    status: 'Paid',
                    breakdown: {
                        earnings: [
                            { name: 'Basic Salary', amount: 40000 },
                            { name: 'HRA', amount: 20000 },
                            { name: 'Special Allowance', amount: 20000 }
                        ],
                        deductions: [
                            { name: 'PF', amount: 4800 },
                            { name: 'Professional Tax', amount: 200 }
                        ]
                    }
                }
            });
        }

        // Tax Declarations
        const taxDeclarations = [
            { section: '80C', instrument: 'PPF', amount: 50000, status: 'approved', financial_year: '2025-26' },
            { section: '80C', instrument: 'ELSS', amount: 30000, status: 'approved', financial_year: '2025-26' },
            { section: '80D', instrument: 'Self Health Insurance', amount: 15000, status: 'pending', financial_year: '2025-26' }
        ];

        for (const td of taxDeclarations) {
            await prisma.taxDeclaration.create({
                data: {
                    user_id: demoEmployee.id,
                    ...td,
                    submitted_on: new Date()
                }
            });
        }

        // Expense Claims
        const expenseClaims = [
            { type: 'Travel', amount: 2500, description: 'Client meeting travel', status: 'approved', expense_date: new Date('2026-03-15') },
            { type: 'Food', amount: 1200, description: 'Team lunch', status: 'pending', expense_date: new Date('2026-04-10') }
        ];

        for (const ec of expenseClaims) {
            await prisma.expenseClaim.create({
                data: {
                    user_id: demoEmployee.id,
                    ...ec,
                    submitted_on: new Date()
                }
            });
        }
    }

    // 17. Seed Asset Tracking Data
    console.log('🌱 Seeding Asset Tracking data...');

    // Categories
    const assetCategories = [
      { id: 1, name: 'Laptops', description: 'Company laptops and workstations', depreciation_rate: 20, useful_life_years: 5 },
      { id: 2, name: 'Monitors', description: 'Office monitors and displays', depreciation_rate: 15, useful_life_years: 7 },
      { id: 3, name: 'Mobile Devices', description: 'Phones and tablets', depreciation_rate: 25, useful_life_years: 3 },
      { id: 4, name: 'Furniture', description: 'Office chairs, desks, and fixtures', depreciation_rate: 10, useful_life_years: 10 },
      { id: 5, name: 'Accessories', description: 'Keyboards, mice, chargers, and peripherals', depreciation_rate: 30, useful_life_years: 3 },
      { id: 6, name: 'Networking', description: 'Routers, switches, and networking equipment', depreciation_rate: 15, useful_life_years: 5 },
      { id: 7, name: 'Servers', description: 'Rack servers and storage', depreciation_rate: 20, useful_life_years: 5 },
    ];

    for (const cat of assetCategories) {
      await prisma.assetCategory.upsert({
        where: { id: cat.id },
        update: { name: cat.name, description: cat.description },
        create: { ...cat, organization_id: org.id },
      });
    }

    console.log('✅ 7 Asset categories seeded.');

    // Locations
    const assetLocations = [
      { id: 1, name: 'Headquarters', location_type: 'OFFICE', address: 'Main Office, Tech Park, Coimbatore' },
      { id: 2, name: 'Warehouse A', location_type: 'WAREHOUSE', address: 'Storage Facility, Industrial Area' },
      { id: 3, name: 'Remote Office', location_type: 'REMOTE', address: 'Satellite Office, Chennai' },
    ];

    for (const loc of assetLocations) {
      await prisma.assetLocation.upsert({
        where: { id: loc.id },
        update: {},
        create: { ...loc, organization_id: org.id },
      });
    }

    console.log('✅ 3 Asset locations seeded.');

    // 20 Assets
    // 20 Assets
    const assetTemplates = [
      { 
        name: 'MacBook Pro 14"', 
        cat: 1, 
        prefix: 'MBP', 
        manufacturer: 'Apple', 
        model: 'MacBook Pro M3',
        specifications: { brand: 'Apple', model: 'MacBook Pro M3', processor: 'Apple M3 Max', ram: '32GB', storage: '1TB SSD', os_version: 'macOS Sonoma', mac_address: '00:1A:2B:3C:4D:5E', device_name: 'LTC-LAP-023' }
      },
      { 
        name: 'Dell XPS 15', 
        cat: 1, 
        prefix: 'XPS', 
        manufacturer: 'Dell', 
        model: 'XPS 15 9530',
        specifications: { brand: 'Dell', model: 'XPS 15 9530', processor: 'Intel Core i9', ram: '32GB', storage: '1TB SSD', os_version: 'Windows 11 Pro', mac_address: '10:4B:46:3C:9D:5A', device_name: 'LTC-LAP-024' }
      },
      { 
        name: 'ThinkPad X1 Carbon', 
        cat: 1, 
        prefix: 'TPX', 
        manufacturer: 'Lenovo', 
        model: 'X1 Carbon Gen 11',
        specifications: { brand: 'Lenovo', model: 'X1 Carbon Gen 11', processor: 'Intel Core i7', ram: '16GB', storage: '512GB SSD', os_version: 'Windows 11 Pro', mac_address: '2C:5B:46:3C:9D:44', device_name: 'LTC-LAP-025' }
      },
      { 
        name: 'LG 27" 4K Monitor', 
        cat: 2, 
        prefix: 'LG27', 
        manufacturer: 'LG', 
        model: '27UK850-W',
        specifications: { brand: 'LG', model: '27UK850-W', screen_size: '27 inch', resolution: '3840x2160 (4K)', port_types: 'HDMI, DisplayPort, USB-C' }
      },
      { 
        name: 'Dell UltraSharp 32"', 
        cat: 2, 
        prefix: 'DELL32', 
        manufacturer: 'Dell', 
        model: 'U3223QE',
        specifications: { brand: 'Dell', model: 'U3223QE', screen_size: '32 inch', resolution: '3840x2160 (4K)', port_types: 'HDMI, DisplayPort, USB-C' }
      },
      { 
        name: 'iPhone 15 Pro', 
        cat: 3, 
        prefix: 'IPH', 
        manufacturer: 'Apple', 
        model: 'iPhone 15 Pro',
        specifications: { brand: 'Apple', model: 'iPhone 15 Pro', imei_number: '358239058293021', sim_number: '899112233445566', mobile_number: '+91 9876543210', carrier: 'Airtel' }
      },
      { 
        name: 'Samsung S24 Ultra', 
        cat: 3, 
        prefix: 'SAM', 
        manufacturer: 'Samsung', 
        model: 'Galaxy S24 Ultra',
        specifications: { brand: 'Samsung', model: 'Galaxy S24 Ultra', imei_number: '358239058293999', sim_number: '899112233445511', mobile_number: '+91 9876543222', carrier: 'Jio' }
      },
      { 
        name: 'Herman Miller Aeron', 
        cat: 4, 
        prefix: 'HMA', 
        manufacturer: 'Herman Miller', 
        model: 'Aeron Size B',
        specifications: { brand: 'Herman Miller', model: 'Aeron Size B', accessory_type: 'Chair', compatibility: 'Ergonomic Support' }
      },
      { 
        name: 'Cisco Switch 24-Port', 
        cat: 6, 
        prefix: 'CSW', 
        manufacturer: 'Cisco', 
        model: 'Catalyst 1000-24T',
        specifications: { brand: 'Cisco', model: 'Catalyst 1000-24T', ip_address: '192.168.10.254', mac_address: '00:1A:2B:3C:4D:AA', firmware_version: 'IOS 15.2', port_count: 24 }
      },
      { 
        name: 'Keychron K2 Keyboard', 
        cat: 5, 
        prefix: 'KCH', 
        manufacturer: 'Keychron', 
        model: 'K2 V2 RGB',
        specifications: { brand: 'Keychron', model: 'K2 V2 RGB', accessory_type: 'Keyboard', compatibility: 'Windows, macOS, iOS' }
      },
    ];

    const statuses = ['AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'ASSIGNED', 'MAINTENANCE'];

    for (let i = 1; i <= 20; i++) {
      const template = assetTemplates[i % assetTemplates.length]!;
      const serialNumber = `${template.prefix}-${1000 + i}`;

      await prisma.asset.upsert({
        where: {
          serial_number_organization_id: {
            serial_number: serialNumber,
            organization_id: org.id,
          },
        },
        update: {
          specifications: template.specifications,
        } as any,
        create: {
          organization_id: org.id,
          name: `${template.name} #${i}`,
          category_id: template.cat,
          location_id: (i % 3) + 1,
          serial_number: serialNumber,
          asset_tag: `AT-${String(i).padStart(4, '0')}`,
          manufacturer: template.manufacturer,
          model: template.model,
          status: statuses[i % statuses.length]!,
          purchase_date: new Date(2024, (i % 12), 1),
          purchase_price: 50000 + i * 1000,
          warranty_expiry: new Date(2027, (i % 12), 1),
          depreciation_rate: 15,
          specifications: template.specifications,
        } as any,
      });
    }

    console.log('✅ 20 Assets seeded.');

    // Vendor
    await prisma.vendor.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        organization_id: org.id,
        name: 'TechSupply Inc.',
        contact_person: 'John Doe',
        email: 'sales@techsupply.com',
        phone: '+1-555-0100',
        address: '123 Vendor Lane, Business District',
        sla_terms: '24-hour response time for critical issues',
        performance_rating: 4.5,
        status: 'ACTIVE',
      },
    });

    console.log('✅ Sample vendor seeded.');

    console.log('Seed finished successfully.');
  }

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
