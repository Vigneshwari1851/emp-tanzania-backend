import { Request, Response, NextFunction } from 'express';
import { PermissionsService } from './permissions.service';
import { sendResponse } from '../../utils/response.util';

const permissionsService = new PermissionsService();

export const listPermissionsGrouped = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await permissionsService.listPermissionsGrouped();
        return sendResponse(res, 200, true, 'Permissions fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getMyPermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // @ts-ignore - Assuming user is attached to req by auth middleware
        const userId = req.user?.id;
        if (!userId) {
            return sendResponse(res, 401, false, 'Unauthorized', null);
        }
        const data = await permissionsService.getMyPermissions(userId);
        return sendResponse(res, 200, true, 'Permissions fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

// Module Controllers
export const createModule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await permissionsService.createModule(req.body);
        return sendResponse(res, 201, true, 'Module created successfully', data);
    } catch (error) {
        next(error);
    }
};

export const updateModule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await permissionsService.updateModule(req.params.id as string, req.body);
        return sendResponse(res, 200, true, 'Module updated successfully', data);
    } catch (error) {
        next(error);
    }
};

export const deleteModule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await permissionsService.deleteModule(req.params.id as string);
        return sendResponse(res, 200, true, 'Module deleted successfully', null);
    } catch (error) {
        next(error);
    }
};

// Permission Controllers
export const createPermission = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await permissionsService.createPermission(req.body);
        return sendResponse(res, 201, true, 'Permission created successfully', data);
    } catch (error) {
        next(error);
    }
};

export const updatePermission = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await permissionsService.updatePermission(parseInt(req.params.id as string), req.body);
        return sendResponse(res, 200, true, 'Permission updated successfully', data);
    } catch (error) {
        next(error);
    }
};

export const deletePermission = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await permissionsService.deletePermission(parseInt(req.params.id as string));
        return sendResponse(res, 200, true, 'Permission deleted successfully', null);
    } catch (error) {
        next(error);
    }
};

export const seedHierarchy = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await permissionsService.seedRequestedHierarchy();
        return sendResponse(res, 200, true, 'Hierarchy seeded successfully', data);
    } catch (error) {
        next(error);
    }
};
