import { PayrollService } from '../payroll.service';
import prisma from '../../../config/prisma';

async function validateFunctionalFlow() {
    console.log("=========================================================================");
    console.log("        STARTING REAL FUNCTIONAL PAYROLL VALIDATION FOR TANZANIA         ");
    console.log("=========================================================================");

    const service = new PayrollService();
    const org = await prisma.organization.findFirst();
    if (!org) {
        console.error("❌ No organization found. Cannot run validation.");
        process.exit(1);
    }
    const orgId = org.id;

    // Retrieve or create a test employee in Tanzania
    let employee = await prisma.user.findFirst({
        where: { email: "tz.validate@company.com" },
        include: { details: true }
    });

    const mockBreakdown = [
        { name: "Basic Salary", amount: 1200000 }
    ];

    if (!employee) {
        console.log("Creating test employee: tz.validate@company.com");
        employee = await prisma.user.create({
            data: {
                email: "tz.validate@company.com",
                password: "password",
                status: true,
                details: {
                    create: {
                        first_name: "Validate",
                        last_name: "Employee",
                        country: "TANZANIA",
                        base_salary: 1200000,
                        compensation_breakdown: mockBreakdown
                    }
                }
            },
            include: { details: true }
        });
    } else {
        // Reset base salary, country and breakdown to match parameters
        await prisma.userDetail.update({
            where: { id: employee.details!.id },
            data: {
                country: "TANZANIA",
                base_salary: 1200000,
                compensation_breakdown: mockBreakdown
            }
        });
    }

    // Cleanup previous data
    await prisma.tzTaxPolicy.deleteMany({ where: { organization_id: orgId } });
    await prisma.payslip.deleteMany({ where: { user_id: employee.id } });

    console.log(`✔ User and organization clean states established (Org ID: ${orgId}, User ID: ${employee.id})`);

    // 1. Create and seed Initial Policy V1 (Effective 2026-01-01)
    console.log("\n--- Step 1: Seeding Tanzania Policy V1 (effective 2026-01-01) ---");
    const policyV1 = await prisma.tzTaxPolicy.create({
        data: {
            organization_id: orgId,
            version: 1,
            status: "active",
            effective_date: new Date(Date.UTC(2026, 0, 1)),
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
    console.log(`✔ Policy V1 created successfully (ID: ${policyV1.id}, Status: ${policyV1.status})`);

    // 2. Run payroll calculation for Jan 2026
    console.log("\n--- Step 2: Running payroll calculation for Jan 2026 using V1 ---");
    const calcV1 = await service.calculatePayrollEngine({
        employeeId: employee.id,
        month: 1,
        year: 2026,
        workingDays: 26,
        lopDays: 0,
        overtimeHours: 0
    });

    const nssfEmpV1 = calcV1.deductions.find(d => d.label === 'NSSF Pension')?.value || 0;
    const payeV1 = calcV1.deductions.find(d => d.label === 'PAYE Tax')?.value || 0;
    const netV1 = calcV1.netPay;

    console.log(`- Gross Salary: 1,200,000 TZS`);
    console.log(`- Calculated NSSF Employee (10%): ${nssfEmpV1} TZS (Expected: 120,000)`);
    console.log(`- Taxable Income (Gross - NSSF): 1,080,000 TZS`);
    console.log(`- Calculated PAYE (slab 5: 128,000 + (1,080,000 - 1,000,000)*30%): ${payeV1} TZS (Expected: 152,000)`);
    console.log(`- Calculated Net Salary: ${netV1} TZS (Expected: 928,000)`);

    if (nssfEmpV1 === 120000 && payeV1 === 152000 && netV1 === 928000) {
        console.log("✔ V1 Calculations match expected statutory guidelines perfectly!");
    } else {
        console.error("❌ Calculations do not match expectations!");
    }

    // 3. Save / Generate Payslip V1 (Finalize)
    console.log("\n--- Step 3: Finalizing Jan 2026 Payslip & Verifying Snapshot ---");
    const payslipV1 = await service.createPayslip(orgId, {
        userId: employee.id,
        month: "2026-01",
        grossAmount: calcV1.grossSalary,
        deductionAmount: calcV1.totalDeductions,
        netAmount: calcV1.netPay,
        status: "PAID",
        breakdown: {
            earnings: calcV1.earnings,
            deductions: calcV1.deductions
        }
    });

    const savedPayslipV1 = await prisma.payslip.findUnique({ where: { id: payslipV1.id } });
    const bdV1 = savedPayslipV1?.breakdown ? (typeof savedPayslipV1.breakdown === 'string' ? JSON.parse(savedPayslipV1.breakdown) : (savedPayslipV1.breakdown as any)) : null;

    if (bdV1 && bdV1.taxPolicySnapshot) {
        console.log("✔ Payslip V1 snapshot found:");
        console.log(JSON.stringify(bdV1.taxPolicySnapshot, null, 2));
    } else {
        console.error("❌ Snapshot missing on saved payslip V1!");
    }

    // 4. Create and Activate Policy V2 (Effective 2026-02-01) with changed NSSF and PAYE rates
    console.log("\n--- Step 4: Activating Policy V2 (effective 2026-02-01, NSSF=12%, PAYE=28% top band) ---");
    const policyV2 = await prisma.tzTaxPolicy.create({
        data: {
            organization_id: orgId,
            version: 2,
            status: "active",
            effective_date: new Date(Date.UTC(2026, 1, 1)),
            employee_nssf_rate: 0.12,
            employer_nssf_rate: 0.12,
            paye_slabs: [
                { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
                { lowerLimit: 270001, upperLimit: 520000, rate: 8, fixedAmount: 0 },
                { lowerLimit: 520001, upperLimit: 760000, rate: 20, fixedAmount: 20000 },
                { lowerLimit: 760001, upperLimit: 1000000, rate: 25, fixedAmount: 68000 },
                { lowerLimit: 1000001, upperLimit: null, rate: 28, fixedAmount: 128000 } // Changed from 30% to 28%
            ]
        }
    });
    console.log(`✔ Policy V2 created successfully (ID: ${policyV2.id}, Status: ${policyV2.status})`);

    // 5. Run payroll calculation for Feb 2026 using V2
    console.log("\n--- Step 5: Running payroll calculation for Feb 2026 using V2 ---");
    const calcV2 = await service.calculatePayrollEngine({
        employeeId: employee.id,
        month: 2,
        year: 2026,
        workingDays: 26,
        lopDays: 0,
        overtimeHours: 0
    });

    const nssfEmpV2 = calcV2.deductions.find(d => d.label === 'NSSF Pension')?.value || 0;
    const payeV2 = calcV2.deductions.find(d => d.label === 'PAYE Tax')?.value || 0;
    const netV2 = calcV2.netPay;

    console.log(`- Gross Salary: 1,200,000 TZS`);
    console.log(`- Calculated NSSF Employee (12%): ${nssfEmpV2} TZS (Expected: 144,000)`);
    console.log(`- Taxable Income (Gross - NSSF): 1,056,000 TZS`);
    console.log(`- Calculated PAYE (slab 5: 128,000 + (1,056,000 - 1,000,000)*28%): ${payeV2} TZS (Expected: 143,680 => rounded to 143,680)`);
    console.log(`- Calculated Net Salary: ${netV2} TZS (Expected: 912,320)`);

    if (nssfEmpV2 === 144000 && payeV2 === 143680 && netV2 === 912320) {
        console.log("✔ V2 Calculations match expected statutory guidelines perfectly!");
    } else {
        console.error("❌ V2 Calculations do not match expectations!");
    }

    // 6. Verify Jan 2026 Payslip remains completely untouched (using V1)
    console.log("\n--- Step 6: Verifying Jan 2026 Payslip remains untouched ---");
    const janPayslipAfterV2 = await prisma.payslip.findUnique({ where: { id: payslipV1.id } });
    const bdJanAfter = janPayslipAfterV2?.breakdown ? (typeof janPayslipAfterV2.breakdown === 'string' ? JSON.parse(janPayslipAfterV2.breakdown) : (janPayslipAfterV2.breakdown as any)) : null;

    if (bdJanAfter && bdJanAfter.taxPolicySnapshot && bdJanAfter.taxPolicySnapshot.taxPolicyVersion === 1) {
        console.log(`✔ Verification Success: Jan 2026 Payslip still records Policy Version ${bdJanAfter.taxPolicySnapshot.taxPolicyVersion}`);
        console.log(`✔ NSSF recorded: ${bdJanAfter.taxPolicySnapshot.employeeNssfCalculated} TZS`);
        console.log(`✔ PAYE recorded: ${bdJanAfter.taxPolicySnapshot.payeCalculated} TZS`);
    } else {
        console.error("❌ Verification failed! Historical payslip snapshot was modified or corrupted.");
    }

    // Cleanup
    await prisma.tzTaxPolicy.deleteMany({ where: { organization_id: orgId } });
    await prisma.payslip.deleteMany({ where: { user_id: employee.id } });
    console.log("\n✔ Database cleaned up successfully");
    console.log("========================================================================= ");
}

validateFunctionalFlow().catch(err => {
    console.error("Validation crashed:", err);
    process.exit(1);
});
