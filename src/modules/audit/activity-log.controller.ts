import { Request, Response, NextFunction } from 'express';
import { ActivityLogService } from './activity-log.service';
import { sendResponse } from '../../utils/response.util';

const activityLogService = new ActivityLogService();

export const listLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filters = req.query;
        const logs = await activityLogService.listLogs(filters);
        return sendResponse(res, 200, true, 'Activity logs fetched successfully', logs);
    } catch (error) {
        next(error);
    }
};

export const createLog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const log = await activityLogService.createLog(req.body);
        return sendResponse(res, 201, true, 'Activity log created successfully', log);
    } catch (error) {
        next(error);
    }
};
