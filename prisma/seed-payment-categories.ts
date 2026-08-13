import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const org = await prisma.organization.findFirst();
    if (!org) {
        console.error("No organization found!");
        return;
    }

    console.log("Seeding Payment Categories...");

    const categories = [
        { name: 'Regular Salary', frequency: 'Monthly', pay_day: 'Last Working Day', status: true },
        { name: 'Annual Bonus', frequency: 'Annually', pay_day: 'March 31st', status: true },
        { name: 'Contractor Payments', frequency: 'Bi-Weekly', pay_day: 'Every 2nd Friday', status: true },
        { name: 'Commission', frequency: 'Quarterly', pay_day: 'End of Quarter', status: true }
    ];

    let count = 0;
    for (const c of categories) {
        const existing = await prisma.paymentCategory.findFirst({
            where: { organization_id: org.id, name: c.name }
        });
        if (!existing) {
            await prisma.paymentCategory.create({
                data: { ...c, organization_id: org.id }
            });
            count++;
        }
    }

    console.log(`Seeded ${count} Payment Categories successfully!`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
