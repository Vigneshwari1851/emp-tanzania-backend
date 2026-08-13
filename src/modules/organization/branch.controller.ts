import { Request, Response, NextFunction } from 'express';
import { branchService } from './branch.service';
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

export const getAllBranches = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const orgId = (req as AuthRequest).user?.orgId || undefined;
        const result = await branchService.getAll(orgId);
        return sendResponse(res, 200, true, 'Branches fetched successfully', result);
    } catch (error) {
        next(error);
    }
};

export const getBranchById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await branchService.getById(Number(req.params.id));
        return sendResponse(res, 200, true, 'Branch fetched successfully', result);
    } catch (error) {
        next(error);
    }
};

export const createBranch = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await branchService.create(req.body);
        _audit(req, 'BRANCH_CREATED', result.id, result);
        return sendResponse(res, 201, true, 'Branch created successfully', result);
    } catch (error: any) {
        next(error);
    }
};

export const updateBranch = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const oldEntity = await branchService.getById(Number(req.params.id));
        const result = await branchService.update(Number(req.params.id), req.body);
        _audit(req, 'BRANCH_UPDATED', String(req.params.id), result, oldEntity);
        return sendResponse(res, 200, true, 'Branch updated successfully', result);
    } catch (error) {
        next(error);
    }
};

export const deleteBranch = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const oldEntity = await branchService.getById(Number(req.params.id));
        const result = await branchService.delete(Number(req.params.id));
        _audit(req, 'BRANCH_DELETED', String(req.params.id), undefined, oldEntity);
        return sendResponse(res, 200, true, result.message, null);
    } catch (error) {
        next(error);
    }
};
