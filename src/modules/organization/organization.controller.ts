import { Request, Response, NextFunction } from 'express';
import { OrganizationService } from './organization.service';
import { sendResponse } from '../../utils/response.util';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { auditService } from '../audit/audit.service';

function _audit(req: any, action: string, entityId: string | number, newValue?: any, oldValue?: any) {
    auditService.log({
        module: 'ORGANIZATION',
        action,
        entityId: entityId.toString(),
        actorId: req.user?.id || 0,
        newValue,
        oldValue,
        ipAddress: req.ip
    }).catch(() => { });
}

const organizationService = new OrganizationService();

export const createOrganization = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const payload = {
            ...req.body,
            user_id: authReq.user?.id
        };
        const result = await organizationService.create(payload);
        _audit(req, 'ORGANIZATION_CREATED', result.id, result);
        return sendResponse(res, 201, true, 'Organization created successfully', result);
    } catch (error) {
        next(error);
    }
};

export const getAllOrganizations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await organizationService.getAll();
        return sendResponse(res, 200, true, 'Organizations fetched successfully', result);
    } catch (error) {
        next(error);
    }
};

export const getOrganizationById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const result = await organizationService.getById(Number(id));
        return sendResponse(res, 200, true, 'Organization fetched successfully', result);
    } catch (error) {
        next(error);
    }
};

export const getOrganizationBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { slug } = req.params;
        const result = await organizationService.getBySlug(String(slug));
        return sendResponse(res, 200, true, 'Organization fetched successfully', result);
    } catch (error) {
        next(error);
    }
};

export const updateOrganization = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const oldEntity = await organizationService.getById(Number(id));
        const result = await organizationService.update(Number(id), req.body);
        _audit(req, 'ORGANIZATION_UPDATED', String(id), result, oldEntity);
        return sendResponse(res, 200, true, 'Organization updated successfully', result);
    } catch (error) {
        next(error);
    }
};

export const deleteOrganization = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const result = await organizationService.delete(Number(id));
        return sendResponse(res, 200, true, 'Organization deleted successfully', result);
    } catch (error) {
        next(error);
    }
};

export const getOrganizationShifts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const result = await organizationService.getShifts(Number(id));
        return sendResponse(res, 200, true, 'Shifts fetched successfully', result);
    } catch (error) {
        next(error);
    }
};

export const updateOrganizationShift = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id, shiftId } = req.params;
        const result = await organizationService.updateShift(Number(id), String(shiftId), req.body);
        return sendResponse(res, 200, true, 'Shift updated successfully', result);
    } catch (error) {
        next(error);
    }
};