import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.userDetail.findMany({
    select: {
      first_name: true,
      last_name: true,
      date_of_birth: true,
      start_date: true,
      user_id: true,
    }
  });
  
  const today = new Date();
  const celebrations: any[] = [];
  
  for (const u of users) {
    if (u.date_of_birth) {
      const dob = new Date(u.date_of_birth);
      let nextBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      if (nextBday < today) nextBday.setFullYear(today.getFullYear() + 1);
      const diffDays = Math.ceil((nextBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 30) {
        celebrations.push({ name: `${u.first_name} ${u.last_name}`, type: 'Birthday', date: nextBday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), daysAway: diffDays });
      }
    }
    if (u.start_date) {
      const sd = new Date(u.start_date);
      let nextAnniv = new Date(today.getFullYear(), sd.getMonth(), sd.getDate());
      if (nextAnniv < today) nextAnniv.setFullYear(today.getFullYear() + 1);
      const diffDays = Math.ceil((nextAnniv.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 30) {
        celebrations.push({ name: `${u.first_name} ${u.last_name}`, type: 'Work Anniversary', date: nextAnniv.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), daysAway: diffDays });
      }
    }
  }
  
  celebrations.sort((a: any, b: any) => a.daysAway - b.daysAway);
  console.log('=== Upcoming Celebrations (next 30 days) ===');
  console.log(JSON.stringify(celebrations, null, 2));
  console.log('Total:', celebrations.length);
  
  await prisma.$disconnect();
}
main();
