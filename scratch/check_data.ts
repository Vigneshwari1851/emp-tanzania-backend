
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany();
  console.log('Roles:', roles);
  
  const users = await prisma.user.findMany({
    include: {
      details: {
        include: {
          role: true
        }
      }
    }
  });
  console.log('Users with roles:', users.map(u => ({
    username: u.username,
    role: u.details?.role?.role_name
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
