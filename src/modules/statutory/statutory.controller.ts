import { Request, Response, NextFunction } from 'express';
import { sendResponse, sendError } from '../../utils/response.util';
import { statutoryService } from './statutory.service';
import { AuthRequest } from '../../middlewares/auth.middleware';

export const getPayeBands = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const orgId = req.user?.orgId;
        if (!orgId) return sendError(res, 400, 'Organization not found');

        const bands = await statutoryService.getPayeBands(orgId);
        sendResponse(res, 200, true, 'PAYE bands fetched', bands);
    } catch (error) {
        next(error);
    }
};

export const savePayeBands = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const orgId = req.user?.orgId;
        if (!orgId) return sendError(res, 400, 'Organization not found');

        const { bands } = req.body;
        const result = await statutoryService.savePayeBands(orgId, bands);
        sendResponse(res, 200, true, 'PAYE bands saved successfully', result);
    } catch (error) {
        next(error);
    }
};

export const getConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const orgId = req.user?.orgId;
        if (!orgId) return sendError(res, 400, 'Organization not found');

        const configType = String(req.params.configType);
        const config = await statutoryService.getConfig(orgId, configType);
        sendResponse(res, 200, true, 'Config fetched', config);
    } catch (error) {
        next(error);
    }
};

export const setConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const orgId = req.user?.orgId;
        if (!orgId) return sendError(res, 400, 'Organization not found');

        const configType = String(req.params.configType);
        const { key, value } = req.body;

        if (!key || value === undefined) {
            return sendError(res, 400, 'key and value are required');
        }

        await statutoryService.setConfig(orgId, configType, key, value);
        sendResponse(res, 200, true, 'Config updated');
    } catch (error) {
        next(error);
    }
};
