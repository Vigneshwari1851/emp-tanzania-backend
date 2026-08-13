import { Request, Response, NextFunction } from 'express';
import { sendResponse } from '../../utils/response.util';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { changeRequestService } from './change-request.service';

export const createChangeRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const userId = Number(authReq.user?.id);
        const request = await changeRequestService.create(userId, req.body.changes);
        sendResponse(res, 201, true, 'Profile change request submitted for approval', request);
    } catch (error) {
        next(error);
    }
};

export const getMyChangeRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const userId = Number(authReq.user?.id);
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const requests = await changeRequestService.getMyRequests(userId, status);
        sendResponse(res, 200, true, 'Change requests fetched successfully', requests);
    } catch (error) {
        next(error);
    }
};

export const getChangeRequestInbox = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const userId = Number(authReq.user?.id);
        const requests = await changeRequestService.getInbox(userId);
        sendResponse(res, 200, true, 'Approval inbox fetched successfully', requests);
    } catch (error) {
        next(error);
    }
};

export const decideChangeRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const actorId = Number(authReq.user?.id);
        const requestId = Number(req.params.id);
        const { action, role, note } = req.body;
        const request = await changeRequestService.decide(requestId, actorId, action, role, note);
        const message =
            action === 'approve'
                ? `Change request ${role === 'manager' ? 'approved' : 'approved and applied'} successfully`
                : 'Change request rejected successfully';
        sendResponse(res, 200, true, message, request);
    } catch (error) {
        next(error);
    }
};
