import { PayrollService } from '../payroll.service';
import { PayrollReportService } from '../payroll.report.service';
import prisma from '../../../config/prisma';
import ExcelJS from 'exceljs';

async function runComplianceReportTests() {
    console.log("=========================================================================");
    console.log("      STARTING TANZANIA COMPLIANCE EXPORTS AUTOMATED TESTS               ");
    console.log("=========================================================================");

    const reportService = new PayrollReportService();
    const service = new PayrollService();
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

    // 1. Setup Mock Organizations
    const existingOrgs = await prisma.organization.findMany({ take: 2 });
    if (existingOrgs.length === 0) {
        console.error("❌ Need at least 1 organization in the database to run tests.");
        process.exit(1);
    }
    
    const orgAId = existingOrgs[0].id;
    let orgBId = existingOrgs[1]?.id;
    let createdMockOrgB = false;

    if (!orgBId) {
        console.log("Only 1 organization found. Creating temporary mock organization B...");
        const mockOrg = await prisma.organization.create({
            data: {
                entity_name: "Mock Org B for Compliance Tests",
                address: "Dar es Salaam",
                city: "Dar es Salaam",
                state: "Dar es Salaam",
                country: "Tanzania",
                zip: "11000",
                currency: "TZS",
                standard_working_hours_per_week: 40,
                working_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                public_holidays: []
            }
        });
        orgBId = mockOrg.id;
        createdMockOrgB = true;
    }

    // Retrieve or create test roles
    let roleA = await prisma.role.findFirst({ where: { organization_id: orgAId } });
    if (!roleA) {
        roleA = await prisma.role.create({ data: { role_name: "Mock Role A", organization_id: orgAId } });
    }
    let roleB = await prisma.role.findFirst({ where: { organization_id: orgBId } });
    if (!roleB) {
        roleB = await prisma.role.create({ data: { role_name: "Mock Role B", organization_id: orgBId } });
    }

    // 2. Setup Test Employees
    console.log("\n--- Setting up test employees ---");
    const testEmails = ["comp.ben.a@test.com", "comp.non.a@test.com", "comp.ben.b@test.com"];
    
    const oldUsers = await prisma.user.findMany({ where: { email: { in: testEmails } } });
    const oldUserIds = oldUsers.map(u => u.id);
    if (oldUserIds.length > 0) {
        await prisma.userRole.deleteMany({ where: { user_id: { in: oldUserIds } } });
        await prisma.userDetail.deleteMany({ where: { user_id: { in: oldUserIds } } });
        await prisma.payslip.deleteMany({ where: { user_id: { in: oldUserIds } } });
        await prisma.user.deleteMany({ where: { id: { in: oldUserIds } } });
    }

    // Org A - HESLB beneficiary
    const empBenA = await prisma.user.create({
        data: {
            email: "comp.ben.a@test.com",
            password: "password",
            status: true,
            details: {
                create: {
                    first_name: "Ben",
                    last_name: "A",
                    country: "TANZANIA",
                    base_salary: 1000000,
                    is_heslb_beneficiary: true,
                    heslb_index_number: "HESLB-A-111",
                    pan_number: "TIN-A-111",
                    nssf_number: "NSSF-A-111"
                }
            }
        }
    });

    // Org A - Non HESLB beneficiary
    const empNonA = await prisma.user.create({
        data: {
            email: "comp.non.a@test.com",
            password: "password",
            status: true,
            details: {
                create: {
                    first_name: "Non",
                    last_name: "A",
                    country: "TANZANIA",
                    base_salary: 800000,
                    is_heslb_beneficiary: false,
                    pan_number: "TIN-A-222",
                    nssf_number: "NSSF-A-222"
                }
            }
        }
    });

    // Org B - Beneficiary under Org B (for isolation checks)
    const empBenB = await prisma.user.create({
        data: {
            email: "comp.ben.b@test.com",
            password: "password",
            status: true,
            details: {
                create: {
                    first_name: "Ben",
                    last_name: "B",
                    country: "TANZANIA",
                    base_salary: 1200000,
                    is_heslb_beneficiary: true,
                    heslb_index_number: "HESLB-B-333",
                    pan_number: "TIN-B-333",
                    nssf_number: "NSSF-B-333"
                }
            }
        }
    });

    // Assign roles to mock users
    await prisma.userRole.createMany({
        data: [
            { user_id: empBenA.id, role_id: roleA.id },
            { user_id: empNonA.id, role_id: roleA.id },
            { user_id: empBenB.id, role_id: roleB.id }
        ]
    });

    // Clean up previous tax policies for these test runs
    await prisma.tzTaxPolicy.deleteMany({ where: { organization_id: { in: [orgAId, orgBId] } } });

    // Seed Active Policies
    console.log("Seeding active policies...");
    const policyA = await prisma.tzTaxPolicy.create({
        data: {
            organization_id: orgAId,
            version: 1,
            status: "active",
            effective_date: new Date(Date.UTC(2026, 0, 1)),
            employee_nssf_rate: 0.10,
            employer_nssf_rate: 0.10,
            sdl_rate: 0.035,
            wcf_rate: 0.005,
            sdl_threshold: 1, // trigger SDL for headcount >= 1
            paye_slabs: [
                { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
                { lowerLimit: 270001, upperLimit: null, rate: 10, fixedAmount: 0 }
            ]
        }
    });

    const policyB = await prisma.tzTaxPolicy.create({
        data: {
            organization_id: orgBId,
            version: 1,
            status: "active",
            effective_date: new Date(Date.UTC(2026, 0, 1)),
            employee_nssf_rate: 0.10,
            employer_nssf_rate: 0.10,
            sdl_rate: 0.035,
            wcf_rate: 0.005,
            sdl_threshold: 1,
            paye_slabs: [
                { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
                { lowerLimit: 270001, upperLimit: null, rate: 10, fixedAmount: 0 }
            ]
        }
    });

    // 3. Create mock finalized payslips in database
    console.log("\n--- Creating mock finalized payslips ---");
    
    // Org A - PAID status
    const slipBenA = await service.createPayslip(orgAId, {
        userId: empBenA.id,
        month: "2026-03",
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
            taxPolicySnapshot: {
                taxPolicyId: policyA.id,
                taxPolicyVersion: 1,
                effectiveDate: policyA.effective_date,
                employeeNssfRate: 0.10,
                employerNssfRate: 0.10,
                sdlRate: 0.035,
                wcfRate: 0.005,
                employeeNssfCalculated: 100000,
                employerNssfCalculated: 100000,
                payeCalculated: 73000,
                calculatedHeslb: 150000,
                calculatedSdl: 35000,
                calculatedWcf: 5000,
                heslbApplicable: true,
                heslbIndexNumber: "HESLB-A-111",
                basicSalaryUsedForHeslb: 1000000
            }
        }
    });

    // Org A - FINANCE_APPROVED status
    const slipNonA = await service.createPayslip(orgAId, {
        userId: empNonA.id,
        month: "2026-03",
        grossAmount: 800000,
        deductionAmount: 133000,
        netAmount: 667000,
        status: "FINANCE_APPROVED",
        breakdown: {
            earnings: [{ name: "Basic Salary", amount: 800000 }],
            deductions: [
                { label: "NSSF Pension", value: 80000 },
                { label: "PAYE Tax", value: 53000 }
            ],
            taxPolicySnapshot: {
                taxPolicyId: policyA.id,
                taxPolicyVersion: 1,
                effectiveDate: policyA.effective_date,
                employeeNssfRate: 0.10,
                employerNssfRate: 0.10,
                sdlRate: 0.035,
                wcfRate: 0.005,
                employeeNssfCalculated: 80000,
                employerNssfCalculated: 80000,
                payeCalculated: 53000,
                calculatedHeslb: 0,
                calculatedSdl: 28000,
                calculatedWcf: 4000,
                heslbApplicable: false,
                basicSalaryUsedForHeslb: 0
            }
        }
    });

    // Org B - PAID status (to check organization isolation)
    const slipBenB = await service.createPayslip(orgBId, {
        userId: empBenB.id,
        month: "2026-03",
        grossAmount: 1200000,
        deductionAmount: 393000,
        netAmount: 807000,
        status: "PAID",
        breakdown: {
            earnings: [{ name: "Basic Salary", amount: 1200000 }],
            deductions: [
                { label: "NSSF Pension", value: 120000 },
                { label: "PAYE Tax", value: 93000 },
                { label: "HESLB Loan Deduction", value: 180000 }
            ],
            taxPolicySnapshot: {
                taxPolicyId: policyB.id,
                taxPolicyVersion: 1,
                effectiveDate: policyB.effective_date,
                employeeNssfRate: 0.10,
                employerNssfRate: 0.10,
                sdlRate: 0.035,
                wcfRate: 0.005,
                employeeNssfCalculated: 120000,
                employerNssfCalculated: 120000,
                payeCalculated: 93000,
                calculatedHeslb: 180000,
                calculatedSdl: 42000,
                calculatedWcf: 6000,
                heslbApplicable: true,
                heslbIndexNumber: "HESLB-B-333",
                basicSalaryUsedForHeslb: 1200000
            }
        }
    });

    // Org A - DRAFT status (must be ignored in compliance exports!)
    const empDraft = await prisma.user.create({
        data: {
            email: "comp.draft.a@test.com",
            password: "password",
            status: true,
            details: {
                create: {
                    first_name: "Draft",
                    last_name: "User",
                    country: "TANZANIA",
                    base_salary: 500000
                }
            }
        }
    });
    
    await prisma.payslip.create({
        data: {
            organization_id: orgAId,
            user_id: empDraft.id,
            month: "2026-03",
            gross_amount: 500000,
            deduction_amount: 50000,
            net_amount: 450000,
            status: "DRAFT"
        }
    });

    console.log("✔ Mock payslips seeded.");

    // 4. Test Report Generation
    console.log("\n--- Testing PAYE Report Excel Output ---");
    const payeBuffer = await reportService.generateTzPayeReport(orgAId, "2026", "03");
    assert(payeBuffer && payeBuffer.length > 0, "PAYE report yields a non-empty buffer");

    // Read the Excel sheet to verify headers and row content
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(payeBuffer as any);
    const sheet = workbook.getWorksheet('Report');
    assert(sheet !== undefined, "Report worksheet exists in output workbook");
    
    if (sheet) {
        let headerRowIndex = 1;
        let headers: any[] = [];
        for (let r = 1; r <= sheet.rowCount; r++) {
            const vals = sheet.getRow(r).values as any[];
            if (vals && vals.includes('Employee Name')) {
                headerRowIndex = r;
                headers = vals;
            }
        }
        assert(headers.includes('Employee Name'), "Headers contain 'Employee Name'");
        assert(headers.includes('TIN'), "Headers contain 'TIN'");
        assert(headers.includes('Basic Salary'), "Headers contain 'Basic Salary'");
        assert(headers.includes('PAYE'), "Headers contain 'PAYE'");
        assert(headers.includes('HESLB Deduction'), "Headers contain 'HESLB Deduction'");

        // Count rows (including header)
        // We had 2 finalized employees (Ben A and Non A) in Org A. Draft User and Org B user must be ignored.
        const dataRowCount = sheet.rowCount - headerRowIndex;
        assert(dataRowCount === 2, `Worksheet contains exactly 2 data rows, Got: ${dataRowCount}`);
    }

    // 5. Test HESLB filtering (only beneficiaries)
    console.log("\n--- Testing HESLB Beneficiary Filtering ---");
    const heslbBuffer = await reportService.generateTzHeslbReport(orgAId, "2026", "03");
    const heslbWorkbook = new ExcelJS.Workbook();
    await heslbWorkbook.xlsx.load(heslbBuffer as any);
    const heslbSheet = heslbWorkbook.getWorksheet('Report');
    
    if (heslbSheet) {
        let headerRowIndex = 1;
        for (let r = 1; r <= heslbSheet.rowCount; r++) {
            const vals = heslbSheet.getRow(r).values as any[];
            if (vals && vals.includes('HESLB Index Number')) {
                headerRowIndex = r;
            }
        }
        const dataRowCount = heslbSheet.rowCount - headerRowIndex;
        // Ben A is HESLB beneficiary, Non A is NOT. So only Ben A should appear.
        assert(dataRowCount === 1, `HESLB report contains exactly 1 beneficiary row, Got: ${dataRowCount}`);
        
        const rowData = heslbSheet.getRow(headerRowIndex + 1).values as any[];
        assert(rowData.includes('HESLB-A-111'), "Row contains HESLB Index number 'HESLB-A-111'");
    }

    // 6. Test Organization Isolation
    console.log("\n--- Testing Organization Isolation ---");
    const payeBufferB = await reportService.generateTzPayeReport(orgBId, "2026", "03");
    const workbookB = new ExcelJS.Workbook();
    await workbookB.xlsx.load(payeBufferB as any);
    const sheetB = workbookB.getWorksheet('Report');
    if (sheetB) {
        let headerRowIndex = 1;
        for (let r = 1; r <= sheetB.rowCount; r++) {
            const vals = sheetB.getRow(r).values as any[];
            if (vals && vals.includes('Employee Name')) {
                headerRowIndex = r;
            }
        }
        const dataRowCountB = sheetB.rowCount - headerRowIndex;
        // Org B has only 1 finalized payslip
        assert(dataRowCountB === 1, `Org B report contains exactly 1 data row, Got: ${dataRowCountB}`);
        
        const rowDataB = sheetB.getRow(headerRowIndex + 1).values as any[];
        assert(rowDataB.includes('Ben A') === false, "Org B report does not include Org A employee ('Ben A')");
        assert(rowDataB.includes('Ben B'), "Org B report contains employee 'Ben B' only");
    }

    // 7. Test Empty Period Handling
    console.log("\n--- Testing Empty Period Handling ---");
    try {
        await reportService.generateTzPayeReport(orgAId, "2026", "12");
        assert(false, "Expected error on empty period, but no error thrown.");
    } catch (e: any) {
        assert(e.message && e.message.includes('No finalized payroll runs found'), `Threw correct empty period error message: "${e.message}"`);
    }

    // 8. Clean up
    console.log("\n--- Cleaning up test records ---");
    const allEmails = [...testEmails, "comp.draft.a@test.com"];
    const cleanupUsers = await prisma.user.findMany({ where: { email: { in: allEmails } } });
    const cleanupUserIds = cleanupUsers.map(u => u.id);
    if (cleanupUserIds.length > 0) {
        await prisma.userRole.deleteMany({ where: { user_id: { in: cleanupUserIds } } });
        await prisma.userDetail.deleteMany({ where: { user_id: { in: cleanupUserIds } } });
        await prisma.payslip.deleteMany({ where: { user_id: { in: cleanupUserIds } } });
        await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    }
    await prisma.tzTaxPolicy.deleteMany({ where: { organization_id: { in: [orgAId, orgBId] } } });
    
    if (createdMockOrgB) {
        console.log("Tearing down temporary mock organization B...");
        await prisma.role.deleteMany({ where: { organization_id: orgBId } });
        await prisma.organization.delete({ where: { id: orgBId } });
    }
    
    console.log("✔ Test database records cleaned up.");

    console.log("\n=========================================================================");
    console.log(`    TEST RUN COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log("=========================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runComplianceReportTests().catch(err => {
    console.error("Test execution crashed:", err);
    process.exit(1);
});
