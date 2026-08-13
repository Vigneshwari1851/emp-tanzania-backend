import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();

async function main() {
    const orgId = 2;
    const hashedPassword = await bcrypt.hash('test1234', 10);

    const existingUser = await prisma.user.findUnique({ where: { email: 'priya@testcorp.com' } });
    if (existingUser) { console.log('Already exists with id:', existingUser.id); return; }

    const payrollGroup = await prisma.payrollGroup.findFirst({ where: { organization_id: orgId } });
    const branch = await prisma.branch.findFirst({ where: { organization_id: orgId } });
    const dept = await prisma.department.findFirst({ where: branch ? { branch_id: branch.id } : {} });
    const desig = await prisma.designation.findFirst({ where: { organization_id: orgId } });
    const role = await prisma.role.findFirst({ where: { organization_id: orgId, role_name: 'employee' } });

    console.log('Payroll Group:', payrollGroup?.id, 'Dept:', dept?.id, 'Desig:', desig?.id, 'Role:', role?.id);

    const user = await prisma.user.create({
        data: {
            email: 'priya@testcorp.com',
            username: 'priya_sharma',
            password: hashedPassword,
            status: true,
            is_deleted: false,
        }
    });

    await prisma.userDetail.create({
        data: {
            user_id: user.id,
            employee_id: 'EMP-TC-007',
            first_name: 'Priya',
            last_name: 'Sharma',
            date_of_birth: new Date('1995-03-15'),
            gender: 'Female',
            phone: '9876543210',
            department_id: dept?.id,
            designation_id: desig?.id,
            role_id: role?.id,
            joining_date: new Date('2024-06-01'),
            employment_type: 'Full-time',
            base_salary: 95000,
            payroll_group_id: payrollGroup?.id,
            compensation_breakdown: [
                { componentType: 'Basic Salary', name: 'Basic Salary', amount: '38000', type: 'earning' },
                { componentType: 'HRA', name: 'HRA', amount: '19000', type: 'earning' },
                { componentType: 'Special Allowance', name: 'Special Allowance', amount: '28500', type: 'earning' },
                { componentType: 'PF - Employee', name: 'PF - Employee', amount: '11400', type: 'deduction' },
                { componentType: 'Professional Tax', name: 'Professional Tax', amount: '200', type: 'deduction' }
            ]
        }
    });

    if (role) {
        await prisma.userRole.create({ data: { user_id: user.id, role_id: role.id } });
    }

    console.log('\n✅ Employee created:');
    console.log('   Email: priya@testcorp.com');
    console.log('   Password: test1234');
    console.log('   User ID:', user.id);
    console.log('   Base Salary: ₹95,000');
    console.log('   CTC: ₹97,100');
    console.log('   Payroll Group:', payrollGroup?.name);
}

main().finally(() => prisma.$disconnect());
