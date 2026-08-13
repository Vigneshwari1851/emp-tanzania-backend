import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Updating employee 1 compensation data...');

    const breakdown = [
        { componentType: "Base Salary", amount: "10000", frequency: "Monthly" },
        { componentType: "HRA", amount: "5000", frequency: "Monthly" }
    ];

    await prisma.userDetail.update({
        where: { user_id: 1 },
        data: {
            base_salary: 15000,
            currency: "USD",
            salary_frequency: "Monthly",
            compensation_breakdown: breakdown
        }
    });

    console.log('Update finished successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
