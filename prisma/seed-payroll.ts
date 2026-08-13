import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Payroll Data...');

    // Get an organization
    const org = await prisma.organization.findFirst();
    if (!org) {
        console.error("No organization found! Cannot seed payroll without an org.");
        return;
    }

    // 8. Create Salary Components
    const componentsData = [
        { name: 'Basic Salary', type: 'earning', calculation_type: 'percentage', value: 40, is_taxable: true, is_statutory: false },
        { name: 'HRA', type: 'earning', calculation_type: 'percentage', value: 20, is_taxable: true, is_statutory: false },
        { name: 'Special Allowance', type: 'earning', calculation_type: 'percentage', value: 30, is_taxable: true, is_statutory: false },
        { name: 'PF Employee', type: 'deduction', calculation_type: 'percentage', value: 12, is_taxable: false, is_statutory: true },
        { name: 'Professional Tax', type: 'deduction', calculation_type: 'fixed', value: 200, is_taxable: false, is_statutory: true },
    ];

    const createdComponents = [];
    for (const comp of componentsData) {
        let c = await prisma.salaryComponent.findFirst({
            where: { organization_id: org.id, name: comp.name }
        });
        if (!c) {
            c = await prisma.salaryComponent.create({
                data: { ...comp, organization_id: org.id }
            });
        }
        createdComponents.push(c);
    }
    console.log(`Seeded ${createdComponents.length} Salary Components.`);

    // 9. Create Salary Structures
    const structuresData = [
        { name: 'Software Engineer Standard', level: 'role' },
        { name: 'Senior Developer Standard', level: 'role' },
    ];

    for (const struct of structuresData) {
        let s = await prisma.salaryStructure.findFirst({
            where: { organization_id: org.id, name: struct.name }
        });
        if (!s) {
            s = await prisma.salaryStructure.create({
                data: { ...struct, organization_id: org.id }
            });
        }

        // Assign components to structures
        for (let i = 0; i < createdComponents.length; i++) {
            await prisma.salaryStructureComponent.upsert({
                where: {
                    salary_structure_id_salary_component_id: {
                        salary_structure_id: s.id,
                        salary_component_id: createdComponents[i]!.id
                    }
                },
                update: { order: i },
                create: {
                    salary_structure_id: s.id,
                    salary_component_id: createdComponents[i]!.id,
                    order: i
                }
            });
        }
    }
    console.log(`Seeded Salary Structures.`);

    // 12. Create Payroll Groups
    const groupData = [
        { name: 'Mumbai - Engineering', criteria: { location: 'Mumbai', dept: 'Engineering' } },
        { name: 'Delhi - Sales', criteria: { location: 'Delhi', dept: 'Sales' } },
        { name: 'Bangalore - HQ', criteria: { location: 'Bangalore' } },
    ];

    for (const g of groupData) {
        const existing = await prisma.payrollGroup.findFirst({
            where: { organization_id: org.id, name: g.name }
        });
        if (!existing) {
            await prisma.payrollGroup.create({
                data: { ...g, organization_id: org.id }
            });
        }
    }
    console.log(`Seeded Payroll Groups.`);
    console.log('Payroll Seeding Completed Successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
