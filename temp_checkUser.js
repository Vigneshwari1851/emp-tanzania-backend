import prisma from './src/shared/prisma/client';

async function main() {
  const email = 'kausalya.deshmukh@socedge.com';
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    include: { details: true }
  });
  console.log('User found:', !!user);
  console.dir(user, { depth: null });
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
