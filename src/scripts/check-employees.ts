import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.userDetail.count();
  const users = await prisma.userDetail.findMany({
    select: {
      first_name: true,
      last_name: true,
      date_of_birth: true,
      start_date: true,
      user_id: true,
    },
    take: 10
  });
  
  console.log('Total employees:', count);
  console.log('Sample employees:');
  console.log(JSON.stringify(users, null, 2));
  
  // Show what dates would be in the next 30 days
  const today = new Date();
  console.log('\nToday:', today.toISOString().split('T')[0]);
  console.log('Looking for birthdays with month-day matching:', 
    `${today.getMonth()+1}-${today.getDate()} to ${new Date(today.getTime() + 30*24*60*60*1000).getMonth()+1}-${new Date(today.getTime() + 30*24*60*60*1000).getDate()}`);
  
  await prisma.$disconnect();
}
main();
