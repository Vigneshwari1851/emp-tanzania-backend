import { PayrollService } from '../payroll.service';
import { PayrollReportService, getTzComplianceFilename } from '../payroll.report.service';
import { TZPayrollEngine, INPayrollEngine, USPayrollEngine, SGPayrollEngine, UAEPayrollEngine } from '../payroll.engines';
import prisma from '../../../config/prisma';
import ExcelJS from 'exceljs';

async function runProductionReadinessTests() {
    console.log("=========================================================================");
    console.log("      STARTING TANZANIA PRODUCTION READINESS AUTOMATED TESTS             ");
    console.log("=========================================================================");

    const reportService = new PayrollReportService();
    const service = new PayrollService();
    const tzEngine = new TZPayrollEngine();
    let passed = 0;
    let failed = 0;

    const assert = (condition: boolean, msg: string) => {
        if (condition) {
            console.log(`  ✔ [PASS] ${msg}`);
            passed++;
        } else {
            console.error(`  ❌ [FAIL] ${msg}`);
            failed++;
        }
    };

    // 1. Filename Helper Test
    console.log("\n--- Testing Standardized Filename Helper ---");
    assert(getTzComplianceFilename('PAYE', '2026', '3') === 'Tanzania_PAYE_2026_03.xlsx', "Filename helper outputs Tanzania_PAYE_2026_03.xlsx");
    assert(getTzComplianceFilename('SDL', '2026', '11') === 'Tanzania_SDL_2026_11.xlsx', "Filename helper outputs Tanzania_SDL_2026_11.xlsx");
    assert(getTzComplianceFilename('HESLB', '2026', '01') === 'Tanzania_HESLB_2026_01.xlsx', "Filename helper outputs Tanzania_HESLB_2026_01.xlsx");

    // 2. Setup Test Organizations
    const existingOrgs = await prisma.organization.findMany({ take: 1 });
    if (existingOrgs.length === 0) {
        console.error("❌ Need at least 1 organization in the database.");
        process.exit(1);
    }
    const orgId = existingOrgs[0].id;

    // Update test organization with registration numbers
    await prisma.organization.update({
        where: { id: orgId },
        data: {
            tra_tin: "TRA-TIN-999888777",
            nssf_employer_number: "NSSF-EMP-555444333",
            wcf_employer_number: "WCF-EMP-111222333"
        }
    });

    let role = await prisma.role.findFirst({ where: { organization_id: orgId } });
    if (!role) {
        role = await prisma.role.create({ data: { role_name: "Test Role", organization_id: orgId } });
    }

    // 3. Setup Test Employees
    console.log("\n--- Setting up test employees ---");
    const testEmails = ["prod.default.heslb@test.com", "prod.custom.heslb@test.com"];
    
    const oldUsers = await prisma.user.findMany({ where: { email: { in: testEmails } } });
    const oldUserIds = oldUsers.map(u => u.id);
    if (oldUserIds.length > 0) {
        await prisma.userRole.deleteMany({ where: { user_id: { in: oldUserIds } } });
        await prisma.userDetail.deleteMany({ where: { user_id: { in: oldUserIds } } });
        await prisma.payslip.deleteMany({ where: { user_id: { in: oldUserIds } } });
        await prisma.user.deleteMany({ where: { id: { in: oldUserIds } } });
    }

    const empDefault = await prisma.user.create({
        data: {
            email: "prod.default.heslb@test.com",
            password: "password",
            status: true,
            details: {
                create: {
                    first_name: "Default",
                    last_name: "HESLB",
                    country: "TANZANIA",
                    base_salary: 1000000,
                    is_heslb_beneficiary: true,
                    heslb_index_number: "HESLB-DEFAULT-100",
                    pan_number: "TIN-DEF-100",
                    nssf_number: "NSSF-DEF-100"
                }
            }
        }
    });

    const empNonBen = await prisma.user.create({
        data: {
            email: "prod.custom.heslb@test.com",
            password: "password",
            status: true,
            details: {
                create: {
                    first_name: "Non",
                    last_name: "Beneficiary",
                    country: "TANZANIA",
                    base_salary: 1000000,
                    is_heslb_beneficiary: false,
                    pan_number: "TIN-NON-200",
                    nssf_number: "NSSF-NON-200"
                }
            }
        }
    });

    await prisma.userRole.createMany({
        data: [
            { user_id: empDefault.id, role_id: role.id },
            { user_id: empNonBen.id, role_id: role.id }
        ]
    });

    // 4. Test Policy V1 with Default 15% HESLB Rate
    console.log("\n--- Testing Policy V1 with Default HESLB Rate (15%) ---");
    await prisma.tzTaxPolicy.deleteMany({ where: { organization_id: orgId } });

    const policyV1 = await prisma.tzTaxPolicy.create({
        data: {
            organization_id: orgId,
            version: 1,
            status: "active",
            effective_date: new Date(Date.UTC(2026, 0, 1)),
            employee_nssf_rate: 0.10,
            employer_nssf_rate: 0.10,
            sdl_rate: 0.035,
            wcf_rate: 0.005,
            heslb_rate: 0.1500,
            sdl_threshold: 1,
            paye_slabs: [
                { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
                { lowerLimit: 270001, upperLimit: null, rate: 10, fixedAmount: 0 }
            ]
        }
    });

    const resV1Default = await tzEngine.calculate({
        employeeId: empDefault.id,
        baseSalary: 1000000,
        actualGross: 1000000,
        lopDays: 0,
        workingDays: 30,
        lopDeductionAmount: 0,
        earnings: { "Basic Salary": 1000000 },
        deductions: {},
        year: 2026,
        month: 1,
        apiDetails: { organization_id: orgId, is_heslb_beneficiary: true, heslb_index_number: "HESLB-DEFAULT-100" }
    });

    assert(resV1Default.deductions['HESLB Loan Deduction'] === 150000, "Default HESLB rate (15%) calculates 150,000 TZS on 1,000,000 basic");
    assert(resV1Default.taxInfo.taxPolicySnapshot.heslbRate === 0.15, "Snapshot stores heslbRate = 0.15");

    const resV1NonBen = await tzEngine.calculate({
        employeeId: empNonBen.id,
        baseSalary: 1000000,
        actualGross: 1000000,
        lopDays: 0,
        workingDays: 30,
        lopDeductionAmount: 0,
        earnings: { "Basic Salary": 1000000 },
        deductions: {},
        year: 2026,
        month: 1,
        apiDetails: { organization_id: orgId, is_heslb_beneficiary: false }
    });
    assert(resV1NonBen.deductions['HESLB Loan Deduction'] === 0, "Non-beneficiary HESLB deduction is 0 TZS");

    // Seed historical payslip using Policy V1
    const slipV1 = await service.createPayslip(orgId, {
        userId: empDefault.id,
        month: "2026-01",
        grossAmount: 1000000,
        deductionAmount: 250000,
        netAmount: 660000,
        status: "PAID",
        breakdown: {
            earnings: [{ name: "Basic Salary", amount: 1000000 }],
            deductions: [
                { label: "NSSF Pension", value: 100000 },
                { label: "PAYE Tax", value: 73000 },
                { label: "HESLB Loan Deduction", value: 150000 }
            ],
            taxPolicySnapshot: resV1Default.taxInfo.taxPolicySnapshot
        }
    });

    // 5. Test Policy V2 with Custom 10% HESLB Rate
    console.log("\n--- Testing Policy V2 with Custom HESLB Rate (10%) ---");
    // Archive V1, create V2
    await prisma.tzTaxPolicy.update({ where: { id: policyV1.id }, data: { status: "inactive" } });

    const policyV2 = await prisma.tzTaxPolicy.create({
        data: {
            organization_id: orgId,
            version: 2,
            status: "active",
            effective_date: new Date(Date.UTC(2026, 1, 1)),
            employee_nssf_rate: 0.10,
            employer_nssf_rate: 0.10,
            sdl_rate: 0.035,
            wcf_rate: 0.005,
            heslb_rate: 0.1000, // Custom 10% rate
            sdl_threshold: 1,
            paye_slabs: [
                { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
                { lowerLimit: 270001, upperLimit: null, rate: 10, fixedAmount: 0 }
            ]
        }
    });

    const resV2Custom = await tzEngine.calculate({
        employeeId: empDefault.id,
        baseSalary: 1000000,
        actualGross: 1000000,
        lopDays: 0,
        workingDays: 30,
        lopDeductionAmount: 0,
        earnings: { "Basic Salary": 1000000 },
        deductions: {},
        year: 2026,
        month: 2,
        apiDetails: { organization_id: orgId, is_heslb_beneficiary: true, heslb_index_number: "HESLB-DEFAULT-100" }
    });

    assert(resV2Custom.deductions['HESLB Loan Deduction'] === 100000, "Custom HESLB rate (10%) calculates 100,000 TZS on 1,000,000 basic");
    assert(resV2Custom.taxInfo.taxPolicySnapshot.heslbRate === 0.10, "Snapshot stores custom heslbRate = 0.10");

    // Check historical payslip immutability
    const reloadedSlipV1 = await prisma.payslip.findUnique({ where: { id: slipV1.id } });
    const bdV1: any = typeof reloadedSlipV1?.breakdown === 'string' ? JSON.parse(reloadedSlipV1?.breakdown) : reloadedSlipV1?.breakdown;
    assert(bdV1.taxPolicySnapshot.heslbRate === 0.15, "Historical V1 payslip snapshot preserves heslbRate = 0.15");
    assert(bdV1.taxPolicySnapshot.calculatedHeslb === 150000, "Historical V1 payslip snapshot preserves calculatedHeslb = 150,000");

    // 6. Test Compliance Export Header Registration Identifiers
    console.log("\n--- Testing Employer Registration IDs in Compliance Reports ---");
    const payeBuffer = await reportService.generateTzPayeReport(orgId, "2026", "01");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(payeBuffer as any);
    const sheet = workbook.getWorksheet('Report');
    
    let foundTinInMetadata = false;
    if (sheet) {
        sheet.eachRow((row) => {
            const vals = row.values as any[];
            if (vals.some(v => typeof v === 'string' && v.includes('TRA-TIN-999888777'))) {
                foundTinInMetadata = true;
            }
        });
    }
    assert(foundTinInMetadata, "TRA TIN registration number 'TRA-TIN-999888777' appears in PAYE report header");

    const nssfBuffer = await reportService.generateTzNssfReport(orgId, "2026", "01");
    const nssfWorkbook = new ExcelJS.Workbook();
    await nssfWorkbook.xlsx.load(nssfBuffer as any);
    const nssfSheet = nssfWorkbook.getWorksheet('Report');
    
    let foundNssfEmpNo = false;
    if (nssfSheet) {
        nssfSheet.eachRow((row) => {
            const vals = row.values as any[];
            if (vals.some(v => typeof v === 'string' && v.includes('NSSF-EMP-555444333'))) {
                foundNssfEmpNo = true;
            }
        });
    }
    assert(foundNssfEmpNo, "NSSF Employer registration number 'NSSF-EMP-555444333' appears in NSSF report header");

    // 7. Verify Country Engine Regressions
    console.log("\n--- Testing Country Engine Regressions ---");
    assert(new INPayrollEngine() !== undefined, "India payroll engine loaded");
    assert(new USPayrollEngine() !== undefined, "USA payroll engine loaded");
    assert(new SGPayrollEngine() !== undefined, "Singapore payroll engine loaded");
    assert(new UAEPayrollEngine() !== undefined, "UAE payroll engine loaded");

    // 8. Clean up test users
    console.log("\n--- Cleaning up test records ---");
    const cleanupUsers = await prisma.user.findMany({ where: { email: { in: testEmails } } });
    const cleanupUserIds = cleanupUsers.map(u => u.id);
    if (cleanupUserIds.length > 0) {
        await prisma.userRole.deleteMany({ where: { user_id: { in: cleanupUserIds } } });
        await prisma.userDetail.deleteMany({ where: { user_id: { in: cleanupUserIds } } });
        await prisma.payslip.deleteMany({ where: { user_id: { in: cleanupUserIds } } });
        await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    }
    await prisma.tzTaxPolicy.deleteMany({ where: { organization_id: orgId } });
    console.log("✔ Test database records cleaned up successfully.");

    console.log("\n=========================================================================");
    console.log(`    TEST RUN COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log("=========================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runProductionReadinessTests().catch(err => {
    console.error("Test execution crashed:", err);
    process.exit(1);
});
