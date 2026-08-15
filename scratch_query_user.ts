import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'manager@gmail.com' },
      include: {
        roles: {
          include: {
            role: true
          }
        },
        details: {
          include: {
            role: true
          }
        }
      }
    });
    
    if (!user) {
      console.log('User manager@gmail.com not found.');
    } else {
      console.log('User found:', {
        id: user.id,
        email: user.email,
        sessionToken: user.sessionToken,
        rolesList: user.roles.map(ur => ({ id: ur.role.id, name: ur.role.role_name })),
        detailsRole: user.details?.role ? { id: user.details.role.id, name: user.details.role.role_name } : null
      });
    }
  } catch (e) {
    console.error('Error querying DB:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
