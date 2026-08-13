import { Request, Response, NextFunction } from 'express';
import { sendResponse } from '../../utils/response.util';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { feedbackService, getUserRoleNames } from './feedback.service';

export const submitFeedback = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const userId = Number(authReq.user?.id);
        const { message, category } = req.body;
        const feedback = await feedbackService.submit(userId, message, category);
        sendResponse(res, 201, true, 'Feedback submitted successfully', feedback);
    } catch (error) {
        next(error);
    }
};

export const listFeedback = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const userId = Number(authReq.user?.id);
        const roleNames = await getUserRoleNames(userId);
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const result = await feedbackService.list(userId, roleNames, { page, limit, status });
        sendResponse(res, 200, true, 'Feedback fetched successfully', result);
    } catch (error) {
        next(error);
    }
};

export const getFeedbackById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const userId = Number(authReq.user?.id);
        const roleNames = await getUserRoleNames(userId);
        const feedback = await feedbackService.getById(Number(req.params.id), userId, roleNames);
        sendResponse(res, 200, true, 'Feedback fetched successfully', feedback);
    } catch (error) {
        next(error);
    }
};

export const markFeedbackRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const userId = Number(authReq.user?.id);
        const roleNames = await getUserRoleNames(userId);
        const feedback = await feedbackService.markRead(Number(req.params.id), userId, roleNames);
        sendResponse(res, 200, true, 'Feedback marked as read', feedback);
    } catch (error) {
        next(error);
    }
};

export const updateFeedbackStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const userId = Number(authReq.user?.id);
        const roleNames = await getUserRoleNames(userId);
        const { status } = req.body;
        const feedback = await feedbackService.updateStatus(Number(req.params.id), userId, roleNames, status);
        sendResponse(res, 200, true, 'Feedback status updated successfully', feedback);
    } catch (error) {
        next(error);
    }
};

export const deleteFeedback = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const userId = Number(authReq.user?.id);
        const roleNames = await getUserRoleNames(userId);
        const result = await feedbackService.remove(Number(req.params.id), userId, roleNames);
        sendResponse(res, 200, true, 'Feedback deleted successfully', result);
    } catch (error) {
        next(error);
    }
};
