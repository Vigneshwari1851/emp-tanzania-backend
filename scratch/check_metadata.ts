import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function check() {
  const depts = await prisma.department.findMany();
  const roles = await prisma.role.findMany();
  console.log('Departments:', depts);
  console.log('Roles:', roles);
}
check();
