import { PrismaClient } from '@prisma/client';
const bcrypt = require('bcrypt');
const p = new PrismaClient();

async function main() {
  const user = await p.user.findUnique({
    where: { email: 'employee@socedge.com' },
    select: { id: true, email: true, username: true, status: true, is_deleted: true, password: true }
  });
  if (user) {
    console.log('User found:', JSON.stringify({ ...user, password: user.password.substring(0, 20) + '...' }, null, 2));
    const match = await bcrypt.compare('password123', user.password);
    console.log('Password "password123" matches:', match);
    const match2 = await bcrypt.compare('12345678', user.password);
    console.log('Password "12345678" matches:', match2);
  } else {
    console.log('User NOT found');
  }
  await p.$disconnect();
}

main();
