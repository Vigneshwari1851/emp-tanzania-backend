import { PayrollService } from '../payroll.service';
import { PayrollEngineFactory } from '../payroll.engines';
import prisma from '../../../config/prisma';

async function runExpansionTests() {
    console.log("=========================================================================");
    console.log("        STARTING TANZANIA STATUTORY EXPANSION AUTOMATED TESTS            ");
    console.log("=========================================================================");

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

    // 1. Setup Mock Organization
    const org = await prisma.organization.findFirst();
    if (!org) {
        console.error("❌ No organization found in the database. Cannot run tests.");
        process.exit(1);
    }
    const orgId = org.id;

    // Find or create a role in the organization to associate with users
    let role = await prisma.role.findFirst({ where: { organization_id: orgId } });
    if (!role) {
        console.log("Creating a mock role for organization...");
        role = await prisma.role.create({
            data: {
                role_name: "Mock Employee Role",
                organization_id: orgId
            }
        });
    }

    // 2. Setup Test Employees
    console.log("\n--- Setting up test employees ---");
    
    // Clear any old test employees to ensure fresh headcount calculations
    const testEmails = ["heslb.non@test.com", "heslb.ben@test.com", "heslb.diff@test.com"];
    
    const oldUsers = await prisma.user.findMany({ where: { email: { in: testEmails } } });
    const oldUserIds = oldUsers.map(u => u.id);
    if (oldUserIds.length > 0) {
        await prisma.userRole.deleteMany({ where: { user_id: { in: oldUserIds } } });
        await prisma.userDetail.deleteMany({ where: { user_id: { in: oldUserIds } } });
        await prisma.payslip.deleteMany({ where: { user_id: { in: oldUserIds } } });
        await prisma.user.deleteMany({ where: { id: { in: oldUserIds } } });
    }

    // Non-beneficiary employee
    const empNonBen = await prisma.user.create({
        data: {
            email: "heslb.non@test.com",
            password: "password",
            status: true,
            details: {
                create: {
                    first_name: "Non",
                    last_name: "Beneficiary",
                    country: "TANZANIA",
                    base_salary: 1000000,
                    is_heslb_beneficiary: false,
                    compensation_breakdown: [{ name: "Basic Salary", amount: 1000000 }]
                }
            }
        },
        include: { details: true }
    });

    // Beneficiary employee (Basic = Gross = 1,000,000)
    const empBen = await prisma.user.create({
        data: {
            email: "heslb.ben@test.com",
            password: "password",
            status: true,
            details: {
                create: {
                    first_name: "Ben",
                    last_name: "Beneficiary",
                    country: "TANZANIA",
                    base_salary: 1000000,
                    is_heslb_beneficiary: true,
                    heslb_index_number: "HESLB-INDEX-12345",
                    compensation_breakdown: [{ name: "Basic Salary", amount: 1000000 }]
                }
            }
        },
        include: { details: true }
    });

    // Beneficiary employee with Basic (1,000,000) != Gross (1,500,000)
    const empDiff = await prisma.user.create({
        data: {
            email: "heslb.diff@test.com",
            password: "password",
            status: true,
            details: {
                create: {
                    first_name: "Diff",
                    last_name: "Salary",
                    country: "TANZANIA",
                    base_salary: 1000000, // Basic
                    is_heslb_beneficiary: true,
                    heslb_index_number: "HESLB-INDEX-99999",
                    compensation_breakdown: [
                        { name: "Basic Salary", amount: 1000000 },
                        { name: "Transport Allowance", amount: 500000 } // Gross will be 1,500,000
                    ]
                }
            }
        },
        include: { details: true }
    });

    // Associate roles
    await prisma.userRole.createMany({
        data: [
            { user_id: empNonBen.id, role_id: role.id },
            { user_id: empBen.id, role_id: role.id },
            { user_id: empDiff.id, role_id: role.id }
        ]
    });

    console.log("✔ Test employees created and assigned roles successfully.");

    // Clean up previous tax policies to ensure clean state
    await prisma.tzTaxPolicy.deleteMany({ where: { organization_id: orgId } });

    // 3. Create active tax policy with custom settings (SDL=3.5%, WCF=0.5%, threshold=10)
    console.log("\n--- Seeding Policy V1 (Threshold = 10) ---");
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
            sdl_threshold: 10,
            paye_slabs: [
                { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
                { lowerLimit: 270001, upperLimit: 520000, rate: 8, fixedAmount: 0 },
                { lowerLimit: 520001, upperLimit: 760000, rate: 20, fixedAmount: 20000 },
                { lowerLimit: 760001, upperLimit: 1000000, rate: 25, fixedAmount: 68000 },
                { lowerLimit: 1000001, upperLimit: null, rate: 30, fixedAmount: 128000 }
            ]
        }
    });
    console.log(`✔ Policy V1 created (ID: ${policyV1.id})`);

    // 4. Test HESLB Calculations
    console.log("\n--- Testing HESLB Deduction Logic ---");
    const calcNonBen = await service.calculatePayrollEngine({
        employeeId: empNonBen.id,
        month: 1,
        year: 2026,
        workingDays: 26,
        lopDays: 0,
        overtimeHours: 0
    });
    const heslbNon = calcNonBen.deductions.find(d => d.label === 'HESLB Loan Deduction')?.value || 0;
    assert(heslbNon === 0, "HESLB non-beneficiary receives exactly 0 TZS deduction");

    const calcBen = await service.calculatePayrollEngine({
        employeeId: empBen.id,
        month: 1,
        year: 2026,
        workingDays: 26,
        lopDays: 0,
        overtimeHours: 0
    });
    const heslbBen = calcBen.deductions.find(d => d.label === 'HESLB Loan Deduction')?.value || 0;
    assert(heslbBen === 150000, `HESLB beneficiary is deducted exactly 15% of basic salary (150,000 TZS, Got: ${heslbBen})`);

    const calcDiff = await service.calculatePayrollEngine({
        employeeId: empDiff.id,
        month: 1,
        year: 2026,
        workingDays: 26,
        lopDays: 0,
        overtimeHours: 0
    });
    const heslbDiff = calcDiff.deductions.find(d => d.label === 'HESLB Loan Deduction')?.value || 0;
    assert(heslbDiff === 150000, `HESLB uses basic salary (1,000,000 TZS * 15% = 150,000) not gross salary (1,500,000 * 15% = 225,000)`);
    assert(calcDiff.netPay < calcDiff.grossSalary, `HESLB reduces employee Net Pay (Net: ${calcDiff.netPay} vs Gross: ${calcDiff.grossSalary})`);

    // 5. Test SDL Headcount Threshold Logic
    console.log("\n--- Testing SDL Headcount Threshold Logic ---");
    
    // Check initial active headcount in organization (should be >= 3 since we created 3 role-associated users)
    const activeHeadcountInit = await prisma.user.count({
        where: {
            status: true,
            roles: { some: { role: { organization_id: orgId } } }
        }
    });
    console.log(`- Current headcount for Org ${orgId} mapped through Roles: ${activeHeadcountInit}`);

    // If active headcount is below threshold (10), SDL must be 0
    const sdlNon = calcBen.employerContributions.find(e => e.label === 'Employer SDL')?.value || 0;
    assert(sdlNon === 0, `SDL is 0 when headcount (${activeHeadcountInit}) is below threshold (10)`);

    // Setup threshold to 2 to force SDL calculation on small headcount
    console.log("\n--- Updating Policy V1 to set SDL threshold = 2 ---");
    await prisma.tzTaxPolicy.update({
        where: { id: policyV1.id },
        data: { sdl_threshold: 2 }
    });

    const calcBenWithSdl = await service.calculatePayrollEngine({
        employeeId: empBen.id,
        month: 1,
        year: 2026,
        workingDays: 26,
        lopDays: 0,
        overtimeHours: 0
    });

    const sdlCalculated = calcBenWithSdl.employerContributions.find(e => e.label === 'Employer SDL')?.value || 0;
    assert(sdlCalculated === 35000, `SDL calculated when active headcount >= threshold (1000000 * 3.5% = 35000 TZS, Got: ${sdlCalculated})`);
    
    const wcfCalculated = calcBenWithSdl.employerContributions.find(e => e.label === 'Employer WCF')?.value || 0;
    assert(wcfCalculated === 5000, `WCF calculated based on gross (1000000 * 0.5% = 5000 TZS, Got: ${wcfCalculated})`);

    // Ensure WCF and SDL do not reduce Net Pay
    const paye = calcBenWithSdl.deductions.find(d => d.label === 'PAYE Tax')?.value || 0;
    const nssfEmp = calcBenWithSdl.deductions.find(d => d.label === 'NSSF Pension')?.value || 0;
    const heslb = calcBenWithSdl.deductions.find(d => d.label === 'HESLB Loan Deduction')?.value || 0;
    const expectedNet = 1000000 - nssfEmp - paye - heslb;
    assert(calcBenWithSdl.netPay === expectedNet, `SDL/WCF are employer costs and do NOT reduce employee Net Pay (Expected Net: ${expectedNet}, Got: ${calcBenWithSdl.netPay})`);

    // 6. Test Payslip Snapshot Persistence
    console.log("\n--- Testing Payslip Snapshot Integration ---");
    const payslip = await service.createPayslip(orgId, {
        userId: empBen.id,
        month: "2026-01",
        grossAmount: calcBenWithSdl.grossSalary,
        deductionAmount: calcBenWithSdl.totalDeductions,
        netAmount: calcBenWithSdl.netPay,
        status: "PAID",
        breakdown: {
            earnings: calcBenWithSdl.earnings,
            deductions: calcBenWithSdl.deductions
        }
    });

    const savedPayslip = await prisma.payslip.findUnique({ where: { id: payslip.id } });
    const bd = savedPayslip?.breakdown ? (typeof savedPayslip.breakdown === 'string' ? JSON.parse(savedPayslip.breakdown) : (savedPayslip.breakdown as any)) : null;
    
    assert(bd && bd.taxPolicySnapshot, "Payslip breakdown contains taxPolicySnapshot");
    if (bd && bd.taxPolicySnapshot) {
        assert(bd.taxPolicySnapshot.sdlRate === 0.035, `Snapshot preserves SDL Rate (0.035, Got: ${bd.taxPolicySnapshot.sdlRate})`);
        assert(bd.taxPolicySnapshot.wcfRate === 0.005, `Snapshot preserves WCF Rate (0.005, Got: ${bd.taxPolicySnapshot.wcfRate})`);
        assert(bd.taxPolicySnapshot.calculatedHeslb === 150000, `Snapshot preserves HESLB Amount (150000, Got: ${bd.taxPolicySnapshot.calculatedHeslb})`);
        assert(bd.taxPolicySnapshot.heslbIndexNumber === "HESLB-INDEX-12345", `Snapshot preserves HESLB Index number ("HESLB-INDEX-12345", Got: "${bd.taxPolicySnapshot.heslbIndexNumber}")`);
    }

    // 7. Test Versioning & Historical Immutability
    console.log("\n--- Testing Versioning Immutability ---");
    
    // Create Policy V2 with changed SDL rate (4%) and WCF rate (1%)
    console.log("Activating Policy V2 (effective 2026-02-01)...");
    const policyV2 = await prisma.tzTaxPolicy.create({
        data: {
            organization_id: orgId,
            version: 2,
            status: "active",
            effective_date: new Date(Date.UTC(2026, 1, 1)),
            employee_nssf_rate: 0.10,
            employer_nssf_rate: 0.10,
            sdl_rate: 0.040, // Changed from 3.5% to 4%
            wcf_rate: 0.010, // Changed from 0.5% to 1%
            sdl_threshold: 2,
            paye_slabs: [
                { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
                { lowerLimit: 270001, upperLimit: 520000, rate: 8, fixedAmount: 0 },
                { lowerLimit: 520001, upperLimit: 760000, rate: 20, fixedAmount: 20000 },
                { lowerLimit: 760001, upperLimit: 1000000, rate: 25, fixedAmount: 68000 },
                { lowerLimit: 1000001, upperLimit: null, rate: 30, fixedAmount: 128000 }
            ]
        }
    });

    // Check that historical payslip V1 (January 2026) remains completely unchanged (still points to V1 parameters)
    const historicalPayslip = await prisma.payslip.findUnique({ where: { id: payslip.id } });
    const histBd = historicalPayslip?.breakdown ? (typeof historicalPayslip.breakdown === 'string' ? JSON.parse(historicalPayslip.breakdown) : (historicalPayslip.breakdown as any)) : null;
    assert(histBd?.taxPolicySnapshot?.taxPolicyVersion === 1, "Historical payslip breakdown preserves Policy Version 1");
    assert(histBd?.taxPolicySnapshot?.sdlRate === 0.035, "Historical payslip breakdown preserves original SDL Rate of 3.5%");

    // 8. Clean up
    console.log("\n--- Cleaning up test records ---");
    const userIds = [empNonBen.id, empBen.id, empDiff.id];
    await prisma.userRole.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.userDetail.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.payslip.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.tzTaxPolicy.deleteMany({ where: { organization_id: orgId } });
    console.log("✔ Test database records cleaned up successfully.");

    console.log("\n=========================================================================");
    console.log(`    TEST RUN COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log("=========================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runExpansionTests().catch(err => {
    console.error("Test execution crashed:", err);
    process.exit(1);
});
