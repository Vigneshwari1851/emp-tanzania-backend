import { Request, Response } from 'express';
import { notificationService } from './notification.service';
import { sendResponse, sendError } from '../../utils/response.util';
import { AuthRequest } from '../../middlewares/auth.middleware';

export class NotificationController {
    async create(req: AuthRequest, res: Response) {
        try {
            const { user_id, title, message, type } = req.body;
            
            if (!user_id || !title || !message) {
                return sendError(res, 400, 'user_id, title, and message are required');
            }

            const notification = await notificationService.create({ user_id, title, message, type });
            return sendResponse(res, 201, true, 'Notification created successfully', notification);
        } catch (error: any) {
            return sendError(res, error.statusCode || 500, error.message || 'Error creating notification');
        }
    }

    async getMyNotifications(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const unreadOnly = req.query.unreadOnly === 'true';

            const result = await notificationService.getMyNotifications(userId, { page, limit, unreadOnly });
            return sendResponse(res, 200, true, 'Notifications retrieved successfully', result);
        } catch (error: any) {
            return sendError(res, error.statusCode || 500, error.message || 'Error fetching notifications');
        }
    }

    async getUnreadCount(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const result = await notificationService.getUnreadCount(userId);
            return sendResponse(res, 200, true, 'Unread count retrieved successfully', result);
        } catch (error: any) {
            return sendError(res, error.statusCode || 500, error.message || 'Error fetching unread count');
        }
    }

    async markAsRead(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const notificationId = parseInt(req.params.id as string);

            if (isNaN(notificationId)) {
                return sendError(res, 400, 'Invalid notification ID');
            }

            const result = await notificationService.markAsRead(notificationId, userId);
            return sendResponse(res, 200, true, 'Notification marked as read', result);
        } catch (error: any) {
            return sendError(res, error.statusCode || 500, error.message || 'Error marking notification as read');
        }
    }

    async markAllAsRead(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const result = await notificationService.markAllAsRead(userId);
            return sendResponse(res, 200, true, 'All notifications marked as read', result);
        } catch (error: any) {
            return sendError(res, error.statusCode || 500, error.message || 'Error marking notifications as read');
        }
    }

    async updateMetadata(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const notificationId = parseInt(req.params.id as string);
            const { metadata } = req.body;

            if (isNaN(notificationId)) {
                return sendError(res, 400, 'Invalid notification ID');
            }

            if (!metadata) {
                return sendError(res, 400, 'Metadata is required');
            }

            const result = await notificationService.updateMetadata(notificationId, userId, metadata);
            return sendResponse(res, 200, true, 'Notification metadata updated successfully', result);
        } catch (error: any) {
            return sendError(res, error.statusCode || 500, error.message || 'Error updating notification metadata');
        }
    }

    async delete(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const notificationId = parseInt(req.params.id as string);

            if (isNaN(notificationId)) {
                return sendError(res, 400, 'Invalid notification ID');
            }

            const result = await notificationService.delete(notificationId, userId);
            return sendResponse(res, 200, true, 'Notification deleted successfully', result);
        } catch (error: any) {
            return sendError(res, error.statusCode || 500, error.message || 'Error deleting notification');
        }
    }

    async sendWish(req: AuthRequest, res: Response) {
        try {
            const senderId = req.user!.id;
            const { recipient_id, type } = req.body;

            if (!recipient_id || !type) {
                return sendError(res, 400, 'recipient_id and type (birthday|anniversary) are required');
            }

            if (!['birthday', 'anniversary'].includes(type)) {
                return sendError(res, 400, 'type must be "birthday" or "anniversary"');
            }

            const notification = await notificationService.sendWish(senderId, recipient_id, type);
            return sendResponse(res, 201, true, 'Wish sent successfully', notification);
        } catch (error: any) {
            return sendError(res, error.statusCode || 500, error.message || 'Error sending wish');
        }
    }
}

export const notificationController = new NotificationController();
