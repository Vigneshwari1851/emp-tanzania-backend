import prisma from '../../shared/prisma/client';

export class BankService {
    async getAll() {
        // Fetch predefined banks
        const predefinedBanks = await prisma.bank.findMany({
            orderBy: { name: 'asc' }
        });

        // Fetch unique bank names from UserDetails
        const userBanks = await prisma.userDetail.findMany({
            where: {
                bank_name: { not: null }
            },
            select: {
                bank_name: true
            },
            distinct: ['bank_name']
        });

        // Combine and de-duplicate
        const allBankNames = new Set([
            ...predefinedBanks.map(b => b.name),
            ...userBanks.map(b => b.bank_name as string)
        ]);

        return Array.from(allBankNames).sort().map((name, index) => ({
            id: index + 1,
            name
        }));
    }
}

export const bankService = new BankService();
