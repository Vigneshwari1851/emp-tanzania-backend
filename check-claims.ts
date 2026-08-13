import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const claims = await prisma.expenseClaim.findMany({
        orderBy: { created_at: 'desc' },
        take: 20,
        include: {
            user: { select: { id: true, email: true } }
        }
    });

    console.log('--- All Claims ---');
    for (const c of claims) {
        console.log(`  ID: ${c.id} | User: ${c.user?.email} (${c.user_id}) | ₹${c.amount} | Status: "${c.status}" | Payment Mode: "${c.payment_mode}" | Payment Status: "${c.payment_status}"`);
    }

    console.log('\n--- Claims matching payroll criteria (status=approved, payment_status=Ready To Pay, payment_mode=Salary Payroll) ---');
    const ready = await prisma.expenseClaim.findMany({
        where: {
            status: 'approved',
            payment_status: 'Ready To Pay',
            payment_mode: 'Salary Payroll'
        }
    });
    console.log(`Found: ${ready.length}`);
    for (const c of ready) {
        console.log(`  ID: ${c.id} | User: ${c.user_id} | ₹${c.amount}`);
    }

    console.log('\n--- Unique statuses ---');
    const statuses = await prisma.expenseClaim.groupBy({ by: ['status'] });
    console.log(statuses.map(s => `"${s.status}"`));

    console.log('\n--- Unique payment_statuses ---');
    const pStatuses = await prisma.expenseClaim.groupBy({ by: ['payment_status'] });
    console.log(pStatuses.map(s => `"${s.payment_status}"`));

    console.log('\n--- Unique payment_modes ---');
    const pModes = await prisma.expenseClaim.groupBy({ by: ['payment_mode'] });
    console.log(pModes.map(s => `"${s.payment_mode}"`));
}

main().finally(() => prisma.$disconnect());
