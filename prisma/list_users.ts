import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.user.findMany({ take: 10, select: { id: true, email: true, username: true } }).then(r => { console.table(r); p.$disconnect(); });
