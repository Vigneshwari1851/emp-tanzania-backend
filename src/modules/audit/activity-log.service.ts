import prisma from '../../shared/prisma/client';

export class ActivityLogService {
    async createLog(data: { user_id?: number, action: string, module: string, description?: string, ip_address?: string }) {
        return await (prisma as any).activityLog.create({
            data
        });
    }

    async listLogs(filters: { module?: string, user_id?: number, action?: string, startDate?: string, endDate?: string }) {
        const where: any = {};
        if (filters.module) where.module = filters.module;
        if (filters.user_id) where.user_id = filters.user_id;
        if (filters.action) where.action = filters.action;
        if (filters.startDate || filters.endDate) {
            where.created_at = {};
            if (filters.startDate) where.created_at.gte = new Date(filters.startDate);
            if (filters.endDate) where.created_at.lte = new Date(filters.endDate);
        }

        return await (prisma as any).activityLog.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        details: {
                            select: {
                                first_name: true,
                                last_name: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        });
    }
}
