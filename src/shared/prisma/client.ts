// FIX: Re-export single PrismaClient from config/prisma.ts.
// Previously created a second PrismaClient instance causing connection pool issues → 500.
import prisma from '../../config/prisma';

export default prisma;
