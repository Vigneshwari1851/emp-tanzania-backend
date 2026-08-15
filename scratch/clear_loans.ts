import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'employee@example.com' },
        include: { details: true },
    });

    if (!user) {
        console.log('❌ User employee@example.com not found');
        return;
    }

    const userDetailId = user.details?.id;
    console.log(`Found user id=${user.id}, userDetailId=${userDetailId}`);

    if (!userDetailId) {
        console.log('❌ No UserDetail found for this user');
        return;
    }

    // 1. Delete LoanApplication children first (LoanApproval, LoanRepaymentSchedule, LoanDocument cascade via onDelete)
    const apps = await prisma.loanApplication.findMany({ where: { userDetailId } });
    console.log(`Found ${apps.length} LoanApplication(s)`);
    for (const app of apps) {
        await prisma.loanDocument.deleteMany({ where: { applicationId: app.id } });
        await prisma.loanRepaymentSchedule.deleteMany({ where: { applicationId: app.id } });
        await prisma.loanApproval.deleteMany({ where: { applicationId: app.id } });
    }
    const delApps = await prisma.loanApplication.deleteMany({ where: { userDetailId } });
    console.log(`Deleted ${delApps.count} LoanApplication(s)`);

    // 2. Delete legacy Loan records
    const delLoans = await prisma.loan.deleteMany({ where: { userDetailId } });
    console.log(`Deleted ${delLoans.count} legacy Loan(s)`);

    // 3. Delete legacy Advance records
    const delAdvances = await prisma.advance.deleteMany({ where: { userDetailId } });
    console.log(`Deleted ${delAdvances.count} legacy Advance(s)`);

    console.log('✅ All loan & advance records cleared for employee@example.com');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
