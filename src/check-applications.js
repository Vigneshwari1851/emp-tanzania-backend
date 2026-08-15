const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const apps = await prisma.loanApplication.findMany({
        
        include: {
            loanType: { include: { approvalWorkflow: true } },
            approvals: true,
            userDetail: { include: { user: true } }
        }
    });

    console.log('--- ALL ACTIVE APPLICATIONS ---');
    for (const app of apps) {
        console.log(`App ID: ${app.id} | Num: ${app.applicationNumber} | Status: ${app.status} | CurrentStep: ${app.currentStep}`);
        console.log(`  User: ${app.userDetail?.user?.email}`);
        if (app.loanType) {
            console.log(`  Loan Type: ${app.loanType.name}`);
            console.log(`  Workflow Steps:`);
            for (const step of app.loanType.approvalWorkflow) {
                console.log(`    Step ${step.stepOrder}: Role: "${step.roleName}"`);
            }
        }
        console.log('-----------------------------');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
