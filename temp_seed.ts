import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ include: { details: true } });
  const harry = users.find(u => u.details && (u.details.first_name === 'Harry' || (u.details.first_name && u.details.first_name.includes('Harry'))));
  
  if (harry && harry.details) {
    console.log('Harry userDetailId:', harry.details.id);
    
    // Check if loan exists
    const existingLoan = await prisma.loan.findFirst({ where: { userDetailId: harry.details.id } });
    if (!existingLoan) {
      await prisma.loan.create({
        data: { userDetailId: harry.details.id, principalAmount: 10000, monthlyRecovery: 2000, outstandingBalance: 10000, isActive: true }
      });
      console.log('Created loan for Harry');
    }
    
    // Check if advance exists
    const existingAdvance = await prisma.advance.findFirst({ where: { userDetailId: harry.details.id } });
    if (!existingAdvance) {
      await prisma.advance.create({
        data: { userDetailId: harry.details.id, principalAmount: 20000, monthlyRecovery: 5000, outstandingBalance: 20000, isActive: true }
      });
      console.log('Created advance for Harry');
    }
  } else {
    console.log('Harry not found!');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
