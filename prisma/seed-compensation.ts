import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Setting compensation_breakdown for all Org 2 employees...\n');

    const employees = await prisma.userDetail.findMany({
        where: {
            user: { email: { contains: '@testcorp.com' } },
            base_salary: { not: null }
        },
        include: {
            user: { select: { email: true } },
            payroll_group: {
                include: {
                    salary_structure: {
                        include: {
                            components: {
                                include: { salary_component: true },
                                orderBy: { order: 'asc' }
                            }
                        }
                    }
                }
            }
        }
    });

    for (const emp of employees) {
        const email = emp.user?.email || 'unknown';
        const baseSalary = Number(emp.base_salary || 0);
        const components = emp.payroll_group?.salary_structure?.components || [];

        if (components.length === 0) {
            console.log(`⚠️  ${email}: No salary structure components — skipping`);
            continue;
        }

        // Build compensation_breakdown from salary structure components
        const breakdown = components.map((sc: any) => {
            const comp = sc.salary_component;
            const amount = comp.calculation_type === 'percentage'
                ? Math.round((baseSalary * Number(comp.value)) / 100)
                : Number(comp.value);
            return {
                componentType: comp.name,
                name: comp.name,
                amount: String(amount),
                type: comp.type === 'earning' ? 'earning' : 'deduction'
            };
        });

        // CTC = sum of all components
        const ctc = breakdown.reduce((sum: number, item: any) => sum + Number(item.amount), 0);

        await prisma.userDetail.update({
            where: { user_id: emp.user_id },
            data: { compensation_breakdown: breakdown as any }
        });

        console.log(`✅ ${email} (₹${baseSalary}/mo base)`);
        console.log(`   CTC: ₹${ctc.toLocaleString()}`);
        breakdown.forEach((item: any) => {
            console.log(`   ${item.type === 'earning' ? '📈' : '📉'} ${item.componentType}: ₹${Number(item.amount).toLocaleString()}`);
        });
        console.log('');
    }

    console.log('Done!');
}

main().finally(() => prisma.$disconnect());
