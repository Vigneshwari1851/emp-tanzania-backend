import prisma from '../../shared/prisma/client';

export class IntegrationService {
    async listIntegrations() {
        return await (prisma as any).integration.findMany({
            orderBy: { created_at: 'desc' }
        });
    }

    async updateIntegration(id: number, data: { status?: boolean, config?: any }) {
        return await (prisma as any).integration.update({
            where: { id },
            data
        });
    }

    async getById(id: number) {
        return await (prisma as any).integration.findUnique({
            where: { id }
        });
    }

    // For initializing common integrations if they don't exist
    async seedIntegrations() {
        const count = await (prisma as any).integration.count();
        if (count === 0) {
            await (prisma as any).integration.createMany({
                data: [
                    { name: 'Slack', provider: 'slack', status: false },
                    { name: 'Google Calendar', provider: 'google-calendar', status: false },
                    { name: 'Microsoft Teams', provider: 'ms-teams', status: false }
                ]
            });
        }
    }
}
