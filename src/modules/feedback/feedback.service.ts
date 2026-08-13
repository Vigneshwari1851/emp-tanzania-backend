import prisma from '../../shared/prisma/client';
import { AppError } from '../../middlewares/error.middleware';
import { notificationService } from '../notifications/notification.service';
import { Prisma } from '@prisma/client';

const FEEDBACK_STATUSES = ['PENDING', 'REVIEWED', 'RESOLVED'];

export const getUserRoleNames = async (userId: number): Promise<string> => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            roles: { include: { role: true } },
            details: { include: { role: true } }
        }
    });
    if (!user) return '';
    return [
        (user as any).role || '',
        user.details?.role?.role_name || '',
        ...(user.roles || []).map(r => r.role?.role_name || (r as any).role_name || '')
    ].join(' ').toUpperCase();
};

const isHR = (roleNames: string): boolean =>
    roleNames.includes('HR') ||
    roleNames.includes('HUMAN') ||
    roleNames.includes('ADMIN') ||
    roleNames.includes('SUPER') ||
    roleNames.includes('CEO');

const findDirectReportIds = async (managerUserId: number): Promise<number[]> => {
    const users = await prisma.user.findMany({
        where: {
            is_deleted: false,
            status: true,
            details: { reporting_manager_id: managerUserId }
        },
        select: { id: true }
    });
    return users.map(u => u.id);
};

const findHRUserIds = async (excludeUserId: number): Promise<number[]> => {
    const users = await prisma.user.findMany({
        where: {
            is_deleted: false,
            status: true,
            id: { not: excludeUserId },
            OR: [
                { roles: { some: { role: { role_name: { contains: 'HR' } } } } },
                { details: { role: { role_name: { contains: 'HR' } } } }
            ]
        },
        select: { id: true }
    });
    return users.map(u => u.id);
};

export class FeedbackService {
    async submit(userId: number, message: string, category?: string) {
        if (!message || !message.trim()) throw new AppError('Feedback message is required', 400);

        const feedback = await prisma.feedback.create({
            data: {
                user_id: userId,
                message: message.trim(),
                category: category?.trim() || 'general',
                status: 'PENDING',
                is_read: false
            }
        });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { details: { select: { first_name: true, last_name: true, reporting_manager_id: true } } }
        });
        const senderName = user?.details
            ? `${user.details.first_name || ''} ${user.details.last_name || ''}`.trim()
            : user?.username || `Employee #${userId}`;

        const reportingManagerId = user?.details?.reporting_manager_id ?? null;
        const hrIds = await findHRUserIds(userId);
        const recipientIds = Array.from(new Set([...(reportingManagerId ? [reportingManagerId] : []), ...hrIds]));
        for (const recipientId of recipientIds) {
            await notificationService.create({
                user_id: recipientId,
                title: 'New Employee Feedback',
                message: `${senderName} submitted new feedback: "${message.trim().slice(0, 200)}"`,
                type: 'FEEDBACK',
                related_module: 'feedback',
                related_id: feedback.id,
                metadata: { feedbackId: feedback.id, userId }
            });
        }

        return feedback;
    }

    async list(userId: number, roleNames: string, options: { page?: number; limit?: number; status?: string }) {
        const isAdmin = isHR(roleNames);
        const page = options.page || 1;
        const limit = options.limit || 10;
        const skip = (page - 1) * limit;

        const visibleUserIds = isAdmin ? null : [
            userId,
            ...(await findDirectReportIds(userId))
        ];

        const where: Prisma.FeedbackWhereInput = {
            ...(visibleUserIds ? { user_id: { in: visibleUserIds } } : {}),
            ...(options.status ? { status: options.status } : {})
        };

        const [total, items] = await Promise.all([
            prisma.feedback.count({ where }),
            prisma.feedback.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            details: {
                                select: {
                                    first_name: true,
                                    last_name: true,
                                    profile_picture: true
                                }
                            }
                        }
                    }
                }
            })
        ]);

        return {
            total,
            page,
            limit,
            total_pages: Math.ceil(total / limit),
            data: items
        };
    }

    private async canAccess(userId: number, roleNames: string, feedbackUserId: number): Promise<boolean> {
        if (isHR(roleNames)) return true;
        if (feedbackUserId === userId) return true;
        const report = await prisma.user.findFirst({
            where: { details: { reporting_manager_id: userId, user_id: feedbackUserId } },
            select: { id: true }
        });
        return !!report;
    }

    async getById(id: number, userId: number, roleNames: string) {
        const feedback = await prisma.feedback.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        details: {
                            select: {
                                first_name: true,
                                last_name: true,
                                profile_picture: true
                            }
                        }
                    }
                }
            }
        });
        if (!feedback) throw new AppError('Feedback not found', 404);
        if (!(await this.canAccess(userId, roleNames, feedback.user_id))) throw new AppError('Forbidden', 403);
        return feedback;
    }

    async markRead(id: number, userId: number, roleNames: string) {
        const feedback = await prisma.feedback.findUnique({ where: { id } });
        if (!feedback) throw new AppError('Feedback not found', 404);
        if (!(await this.canAccess(userId, roleNames, feedback.user_id))) throw new AppError('Forbidden', 403);
        return prisma.feedback.update({
            where: { id },
            data: { is_read: true, read_at: new Date() }
        });
    }

    async updateStatus(id: number, userId: number, roleNames: string, status: string) {
        const isAdmin = isHR(roleNames);
        if (!isAdmin) throw new AppError('Forbidden: Only HR/Admin can update feedback status', 403);
        if (!FEEDBACK_STATUSES.includes(status)) throw new AppError('Invalid status', 400);
        const feedback = await prisma.feedback.findUnique({ where: { id } });
        if (!feedback) throw new AppError('Feedback not found', 404);
        return prisma.feedback.update({
            where: { id },
            data: { status }
        });
    }

    async remove(id: number, userId: number, roleNames: string) {
        const feedback = await prisma.feedback.findUnique({ where: { id } });
        if (!feedback) throw new AppError('Feedback not found', 404);
        if (!(await this.canAccess(userId, roleNames, feedback.user_id))) throw new AppError('Forbidden', 403);
        await prisma.feedback.delete({ where: { id } });
        return { message: 'Feedback deleted successfully' };
    }
}

export const feedbackService = new FeedbackService();
