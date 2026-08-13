import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // Check what claims exist for Org 2
    const org2Claims = await prisma.expenseClaim.findMany({
        where: { organization_id: 2 }
    });
    console.log('Org 2 claims:', org2Claims.length);
    for (const c of org2Claims) {
        console.log(`  ID: ${c.id} | User: ${c.user_id} | ₹${c.amount} | Status: "${c.status}" | Payment: "${c.payment_status}" | Mode: "${c.payment_mode}"`);
    }

    // If no Org 2 claims, create one and run full flow
    if (org2Claims.length === 0) {
        console.log('\nNo Org 2 claims found. Creating test claim and running full flow...');
        
        const claim = await prisma.expenseClaim.create({
            data: {
                user_id: 243, // employee@testcorp.com
                organization_id: 2,
                type: 'Travel',
                amount: 3200,
                description: 'Client visit travel reimbursement',
                expense_date: new Date(),
                status: 'approved',
                payment_mode: 'Salary Payroll',
                payment_status: 'Ready To Pay'
            }
        });
        console.log('Created claim ID:', claim.id, '| ₹3200 | approved | Ready To Pay | Salary Payroll');

        // Now check if payroll engine finds it
        const found = await prisma.expenseClaim.findMany({
            where: {
                user_id: 243,
                status: 'approved',
                payment_status: 'Ready To Pay',
                payment_mode: 'Salary Payroll'
            }
        });
        console.log('Payroll engine would find:', found.length, 'claim(s)');
        for (const c of found) {
            console.log(`  ID: ${c.id} | ₹${c.amount}`);
        }
    }
}

main().finally(() => prisma.$disconnect());
