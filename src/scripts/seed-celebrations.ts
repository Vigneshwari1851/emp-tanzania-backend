import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Update employees with null DOB to have upcoming birthdays
  const updates = [
    { userId: 9, dob: '2026-06-22', startDate: '2022-06-22' },  // HR Manager - 7 days away
    { userId: 10, dob: '2026-07-01', startDate: '2023-07-01' }, // HR Executive - 16 days
    { userId: 11, dob: '2026-06-28', startDate: '2021-06-28' }, // Finance Manager - 13 days
    { userId: 12, dob: '2026-06-18', startDate: '2024-06-18' }, // Finance Executive - 3 days
  ];

  for (const u of updates) {
    await prisma.userDetail.update({
      where: { user_id: u.userId },
      data: {
        date_of_birth: new Date(u.dob),
        start_date: new Date(u.startDate),
      }
    });
    console.log(`Updated user ${u.userId} -> DOB: ${u.dob}, Start: ${u.startDate}`);
  }

  // Verify
  const users = await prisma.userDetail.findMany({
    select: { first_name: true, last_name: true, date_of_birth: true, start_date: true },
  });
  
  console.log('\nAll employees after update:');
  const today = new Date();
  for (const u of users) {
    let info = `${u.first_name} ${u.last_name}`;
    if (u.date_of_birth) {
      const dob = new Date(u.date_of_birth);
      const nextBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      const diffDays = Math.ceil((nextBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 30) {
        info += ` 🎂 Birthday in ${diffDays}d (${dob.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
      } else if (diffDays < 0) {
        info += ` 🎂 Birthday already passed this year (${dob.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
      } else {
        info += ` (DOB: ${u.date_of_birth.toISOString().split('T')[0]})`;
      }
    }
    if (u.start_date) {
      const sd = new Date(u.start_date);
      const nextAnniv = new Date(today.getFullYear(), sd.getMonth(), sd.getDate());
      const diffDays = Math.ceil((nextAnniv.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 30) {
        info += ` 🎉 Anniversary in ${diffDays}d`;
      }
    }
    console.log(info);
  }

  await prisma.$disconnect();
}
main();
