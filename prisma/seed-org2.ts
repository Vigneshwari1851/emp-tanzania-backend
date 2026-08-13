import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Seeding Org 2: TestCorp India...\n');

    // ─── 1. Organization ───────────────────────────────────────────────
    const org = await prisma.organization.create({
        data: {
            slug: 'testcorp',
            entity_name: 'TestCorp India Pvt Ltd',
            currency: 'INR',
            address: '123 Tech Park, Whitefield',
            city: 'Bangalore',
            state: 'Karnataka',
            country: 'India',
            zip: '560066',
            standard_working_hours_per_week: 45,
            working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            public_holidays: [],
            pan: 'AAACT1234A',
            company_code: 'TEST',
            company_type: 'Private Limited',
        }
    });
    console.log(`✅ Org created: ${org.entity_name} (ID: ${org.id})`);

    // ─── 2. Branch ─────────────────────────────────────────────────────
    const branch = await prisma.branch.create({
        data: {
            organization_id: org.id,
            branch_name: 'Bangalore HQ',
            branch_code: 'BLR-01',
            address: '123 Tech Park, Whitefield',
            city: 'Bangalore',
            state: 'Karnataka',
            zip: '560066',
            country: 'India',
            time_zone: 'Asia/Kolkata',
            tax_location: 'Karnataka',
        }
    });
    console.log(`✅ Branch created: ${branch.branch_name}`);

    // ─── 3. Departments ────────────────────────────────────────────────
    const deptEngineering = await prisma.department.create({
        data: { department_name: 'Engineering', department_code: 'ENG', branch_id: branch.id, description: 'Software Engineering' }
    });
    const deptSales = await prisma.department.create({
        data: { department_name: 'Sales', department_code: 'SAL', branch_id: branch.id, description: 'Sales & BD' }
    });
    const deptHR = await prisma.department.create({
        data: { department_name: 'HR', department_code: 'HR', branch_id: branch.id, description: 'Human Resources' }
    });
    const deptFinance = await prisma.department.create({
        data: { department_name: 'Finance', department_code: 'FIN', branch_id: branch.id, description: 'Finance & Accounts' }
    });
    console.log(`✅ Departments created: Engineering, Sales, HR, Finance`);

    // ─── 4. Designations ───────────────────────────────────────────────
    const desigEmployee = await prisma.designation.create({
        data: { designation_name: 'Software Engineer', designation_code: 'SE', department_id: deptEngineering.id, organization_id: org.id }
    });
    const desigSenior = await prisma.designation.create({
        data: { designation_name: 'Senior Engineer', designation_code: 'SSE', department_id: deptEngineering.id, organization_id: org.id }
    });
    const desigManager = await prisma.designation.create({
        data: { designation_name: 'Engineering Manager', designation_code: 'EM', department_id: deptEngineering.id, organization_id: org.id }
    });
    const desigSalesExec = await prisma.designation.create({
        data: { designation_name: 'Sales Executive', designation_code: 'SE2', department_id: deptSales.id, organization_id: org.id }
    });
    const desigHR = await prisma.designation.create({
        data: { designation_name: 'HR Manager', designation_code: 'HRM', department_id: deptHR.id, organization_id: org.id }
    });
    const desigFinance = await prisma.designation.create({
        data: { designation_name: 'Finance Manager', designation_code: 'FM', department_id: deptFinance.id, organization_id: org.id }
    });
    console.log(`✅ Designations created`);

    // ─── 5. Roles (org-scoped) ─────────────────────────────────────────
    const roleEmployee = await prisma.role.create({
        data: { role_name: 'employee', organization_id: org.id, description: 'Regular employee' }
    });
    const roleManager = await prisma.role.create({
        data: { role_name: 'manager', organization_id: org.id, description: 'Team manager' }
    });
    const roleHR = await prisma.role.create({
        data: { role_name: 'hr', organization_id: org.id, description: 'HR team' }
    });
    const roleFinance = await prisma.role.create({
        data: { role_name: 'finance', organization_id: org.id, description: 'Finance team' }
    });
    console.log(`✅ Roles created: employee, manager, hr, finance`);

    // ─── 6. Salary Components (org-scoped) ─────────────────────────────
    const compBasic = await prisma.salaryComponent.create({
        data: { name: 'Basic Salary', type: 'earning', calculation_type: 'percentage', value: '40', is_taxable: true, is_statutory: false, is_default: false, organization_id: org.id }
    });
    const compHRA = await prisma.salaryComponent.create({
        data: { name: 'HRA', type: 'earning', calculation_type: 'percentage', value: '20', is_taxable: true, is_statutory: false, is_default: false, organization_id: org.id }
    });
    const compSpecial = await prisma.salaryComponent.create({
        data: { name: 'Special Allowance', type: 'earning', calculation_type: 'percentage', value: '30', is_taxable: true, is_statutory: false, is_default: false, organization_id: org.id }
    });
    const compPF = await prisma.salaryComponent.create({
        data: { name: 'PF - Employee', type: 'deduction', calculation_type: 'percentage', value: '12', is_taxable: false, is_statutory: true, is_default: true, organization_id: org.id }
    });
    const compPT = await prisma.salaryComponent.create({
        data: { name: 'Professional Tax', type: 'deduction', calculation_type: 'fixed', value: '200', is_taxable: false, is_statutory: true, is_default: true, organization_id: org.id }
    });
    console.log(`✅ Salary components created (Basic, HRA, Special, PF, PT)`);

    // ─── 7. Salary Structure ───────────────────────────────────────────
    const structure = await prisma.salaryStructure.create({
        data: {
            name: 'Standard Tech Package',
            level: 'role',
            organization_id: org.id,
        }
    });
    // Link components
    const structComponents = [
        { salary_component_id: compBasic.id, order: 0 },
        { salary_component_id: compHRA.id, order: 1 },
        { salary_component_id: compSpecial.id, order: 2 },
        { salary_component_id: compPF.id, order: 3 },
        { salary_component_id: compPT.id, order: 4 },
    ];
    for (const sc of structComponents) {
        await prisma.salaryStructureComponent.create({
            data: { salary_structure_id: structure.id, ...sc }
        });
    }
    console.log(`✅ Salary structure created: ${structure.name}`);

    // ─── 8. Payment Category ───────────────────────────────────────────
    const payCategory = await prisma.paymentCategory.create({
        data: { name: 'Monthly', frequency: 'Monthly', pay_day: '28', organization_id: org.id }
    });

    // ─── 9. Payroll Groups ─────────────────────────────────────────────
    const groupEngineering = await prisma.payrollGroup.create({
        data: {
            name: 'Engineering - Monthly',
            organization_id: org.id,
            salary_structure_id: structure.id,
            payment_category_id: payCategory.id,
        }
    });
    const groupSales = await prisma.payrollGroup.create({
        data: {
            name: 'Sales - Monthly',
            organization_id: org.id,
            salary_structure_id: structure.id,
            payment_category_id: payCategory.id,
        }
    });
    const groupSupport = await prisma.payrollGroup.create({
        data: {
            name: 'Support - Monthly',
            organization_id: org.id,
            salary_structure_id: structure.id,
            payment_category_id: payCategory.id,
        }
    });
    console.log(`✅ Payroll groups created: Engineering, Sales, Support`);

    // ─── 10. Reimbursement Types (org + payroll group scoped) ──────────
    const reimbTypes = [
        { type: 'Internet', label: 'Internet Broadband', limit: '1500', period: 'Monthly', payroll_group_id: groupEngineering.id },
        { type: 'Mobile', label: 'Mobile Bill', limit: '1000', period: 'Monthly', payroll_group_id: groupEngineering.id },
        { type: 'Travel', label: 'Travel Expenses', limit: '25000', period: 'Monthly', payroll_group_id: groupEngineering.id },
        { type: 'Food', label: 'Meals & Food', limit: '5000', period: 'Monthly', payroll_group_id: groupSales.id },
        { type: 'Travel', label: 'Travel & Conveyance', limit: '30000', period: 'Monthly', payroll_group_id: groupSales.id },
        { type: 'Medical', label: 'Medical Claims', limit: '15000', period: 'Yearly', payroll_group_id: groupSupport.id },
    ];
    for (const rt of reimbTypes) {
        await prisma.reimbursementType.create({
            data: { ...rt, organization_id: org.id, status: true }
        });
    }
    console.log(`✅ Reimbursement types created`);

    // ─── 11. Tax Sections ──────────────────────────────────────────────
    const taxSections = [
        { section: '80C', label: 'Savings & Investments', limit: '150000', instruments: ['PPF', 'ELSS', 'LIC Premium'] },
        { section: '80D', label: 'Health Insurance', limit: '50000', instruments: ['Health Insurance (Self)', 'Health Insurance (Parents)'] },
        { section: '80CCD(1B)', label: 'NPS Contribution', limit: '50000', instruments: ['NPS Tier I'] },
    ];
    for (const ts of taxSections) {
        await prisma.taxSection.create({
            data: { ...ts, organization_id: org.id, status: true }
        });
    }
    console.log(`✅ Tax sections created: 80C, 80D, 80CCD(1B)`);

    // ─── 12. Pay Cycle ─────────────────────────────────────────────────
    await prisma.payCycle.create({
        data: {
            organization_id: org.id,
            frequency: 'Monthly',
            pay_day: '28',
            attendance_start_day: '1',
            attendance_end_day: '30',
            cutoff_day: '25',
        }
    });
    console.log(`✅ Pay cycle configured`);

    // ─── 13. System Settings ───────────────────────────────────────────
    const sysSettings = [
        { key: 'epf_employee_rate', value: '12' },
        { key: 'epf_employer_rate', value: '12' },
        { key: 'esi_employee_rate', value: '0.75' },
        { key: 'esi_employer_rate', value: '3.25' },
        { key: 'esi_ceiling', value: '21000' },
        { key: 'professional_tax_annual', value: '2400' },
        { key: 'pt_applicable_states', value: 'Karnataka,Maharashtra,Gujarat,West Bengal' },
        { key: 'gratuity_rate', value: '4.81' },
        { key: 'gratuity_eligibility_years', value: '5' },
    ];
    for (const s of sysSettings) {
        await prisma.systemSetting.upsert({
            where: { key: s.key },
            update: { value: s.value },
            create: s,
        });
    }
    console.log(`✅ System settings (EPF/ESI/PT rates) configured`);

    // ─── 14. Create Users (Employees) ──────────────────────────────────
    const hash = await bcrypt.hash('test1234', 10);

    // Helper to create a user + userDetail
    async function createUser(params: {
        email: string; username: string; firstName: string; lastName: string;
        departmentId: number; designationId: number; roleId: number; payrollGroupId: number;
        salary: number; employeeId: string; reportingManagerId?: number;
    }) {
        const user = await prisma.user.create({
            data: {
                email: params.email,
                username: params.username,
                password: hash,
                status: true,
            }
        });
        const detail = await prisma.userDetail.create({
            data: {
                user_id: user.id,
                first_name: params.firstName,
                last_name: params.lastName,
                employee_id: params.employeeId,
                department_id: params.departmentId,
                designation_id: params.designationId,
                payroll_group_id: params.payrollGroupId,
                reporting_manager_id: params.reportingManagerId || null,
                base_salary: params.salary,
                currency: 'INR',
                country: 'India',
                employment_type: 'full-time',
                start_date: new Date('2024-01-15'),
                joining_date: new Date('2024-01-15'),
            }
        });
        await prisma.userRole.create({
            data: { user_id: user.id, role_id: params.roleId }
        });
        return { user, detail };
    }

    // ── Manager (Engineering) ──
    const manager = await createUser({
        email: 'manager@testcorp.com',
        username: 'rajesh_kumar',
        firstName: 'Rajesh',
        lastName: 'Kumar',
        departmentId: deptEngineering.id,
        designationId: desigManager.id,
        roleId: roleManager.id,
        payrollGroupId: groupEngineering.id,
        salary: 150000,
        employeeId: 'TC001',
    });
    console.log(`✅ Manager:   rajesh@testcorp.com  / test1234  (ID: ${manager.user.id})`);

    // ── HR ──
    const hr = await createUser({
        email: 'hr@testcorp.com',
        username: 'priya_sharma',
        firstName: 'Priya',
        lastName: 'Sharma',
        departmentId: deptHR.id,
        designationId: desigHR.id,
        roleId: roleHR.id,
        payrollGroupId: groupSupport.id,
        salary: 100000,
        employeeId: 'TC002',
        reportingManagerId: manager.user.id,
    });
    console.log(`✅ HR:        priya@testcorp.com  / test1234  (ID: ${hr.user.id})`);

    // ── Finance ──
    const finance = await createUser({
        email: 'finance@testcorp.com',
        username: 'amit_patel',
        firstName: 'Amit',
        lastName: 'Patel',
        departmentId: deptFinance.id,
        designationId: desigFinance.id,
        roleId: roleFinance.id,
        payrollGroupId: groupSupport.id,
        salary: 110000,
        employeeId: 'TC003',
        reportingManagerId: manager.user.id,
    });
    console.log(`✅ Finance:   finance@testcorp.com / test1234  (ID: ${finance.user.id})`);

    // ── Employee 1 (Engineer) ──
    const emp1 = await createUser({
        email: 'employee@testcorp.com',
        username: 'vignesh_kumar',
        firstName: 'Vignesh',
        lastName: 'Kumar',
        departmentId: deptEngineering.id,
        designationId: desigEmployee.id,
        roleId: roleEmployee.id,
        payrollGroupId: groupEngineering.id,
        salary: 80000,
        employeeId: 'TC004',
        reportingManagerId: manager.user.id,
    });
    console.log(`✅ Employee:  employee@testcorp.com / test1234 (ID: ${emp1.user.id})`);

    // ── Employee 2 (Sales) ──
    const emp2 = await createUser({
        email: 'sales@testcorp.com',
        username: 'neha_gupta',
        firstName: 'Neha',
        lastName: 'Gupta',
        departmentId: deptSales.id,
        designationId: desigSalesExec.id,
        roleId: roleEmployee.id,
        payrollGroupId: groupSales.id,
        salary: 70000,
        employeeId: 'TC005',
        reportingManagerId: manager.user.id,
    });
    console.log(`✅ Sales:     sales@testcorp.com   / test1234  (ID: ${emp2.user.id})`);

    // ── Employee 3 (Senior Engineer) ──
    const emp3 = await createUser({
        email: 'senior@testcorp.com',
        username: 'arun_nair',
        firstName: 'Arun',
        lastName: 'Nair',
        departmentId: deptEngineering.id,
        designationId: desigSenior.id,
        roleId: roleEmployee.id,
        payrollGroupId: groupEngineering.id,
        salary: 120000,
        employeeId: 'TC006',
        reportingManagerId: manager.user.id,
    });
    console.log(`✅ Senior:    senior@testcorp.com  / test1234  (ID: ${emp3.user.id})`);

    // ─── 15. Create Expense Claims for Employee 1 ──────────────────────
    const claim1 = await prisma.expenseClaim.create({
        data: {
            user_id: emp1.user.id,
            organization_id: org.id,
            type: 'Internet',
            amount: 1500,
            description: 'ACT Fibernet monthly broadband bill',
            expense_date: new Date('2026-07-15'),
            status: 'approved',
            payment_status: 'Ready To Pay',
            payment_mode: 'Salary Payroll',
        }
    });
    const claim2 = await prisma.expenseClaim.create({
        data: {
            user_id: emp1.user.id,
            organization_id: org.id,
            type: 'Mobile',
            amount: 800,
            description: 'Jio postpaid bill',
            expense_date: new Date('2026-07-16'),
            status: 'pending',
            payment_status: 'Pending Approval',
        }
    });
    const claim3 = await prisma.expenseClaim.create({
        data: {
            user_id: emp2.user.id,
            organization_id: org.id,
            type: 'Travel',
            amount: 12000,
            description: 'Client visit to Mumbai - flight + hotel',
            expense_date: new Date('2026-07-10'),
            status: 'submitted',
            payment_status: 'Pending Approval',
        }
    });
    console.log(`✅ Expense claims created (2 for Vignesh, 1 for Neha)`);

    // ─── Done ──────────────────────────────────────────────────────────
    console.log('\n🎉 Org 2 seed complete!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  LOGIN CREDENTIALS (all passwords: test1234)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Manager:   rajesh@testcorp.com   (${org.entity_name})`);
    console.log(`  HR:        priya@testcorp.com    (${org.entity_name})`);
    console.log(`  Finance:   finance@testcorp.com  (${org.entity_name})`);
    console.log(`  Employee:  employee@testcorp.com (${org.entity_name})`);
    console.log(`  Sales:     sales@testcorp.com    (${org.entity_name})`);
    console.log(`  Senior:    senior@testcorp.com   (${org.entity_name})`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Org ID: ${org.id}`);
    console.log(`  Branch: Bangalore HQ (ID: ${branch.id})`);
    console.log(`  Payroll Group: Engineering - Monthly (ID: ${groupEngineering.id})`);
    console.log(`  Salary Structure: Standard Tech Package (ID: ${structure.id})`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n  TEST CLAIMS:');
    console.log(`    #1 (Vignesh): Internet ₹1,500 - APPROVED / Ready To Pay / Salary Payroll`);
    console.log(`    #2 (Vignesh): Mobile ₹800 - PENDING`);
    console.log(`    #3 (Neha): Travel ₹12,000 - SUBMITTED (needs approval)`);
    console.log('═══════════════════════════════════════════════════════════════\n');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
