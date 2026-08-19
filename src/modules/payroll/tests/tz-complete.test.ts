import { PayrollService } from '../payroll.service';
import { PayrollEngineFactory } from '../payroll.engines';
import prisma from '../../../config/prisma';

async function runAllTests() {
    console.log("=================================================================");
    console.log("       STARTING TANZANIA PAYROLL AUTOMATED TEST SUITE            ");
    console.log("=================================================================");

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

    const expectThrow = async (fn: () => any, messagePart: string, msg: string) => {
        try {
            await fn();
            console.error(`  ❌ [FAIL] ${msg} (Expected error containing "${messagePart}", but no error was thrown)`);
            failed++;
        } catch (e: any) {
            if (e.message && e.message.toLowerCase().includes(messagePart.toLowerCase())) {
                console.log(`  ✔ [PASS] ${msg} (Threw correct error: "${e.message}")`);
                passed++;
            } else {
                console.error(`  ❌ [FAIL] ${msg} (Threw wrong error: "${e.message}", expected match: "${messagePart}")`);
                failed++;
            }
        }
    };

    // Setup Mock Organizations
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
                entity_name: "Mock Org B for Isolation Tests",
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

    // Retrieve or create a test user under Org A
    let user = await prisma.user.findFirst({
        include: { details: true }
    });
    if (!user) {
        user = await prisma.user.create({
            data: {
                email: `tz-test-user-${Date.now()}@example.com`,
                password: "password",
                status: true,
                details: {
                    create: {
                        first_name: "Tz",
                        last_name: "Complete",
                        country: "TANZANIA",
                        base_salary: 1000000
                    }
                }
            },
            include: { details: true }
        });
    } else {
        if (!user.details) {
            await prisma.userDetail.create({
                data: {
                    user_id: user.id,
                    first_name: "Tz",
                    last_name: "Complete",
                    country: "TANZANIA",
                    base_salary: 1000000
                }
            });
        } else {
            await prisma.userDetail.update({
                where: { id: user.details.id },
                data: { country: "TANZANIA" }
            });
        }
    }
    const testUserId = user.id;

    // Cleanup previous tax policies and payslips
    await prisma.tzTaxPolicy.deleteMany({ where: { organization_id: { in: [orgAId, orgBId] } } });
    await prisma.payslip.deleteMany({ where: { user_id: testUserId } });

    // =========================================================================
    // SECTION 1: VALIDATION TESTS
    // =========================================================================
    console.log("\n--- Category 1: Policy Validation Tests ---");

    // 1. Overlapping slabs
    await expectThrow(() => {
        return service.validateTzPayeSlabs([
            { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
            { lowerLimit: 260000, upperLimit: 520000, rate: 8, fixedAmount: 0 },
            { lowerLimit: 520001, upperLimit: null, rate: 20, fixedAmount: 20000 }
        ]);
    }, "Gap or overlap detected", "Overlapping lower limits should throw validation error");

    // 2. Gaps between slabs
    await expectThrow(() => {
        return service.validateTzPayeSlabs([
            { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
            { lowerLimit: 275000, upperLimit: 520000, rate: 8, fixedAmount: 0 },
            { lowerLimit: 520001, upperLimit: null, rate: 20, fixedAmount: 20000 }
        ]);
    }, "Gap or overlap detected", "Gaps between upper/lower limits should throw error");

    // 3. Unordered slabs
    await expectThrow(() => {
        return service.validateTzPayeSlabs([
            { lowerLimit: 270001, upperLimit: 520000, rate: 8, fixedAmount: 0 },
            { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
            { lowerLimit: 520001, upperLimit: null, rate: 20, fixedAmount: 20000 }
        ]);
    }, "ordered by lower limit", "Unordered slabs should throw error");

    // 4. Multiple open-ended slabs
    await expectThrow(() => {
        return service.validateTzPayeSlabs([
            { lowerLimit: 0, upperLimit: null, rate: 0, fixedAmount: 0 },
            { lowerLimit: 270001, upperLimit: null, rate: 8, fixedAmount: 0 }
        ]);
    }, "cannot be open-ended", "Multiple open-ended slabs should throw error");

    // 5. Open-ended slab not last
    await expectThrow(() => {
        return service.validateTzPayeSlabs([
            { lowerLimit: 0, upperLimit: null, rate: 0, fixedAmount: 0 },
            { lowerLimit: 270001, upperLimit: 520000, rate: 8, fixedAmount: 0 }
        ]);
    }, "cannot be open-ended", "Open-ended slab in middle should throw error");

    // 6. Negative rate
    await expectThrow(() => {
        return service.validateTzPayeSlabs([
            { lowerLimit: 0, upperLimit: 270000, rate: -10, fixedAmount: 0 },
            { lowerLimit: 270001, upperLimit: null, rate: 8, fixedAmount: 0 }
        ]);
    }, "Tax rate must be a non-negative", "Negative tax rate should throw error");

    // 7. Negative fixed amount
    await expectThrow(() => {
        return service.validateTzPayeSlabs([
            { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: -50 },
            { lowerLimit: 270001, upperLimit: null, rate: 8, fixedAmount: 0 }
        ]);
    }, "Fixed tax amount must be a non-negative", "Negative fixed amount should throw error");

    // 8. Invalid lower/upper limit bounds (lower >= upper)
    await expectThrow(() => {
        return service.validateTzPayeSlabs([
            { lowerLimit: 270000, upperLimit: 250000, rate: 8, fixedAmount: 0 },
            { lowerLimit: 270001, upperLimit: null, rate: 20, fixedAmount: 20000 }
        ]);
    }, "Upper limit must be greater than lower limit", "Lower limit greater than upper limit should throw error");

    // 9. Empty slab array
    await expectThrow(() => {
        return service.validateTzPayeSlabs([]);
    }, "PAYE slabs must be a non-empty array", "Empty slab array should throw error");


    // =========================================================================
    // SECTION 2: DYNAMIC POLICY & SELECTION TESTS
    // =========================================================================
    console.log("\n--- Category 2: Dynamic Policy & Selection Tests ---");

    // Seed Active policy for Org A (effective 2026-01-01)
    const activePolicyOrgA = await prisma.tzTaxPolicy.create({
        data: {
            organization_id: orgAId,
            version: 1,
            status: "active",
            effective_date: new Date("2026-01-01"),
            employee_nssf_rate: 0.10,
            employer_nssf_rate: 0.10,
            paye_slabs: [
                { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
                { lowerLimit: 270001, upperLimit: null, rate: 10, fixedAmount: 0 }
            ]
        }
    });

    // Seed Active policy for Org B (effective 2026-01-01 - with different NSSF rate)
    const activePolicyOrgB = await prisma.tzTaxPolicy.create({
        data: {
            organization_id: orgBId,
            version: 1,
            status: "active",
            effective_date: new Date("2026-01-01"),
            employee_nssf_rate: 0.15, // 15% NSSF
            employer_nssf_rate: 0.15,
            paye_slabs: [
                { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
                { lowerLimit: 270001, upperLimit: null, rate: 10, fixedAmount: 0 }
            ]
        }
    });

    // Seed Draft and Inactive policies for Org A (should be ignored by calculations)
    const draftPolicyOrgA = await prisma.tzTaxPolicy.create({
        data: {
            organization_id: orgAId,
            version: 2,
            status: "draft",
            effective_date: new Date("2026-01-01"),
            employee_nssf_rate: 0.08,
            employer_nssf_rate: 0.08,
            paye_slabs: [
                { lowerLimit: 0, upperLimit: null, rate: 0, fixedAmount: 0 }
            ]
        }
    });

    const inactivePolicyOrgA = await prisma.tzTaxPolicy.create({
        data: {
            organization_id: orgAId,
            version: 3,
            status: "inactive",
            effective_date: new Date("2026-01-01"),
            employee_nssf_rate: 0.05,
            employer_nssf_rate: 0.05,
            paye_slabs: [
                { lowerLimit: 0, upperLimit: null, rate: 0, fixedAmount: 0 }
            ]
        }
    });

    // Isolation Check: Org A uses activePolicyOrgA (10% NSSF) not Org B's (15% NSSF)
    const orgAEngine = PayrollEngineFactory.getEngine("TANZANIA");
    const calcOrgA = await orgAEngine.calculate({
        employeeId: testUserId,
        baseSalary: 100000,
        actualGross: 100000,
        lopDays: 0,
        workingDays: 26,
        lopDeductionAmount: 0,
        earnings: {},
        deductions: {},
        apiDetails: { organization_id: orgAId },
        month: 1,
        year: 2026
    });
    assert(calcOrgA.deductions['NSSF Pension'] === 10000, "Org A calculation uses Org A active policy (10% NSSF)");

    const calcOrgB = await orgAEngine.calculate({
        employeeId: testUserId,
        baseSalary: 100000,
        actualGross: 100000,
        lopDays: 0,
        workingDays: 26,
        lopDeductionAmount: 0,
        earnings: {},
        deductions: {},
        apiDetails: { organization_id: orgBId },
        month: 1,
        year: 2026
    });
    assert(calcOrgB.deductions['NSSF Pension'] === 15000, "Org B calculation uses Org B active policy (15% NSSF) - Isolation verified");


    // =========================================================================
    // SECTION 3: BOUNDARY & VALUE TESTS (Tanzania PAYE & NSSF Rules)
    // =========================================================================
    console.log("\n--- Category 3: PAYE Slab Boundary & Value Tests ---");

    // Standard TZ policy (re-seeded for standard limits)
    await prisma.tzTaxPolicy.deleteMany({ where: { organization_id: orgAId } });
    const standardPolicy = await prisma.tzTaxPolicy.create({
        data: {
            organization_id: orgAId,
            version: 1,
            status: "active",
            effective_date: new Date("2026-01-01"),
            employee_nssf_rate: 0.10,
            employer_nssf_rate: 0.10,
            paye_slabs: [
                { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
                { lowerLimit: 270001, upperLimit: 520000, rate: 8, fixedAmount: 0 },
                { lowerLimit: 520001, upperLimit: 760000, rate: 20, fixedAmount: 20000 },
                { lowerLimit: 760001, upperLimit: 1000000, rate: 25, fixedAmount: 68000 },
                { lowerLimit: 1000001, upperLimit: null, rate: 30, fixedAmount: 128000 }
            ]
        }
    });

    const runBoundaryTest = async (gross: number, expectedNssf: number, expectedPaye: number, expectedNet: number, label: string) => {
        const res = await orgAEngine.calculate({
            employeeId: testUserId,
            baseSalary: gross,
            actualGross: gross,
            lopDays: 0,
            workingDays: 26,
            lopDeductionAmount: 0,
            earnings: {},
            deductions: {},
            apiDetails: { organization_id: orgAId },
            month: 1,
            year: 2026
        });
        const nssf = res.deductions['NSSF Pension'];
        const paye = res.deductions['PAYE Tax'];
        const net = gross - nssf - paye;

        assert(nssf === expectedNssf && paye === expectedPaye && net === expectedNet, 
            `${label} (Gross: ${gross}) => NSSF: ${nssf}/${expectedNssf}, PAYE: ${paye}/${expectedPaye}, Net: ${net}/${expectedNet}`);
    };

    // 1. Salary = 0
    await runBoundaryTest(0, 0, 0, 0, "Zero salary");

    // 2. Gross below tax-free threshold (e.g. 200,000 -> NSSF: 20,000, Taxable: 180,000 -> PAYE: 0)
    await runBoundaryTest(200000, 20000, 0, 180000, "Salary below tax-free threshold");

    // 3. Gross 300,000 (NSSF: 30,000, Taxable: 270,000 -> boundary of 1st slab -> PAYE: 0)
    await runBoundaryTest(300000, 30000, 0, 270000, "Exact tax-free limit boundary (Taxable 270,000)");

    // 4. Gross 350,000 (NSSF: 35,000, Taxable: 315,000 -> inside 2nd slab -> PAYE: (315,000 - 270,000)*8% = 3,600)
    await runBoundaryTest(350000, 35000, 3600, 311400, "Inside second slab (Taxable 315,000)");

    // 5. Gross 577,778 (NSSF: 57,778, Taxable: 520,000 -> exact upper limit of 2nd slab -> PAYE: (520,000-270,000)*8% = 20,000)
    await runBoundaryTest(577778, 57778, 20000, 500000, "Exact boundary of second slab (Taxable 520,000)");

    // 6. Gross 600,000 (NSSF: 60,000, Taxable: 540,000 -> inside 3rd slab -> PAYE: 20,000 + (540,000-520,000)*20% = 24,000)
    await runBoundaryTest(600000, 60000, 24000, 516000, "Inside third slab (Taxable 540,000)");

    // 7. Gross 844,444 (NSSF: 84,444, Taxable: 760,000 -> exact upper limit of 3rd slab -> PAYE: 20,000 + (760,000-520,000)*20% = 68,000)
    await runBoundaryTest(844444, 84444, 68000, 692000, "Exact boundary of third slab (Taxable 760,000)");

    // 8. Gross 900,000 (NSSF: 90,000, Taxable: 810,000 -> inside 4th slab -> PAYE: 68,000 + (810,000-760,000)*25% = 80,500)
    await runBoundaryTest(900000, 90000, 80500, 729500, "Inside fourth slab (Taxable 810,000)");

    // 9. Gross 1,111,111 (NSSF: 111,111, Taxable: 1,000,000 -> exact upper limit of 4th slab -> PAYE: 68,000 + (1,000,000-760,000)*25% = 128,000)
    await runBoundaryTest(1111111, 111111, 128000, 872000, "Exact boundary of fourth slab (Taxable 1,000,000)");

    // 10. Gross 1,500,000 (NSSF: 150,000, Taxable: 1,350,000 -> above highest band -> PAYE: 128,000 + (1,350,000-1,000,000)*30% = 233,000)
    await runBoundaryTest(1500000, 150000, 233000, 1117000, "Well above highest slab (Taxable 1,350,000)");


    // =========================================================================
    // SECTION 4: VERSIONING & SNAPSHOT TESTS
    // =========================================================================
    console.log("\n--- Category 4: Versioning & Snapshot Tests ---");

    // 1. Save payslip under Version 1
    const calcJan = await service.calculatePayrollEngine({
        employeeId: testUserId,
        month: 1,
        year: 2026,
        workingDays: 26,
        lopDays: 0,
        overtimeHours: 0
    });

    const payslipJan = await service.createPayslip(orgAId, {
        userId: testUserId,
        month: "2026-01",
        grossAmount: calcJan.grossSalary,
        deductionAmount: calcJan.totalDeductions,
        netAmount: calcJan.netPay,
        status: "PAID",
        breakdown: {
            earnings: calcJan.earnings,
            deductions: calcJan.deductions
        }
    });

    // Verify snapshot fields
    const janPayslipDb = await prisma.payslip.findUnique({ where: { id: payslipJan.id } });
    const bd = janPayslipDb?.breakdown ? (typeof janPayslipDb.breakdown === 'string' ? JSON.parse(janPayslipDb.breakdown) : (janPayslipDb.breakdown as any)) : null;
    
    assert(!!bd && !!bd.taxPolicySnapshot, "Saved payslip breakdown contains taxPolicySnapshot");
    if (bd && bd.taxPolicySnapshot) {
        assert(bd.taxPolicySnapshot.taxPolicyVersion === 1, "Snapshot has correct version (1)");
        assert(bd.taxPolicySnapshot.employeeNssfRate === 0.10, "Snapshot NSSF rate matches policy V1");
        assert(bd.taxPolicySnapshot.payeCalculated !== undefined, "Snapshot PAYE calculated matches");
    }

    // 2. Create Active Policy version 2 (effective Feb 2026, e.g. 12% NSSF)
    const policyV2 = await prisma.tzTaxPolicy.create({
        data: {
            organization_id: orgAId,
            version: 2,
            status: "active",
            effective_date: new Date("2026-02-01"),
            employee_nssf_rate: 0.12,
            employer_nssf_rate: 0.12,
            paye_slabs: [
                { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
                { lowerLimit: 270001, upperLimit: null, rate: 10, fixedAmount: 0 }
            ]
        }
    });

    // 3. Verify Jan payslip snapshot remains version 1 (unchanged)
    const fetchedJanPayslip = await prisma.payslip.findUnique({ where: { id: payslipJan.id } });
    const janBd = fetchedJanPayslip?.breakdown ? (typeof fetchedJanPayslip.breakdown === 'string' ? JSON.parse(fetchedJanPayslip.breakdown) : (fetchedJanPayslip.breakdown as any)) : null;
    assert(janBd && janBd.taxPolicySnapshot && janBd.taxPolicySnapshot.taxPolicyVersion === 1, "Jan payslip snapshot remains untouched (version 1) after creating version 2");

    // 4. Verify new payroll calculation for Feb 2026 uses version 2 (12% NSSF)
    const calcFeb = await service.calculatePayrollEngine({
        employeeId: testUserId,
        month: 2,
        year: 2026,
        workingDays: 26,
        lopDays: 0,
        overtimeHours: 0
    });
    assert((calcFeb.taxInfo as any).taxPolicySnapshot.taxPolicyVersion === 2, "New payroll for Feb 2026 uses version 2");


    // =========================================================================
    // SECTION 5: REGRESSION TESTS
    // =========================================================================
    console.log("\n--- Category 5: Country Engine Regression Tests ---");

    try {
        const inEngine = PayrollEngineFactory.getEngine("INDIA");
        assert(inEngine !== null, "India payroll engine successfully loaded");
        
        const usEngine = PayrollEngineFactory.getEngine("USA");
        assert(usEngine !== null, "USA payroll engine successfully loaded");

        const sgEngine = PayrollEngineFactory.getEngine("SINGAPORE");
        assert(sgEngine !== null, "Singapore payroll engine successfully loaded");

        const uaeEngine = PayrollEngineFactory.getEngine("UAE");
        assert(uaeEngine !== null, "UAE payroll engine successfully loaded");

    } catch (e: any) {
        console.error("❌ Regression test crashed:", e.message);
        failed++;
    }


    // =========================================================================
    // CLEANUP & FINAL SUMMARIES
    // =========================================================================
    await prisma.tzTaxPolicy.deleteMany({ where: { organization_id: { in: [orgAId, orgBId] } } });
    await prisma.payslip.deleteMany({ where: { user_id: testUserId } });
    
    if (createdMockOrgB) {
        console.log("Deleting temporary mock organization B...");
        await prisma.organization.delete({ where: { id: orgBId } });
    }
    
    console.log("\n✔ Test database cleanup completed successfully.");

    console.log("=================================================================");
    console.log(`  TANZANIA AUTOMATED TESTS RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runAllTests().catch(err => {
    console.error("Test runner crashed:", err);
    process.exit(1);
});
