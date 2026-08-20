import { PayrollService } from '../payroll.service';
import prisma from '../../../config/prisma';

async function runTests() {
    console.log("=== Running Tanzania Tax Policy Phase 2 Tests ===");
    const service = new PayrollService();
    let passed = 0;
    let failed = 0;

    const expectThrow = async (fn: () => any, messagePart: string) => {
        try {
            await fn();
            console.error(`❌ Expected error containing "${messagePart}", but no error was thrown.`);
            failed++;
        } catch (e: any) {
            if (e.message && e.message.toLowerCase().includes(messagePart.toLowerCase())) {
                console.log(`✔ Correctly threw expected error: "${e.message}"`);
                passed++;
            } else {
                console.error(`❌ Threw wrong error: "${e.message}" (expected: "${messagePart}")`);
                failed++;
            }
        }
    };

    // --- TEST GROUP 1: SLAB VALIDATIONS ---
    console.log("\n--- Slab Validation Tests ---");

    // Valid slabs
    try {
        service.validateTzPayeSlabs([
            { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
            { lowerLimit: 270001, upperLimit: 520000, rate: 8, fixedAmount: 0 },
            { lowerLimit: 520001, upperLimit: null, rate: 20, fixedAmount: 20000 }
        ]);
        console.log("✔ Valid slabs successfully validated");
        passed++;
    } catch (e: any) {
        console.error("❌ Valid slabs failed validation:", e.message);
        failed++;
    }

    // Invalid order
    await expectThrow(() => {
        return service.validateTzPayeSlabs([
            { lowerLimit: 270001, upperLimit: 520000, rate: 8, fixedAmount: 0 },
            { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
            { lowerLimit: 520001, upperLimit: null, rate: 20, fixedAmount: 20000 }
        ]);
    }, "ordered by lower limit");

    // Negative rate
    await expectThrow(() => {
        return service.validateTzPayeSlabs([
            { lowerLimit: 0, upperLimit: 270000, rate: -5, fixedAmount: 0 },
            { lowerLimit: 270001, upperLimit: null, rate: 8, fixedAmount: 0 }
        ]);
    }, "Tax rate must be a non-negative");

    // Final slab not open-ended
    await expectThrow(() => {
        return service.validateTzPayeSlabs([
            { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
            { lowerLimit: 270001, upperLimit: 520000, rate: 8, fixedAmount: 0 }
        ]);
    }, "final PAYE slab must be open-ended");

    // Middle slab open-ended
    await expectThrow(() => {
        return service.validateTzPayeSlabs([
            { lowerLimit: 0, upperLimit: null, rate: 0, fixedAmount: 0 },
            { lowerLimit: 270001, upperLimit: null, rate: 8, fixedAmount: 0 }
        ]);
    }, "cannot be open-ended");

    // Gap detected
    await expectThrow(() => {
        return service.validateTzPayeSlabs([
            { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
            { lowerLimit: 280000, upperLimit: null, rate: 8, fixedAmount: 0 }
        ]);
    }, "Gap or overlap detected");


    // --- TEST GROUP 2: CRUD & LIFECYCLE ---
    console.log("\n--- CRUD & Lifecycle DB Tests ---");
    const org = await prisma.organization.findFirst();
    if (!org) {
        console.error("❌ No organization found in the database. Cannot run database CRUD tests.");
        process.exit(1);
    }
    const testOrgId = org.id;

    try {
        // Cleanup old test data
        await prisma.tzTaxPolicy.deleteMany({ where: { organization_id: testOrgId } });

        // 1. Create a draft policy
        const policy1 = await service.createTzTaxPolicy(testOrgId, {
            effective_date: "2026-09-01",
            status: "draft",
            employee_nssf_rate: 0.10,
            employer_nssf_rate: 0.10,
            paye_slabs: [
                { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
                { lowerLimit: 270001, upperLimit: null, rate: 10, fixedAmount: 0 }
            ]
        });
        console.log(`✔ Draft policy created (ID: ${policy1.id}, Version: ${policy1.version})`);
        passed++;

        // 2. Edit draft policy (allowed)
        const updatedPolicy1 = await service.updateTzTaxPolicy(policy1.id, testOrgId, {
            employee_nssf_rate: 0.12
        });
        if (Number(updatedPolicy1.employee_nssf_rate) === 0.12) {
            console.log("✔ Editing draft policy succeeded");
            passed++;
        } else {
            console.error("❌ Editing draft policy failed to save update");
            failed++;
        }

        // 3. Create active policy
        const policy2 = await service.createTzTaxPolicy(testOrgId, {
            effective_date: "2026-09-01",
            status: "active",
            employee_nssf_rate: 0.10,
            employer_nssf_rate: 0.10,
            paye_slabs: [
                { lowerLimit: 0, upperLimit: 270000, rate: 0, fixedAmount: 0 },
                { lowerLimit: 270001, upperLimit: null, rate: 10, fixedAmount: 0 }
            ]
        });
        console.log(`✔ Active policy created (ID: ${policy2.id}, Version: ${policy2.version})`);
        passed++;

        // 4. Try to edit active policy (should throw error)
        await expectThrow(() => {
            return service.updateTzTaxPolicy(policy2.id, testOrgId, {
                employee_nssf_rate: 0.15
            });
        }, "Active tax policies cannot be edited");

        // 5. Conflicting active policy for the same effective date (should throw error)
        await expectThrow(() => {
            return service.createTzTaxPolicy(testOrgId, {
                effective_date: "2026-09-01",
                status: "active",
                employee_nssf_rate: 0.10,
                employer_nssf_rate: 0.10,
                paye_slabs: [
                    { lowerLimit: 0, upperLimit: null, rate: 0, fixedAmount: 0 }
                ]
            });
        }, "An active tax policy already exists for this effective date");

        // Clean up
        await prisma.tzTaxPolicy.deleteMany({ where: { organization_id: testOrgId } });
        console.log("✔ Database cleaned up successfully");

    } catch (e: any) {
        console.error("❌ CRUD/Lifecycle DB Tests crashed:", e);
        failed++;
    }

    console.log(`\n=== Tests Completed: ${passed} Passed, ${failed} Failed ===`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error("Test execution crashed:", err);
    process.exit(1);
});
