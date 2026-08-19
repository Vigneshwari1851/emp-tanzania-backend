import { TZPayrollEngine } from '../payroll.engines';
import prisma from '../../../config/prisma';

async function runEngineTests() {
    console.log("=== Running Tanzania Payroll Engine Phase 3 Tests ===");
    const engine = new TZPayrollEngine();
    let passed = 0;
    let failed = 0;

    const org = await prisma.organization.findFirst();
    if (!org) {
        console.error("❌ No organization found in the database. Cannot run database engine tests.");
        process.exit(1);
    }
    const testOrgId = org.id;

    try {
        // Cleanup old test data
        await prisma.tzTaxPolicy.deleteMany({ where: { organization_id: testOrgId } });

        // Seed two active policies with different versions and effective dates
        // Version 1: standard rates (effective 2026-01-01)
        const policyV1 = await prisma.tzTaxPolicy.create({
            data: {
                organization_id: testOrgId,
                version: 1,
                status: 'active',
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

        // Version 2: new rates (effective 2026-08-01, e.g. different NSSF of 12% and different PAYE slab rate)
        const policyV2 = await prisma.tzTaxPolicy.create({
            data: {
                organization_id: testOrgId,
                version: 2,
                status: 'active',
                effective_date: new Date("2026-08-01"),
                employee_nssf_rate: 0.12,
                employer_nssf_rate: 0.12,
                paye_slabs: [
                    { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
                    { lowerLimit: 270001, upperLimit: 520000, rate: 9, fixedAmount: 0 }, // 9% instead of 8%
                    { lowerLimit: 520001, upperLimit: 760000, rate: 20, fixedAmount: 22500 },
                    { lowerLimit: 760001, upperLimit: 1000000, rate: 25, fixedAmount: 70500 },
                    { lowerLimit: 1000001, upperLimit: null, rate: 30, fixedAmount: 130500 }
                ]
            }
        });

        const runTest = async (label: string, gross: number, month: number, year: number, expectedNssf: number, expectedPaye: number) => {
            try {
                const res = await engine.calculate({
                    employeeId: 1,
                    baseSalary: gross,
                    actualGross: gross,
                    lopDays: 0,
                    workingDays: 26,
                    lopDeductionAmount: 0,
                    earnings: {},
                    deductions: {},
                    apiDetails: { organization_id: testOrgId },
                    month,
                    year
                });

                const nssf = res.deductions['NSSF Pension'];
                const paye = res.deductions['PAYE Tax'];

                if (nssf === expectedNssf && paye === expectedPaye) {
                    console.log(`✔ [${label}] Gross: ${gross} | Month: ${year}-${month} => NSSF: ${nssf} (expected: ${expectedNssf}), PAYE: ${paye} (expected: ${expectedPaye})`);
                    passed++;
                } else {
                    console.error(`❌ [${label}] Gross: ${gross} | Month: ${year}-${month} => Got NSSF: ${nssf} (expected: ${expectedNssf}), PAYE: ${paye} (expected: ${expectedPaye})`);
                    failed++;
                }
            } catch (e: any) {
                console.error(`❌ [${label}] Calculation failed:`, e.message);
                failed++;
            }
        };

        // --- Test Scenarios under Policy V1 (Jan 2026, 10% NSSF, standard PAYE) ---
        console.log("\n--- Testing Historical Policy V1 (Effective Jan 2026) ---");
        
        // 1. Gross 200,000 (taxable: 180,000 -> 0% tax)
        await runTest("Below tax-free limit", 200000, 1, 2026, 20000, 0);

        // 2. Gross 300,000 (taxable: 270,000 -> 0% tax)
        await runTest("Tax-free limit boundary", 300000, 1, 2026, 30000, 0);

        // 3. Gross 400,000 (taxable: 360,000 -> falls in 270,001-520,000 band, PAYE: (360,000-270,000)*8% = 7,200)
        await runTest("Inside second band", 400000, 1, 2026, 40000, 7200);

        // 4. Gross 600,000 (taxable: 540,000 -> falls in 520,001-760,000 band, PAYE: 20,000+(540,000-520,000)*20% = 24,000)
        await runTest("Inside third band", 600000, 1, 2026, 60000, 24000);

        // 5. Gross 900,000 (taxable: 810,000 -> falls in 760,001-1,000,000 band, PAYE: 68,000+(810,000-760,000)*25% = 80,500)
        await runTest("Inside fourth band", 900000, 1, 2026, 90000, 80500);

        // 6. Gross 1,500,000 (taxable: 1,350,000 -> falls in > 1,000,000 band, PAYE: 128,000+(1,350,000-1,000,000)*30% = 233,000)
        await runTest("Above highest band", 1500000, 1, 2026, 150000, 233000);

        // --- Test Scenarios under Policy V2 (Aug 2026, 12% NSSF, modified PAYE) ---
        console.log("\n--- Testing Current Policy V2 (Effective Aug 2026) ---");
        
        // Gross 400,000
        // NSSF V2: 400,000 * 12% = 48,000
        // Taxable V2: 352,000
        // PAYE V2: (352,000 - 270,000) * 9% = 82,000 * 9% = 7,380
        await runTest("Inside second band (V2)", 400000, 8, 2026, 48000, 7380);

        // Clean up
        await prisma.tzTaxPolicy.deleteMany({ where: { organization_id: testOrgId } });
        console.log("\n✔ Database cleaned up successfully");

    } catch (e: any) {
        console.error("❌ Test crashed:", e);
        failed++;
    }

    console.log(`\n=== Tests Completed: ${passed} Passed, ${failed} Failed ===`);
    if (failed > 0) {
        process.exit(1);
    }
}

runEngineTests().catch(err => {
    console.error("Test execution crashed:", err);
    process.exit(1);
});
