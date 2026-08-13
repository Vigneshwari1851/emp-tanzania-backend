const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const modules = [
        { id: "dashboard", label: "Dashboard" },
        { id: "company_structure", label: "Company Structure" },
        { id: "employee_management", label: "Employee Management" },
        { id: "leave_management", label: "Leave Management" },
        { id: "learning", label: "Learning" },
        { id: "performance", label: "Performance" },
        { id: "engagement", label: "Engagement" },
        { id: "settings", label: "Settings" },
    ];

    console.log("Seeding modules...");

    for (const mod of modules) {
        await prisma.module.upsert({
            where: { id: mod.id },
            update: {},
            create: {
                id: mod.id,
                label: mod.label,
            },
        });

        console.log(`Module ensured: ${mod.label}`);
    }

    console.log("Modules seeding completed ✅");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });