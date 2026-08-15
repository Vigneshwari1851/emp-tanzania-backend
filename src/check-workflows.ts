import prisma from './config/prisma'; prisma.loanType.findMany({ include: { approvalWorkflow: true } }).then(r => console.log(JSON.stringify(r, null, 2))).catch(console.error);
