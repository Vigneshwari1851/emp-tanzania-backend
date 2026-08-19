import { PayrollService } from '../payroll.service';
import prisma from '../../../config/prisma';

async function runSnapshotTests() {
    console.log("=== Running Tanzania Payslip Snapshot Phase 4 Tests ===");
    const service = new PayrollService();
    let passed = 0;
    let failed = 0;

    const org = await prisma.organization.findFirst();
    if (!org) {
        console.error("❌ No organization found in the database. Cannot run database snapshot tests.");
        process.exit(1);
    }
    const testOrgId = org.id;

    // Retrieve or create a test user
    let user: any = await prisma.user.findFirst({
        include: { details: true }
    });

    if (!user) {
        console.log("Creating new test user...");
        const email = `test-tz-${Date.now()}@example.com`;
        user = await prisma.user.create({
            data: {
                email,
                password: "password",
                status: true,
                details: {
                    create: {
                        first_name: "Tz",
                        last_name: "Test",
                        country: "TANZANIA",
                        base_salary: 1000000
                    }
                }
            },
            include: { details: true }
        });
    } else {
        // Ensure user details exist and country is TANZANIA
        if (!user.details) {
            await prisma.userDetail.create({
                data: {
                    user_id: user.id,
                    first_name: "Tz",
                    last_name: "Test",
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

    // Reload user with details
    user = await prisma.user.findUnique({
        where: { id: user.id },
        include: { details: true }
    });

    try {
        // Cleanup old test data
        await prisma.tzTaxPolicy.deleteMany({ where: { organization_id: testOrgId } });
        await prisma.payslip.deleteMany({ where: { user_id: user.id } });

        // 1. Create Policy version 1 (effective Jan 2026)
        const policy1 = await prisma.tzTaxPolicy.create({
            data: {
                organization_id: testOrgId,
                version: 1,
                status: 'active',
                effective_date: new Date("2026-01-01"),
                employee_nssf_rate: 0.10,
                employer_nssf_rate: 0.10,
                paye_slabs: [
                    { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
                    { lowerLimit: 270001, upperLimit: null, rate: 10, fixedAmount: 0 }
                ]
            }
        });

        // 2. Perform calculation for Jan 2026
        const calcResult = await service.calculatePayrollEngine({
            employeeId: user.id,
            month: 1,
            year: 2026,
            workingDays: 26,
            lopDays: 0,
            overtimeHours: 0
        });

        const snapshotOnCalc = (calcResult.taxInfo as any).taxPolicySnapshot;
        if (snapshotOnCalc && snapshotOnCalc.taxPolicyVersion === 1 && snapshotOnCalc.employeeNssfRate === 0.10) {
            console.log("✔ Snapshot present on payroll calculation");
            passed++;
        } else {
            console.error("❌ Snapshot missing or incorrect on payroll calculation:", snapshotOnCalc);
            failed++;
        }

        // 3. Save payslip for Jan 2026 (Finalize)
        const payslip = await service.createPayslip(testOrgId, {
            userId: user.id,
            month: "2026-01",
            grossAmount: calcResult.grossSalary,
            deductionAmount: calcResult.totalDeductions,
            netAmount: calcResult.netPay,
            status: "PAID",
            breakdown: {
                earnings: calcResult.earnings,
                deductions: calcResult.deductions
            }
        });

        const savedPayslip = await prisma.payslip.findUnique({
            where: { id: payslip.id }
        });

        const bd = savedPayslip?.breakdown ? (typeof savedPayslip.breakdown === 'string' ? JSON.parse(savedPayslip.breakdown) : (savedPayslip.breakdown as any)) : null;
        
        if (bd && bd.taxPolicySnapshot && bd.taxPolicySnapshot.taxPolicyVersion === 1) {
            console.log("✔ Snapshot persisted in saved payslip breakdown");
            console.log("Sample Snapshot:", JSON.stringify(bd.taxPolicySnapshot, null, 2));
            passed++;
        } else {
            console.error("❌ Snapshot not persisted in saved payslip breakdown:", bd);
            failed++;
        }

        // 4. Create Policy version 2 (effective Feb 2026)
        const policy2 = await prisma.tzTaxPolicy.create({
            data: {
                organization_id: testOrgId,
                version: 2,
                status: 'active',
                effective_date: new Date("2026-02-01"),
                employee_nssf_rate: 0.12,
                employer_nssf_rate: 0.12,
                paye_slabs: [
                    { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
                    { lowerLimit: 270001, upperLimit: null, rate: 12, fixedAmount: 0 }
                ]
            }
        });

        // 5. Fetch Jan 2026 payslip and verify it remains version 1 (unchanged)
        const fetchedJanPayslip = await prisma.payslip.findUnique({
            where: { id: payslip.id }
        });
        const janBd = fetchedJanPayslip?.breakdown ? (typeof fetchedJanPayslip.breakdown === 'string' ? JSON.parse(fetchedJanPayslip.breakdown) : (fetchedJanPayslip.breakdown as any)) : null;

        if (janBd && janBd.taxPolicySnapshot && janBd.taxPolicySnapshot.taxPolicyVersion === 1) {
            console.log("✔ Historical payslip snapshot remained unchanged after adding new policy version");
            passed++;
        } else {
            console.error("❌ Historical payslip snapshot changed or is missing:", janBd?.taxPolicySnapshot);
            failed++;
        }

        // Cleanup
        await prisma.tzTaxPolicy.deleteMany({ where: { organization_id: testOrgId } });
        await prisma.payslip.deleteMany({ where: { user_id: user.id } });
        console.log("✔ Database cleaned up successfully");

    } catch (e: any) {
        console.error("❌ Test crashed:", e);
        failed++;
    }

    console.log(`\n=== Snapshot Tests Completed: ${passed} Passed, ${failed} Failed ===`);
    if (failed > 0) {
        process.exit(1);
    }
}

runSnapshotTests().catch(err => {
    console.error("Test execution crashed:", err);
    process.exit(1);
});
