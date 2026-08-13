import { Router } from 'express';
import { notificationController } from './notification.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

// Apply auth middleware to all notification routes
router.use(authenticate);

// List their own notifications and counts
router.get('/', notificationController.getMyNotifications);
router.get('/unread-count', notificationController.getUnreadCount);

// Action routes
router.patch('/mark-all-read', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/:id/metadata', notificationController.updateMetadata);
router.delete('/:id', notificationController.delete);

// Admin-level or system-level creation (Optional: protect with authorize('notifications.create') if needed)
router.post('/', notificationController.create);

// Send celebration wish
router.post('/send-wish', notificationController.sendWish);

export default router;
