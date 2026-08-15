import prisma from './config/prisma'; prisma.notification.findMany({ orderBy: { created_at: 'desc' }, take: 10 }).then(r => console.log(JSON.stringify(r, null, 2))).catch(console.error);
