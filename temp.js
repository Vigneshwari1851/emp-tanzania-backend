const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
prisma.payslip.findMany({where: {user_id: 6}, orderBy: {id: 'desc'}}).then(p => { 
  console.log(JSON.stringify(p, null, 2)); 
  prisma.$disconnect(); 
});
