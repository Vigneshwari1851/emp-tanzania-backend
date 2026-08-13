import { Request, Response, NextFunction } from 'express';
import { departmentService } from './department.service';
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

export const getAllDepartments = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const orgId = (req as AuthRequest).user?.orgId || undefined;
        const result = await departmentService.getAll(orgId);
        return sendResponse(res, 200, true, 'Departments fetched successfully', result);
    } catch (error) {
        next(error);
    }
};

export const getDepartmentById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await departmentService.getById(Number(req.params.id));
        return sendResponse(res, 200, true, 'Department fetched successfully', result);
    } catch (error) {
        next(error);
    }
};


export const createDepartment = async (req: Request, res: Response) => {
    try {
        const result = await departmentService.create(req.body);
        _audit(req, 'DEPARTMENT_CREATED', result.id, result);
        return sendResponse(res, 201, true, 'Department created successfully', result);
    } catch (error: any) {
        return sendResponse(res, 500, false, error.message);
    }
};


export const updateDepartment = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const oldEntity = await departmentService.getById(Number(req.params.id));
        const result = await departmentService.update(Number(req.params.id), req.body);
        _audit(req, 'DEPARTMENT_UPDATED', String(req.params.id), result, oldEntity);
        return sendResponse(res, 200, true, 'Department updated successfully', result);
    } catch (error) {
        next(error);
    }
};

export const deleteDepartment = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const oldEntity = await departmentService.getById(Number(req.params.id));
        const result = await departmentService.delete(Number(req.params.id));
        _audit(req, 'DEPARTMENT_DELETED', String(req.params.id), undefined, oldEntity);
        return sendResponse(res, 200, true, result.message, null);
    } catch (error) {
        next(error);
    }
};

export const getDepartmentManager = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { departmentId } = req.query;
        if (!departmentId) {
            return sendResponse(res, 400, false, 'departmentId is required in query parameters');
        }
        const result = await departmentService.getDepartmentManager(Number(departmentId));
        return sendResponse(res, 200, true, 'Department manager fetched successfully', result);
    } catch (error) {
        next(error);
    }
};


export const getEmployeesByDepartment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { departmentId } = req.params;
        const employees = await departmentService.getEmployeesByDepartment(
            departmentId ? parseInt(departmentId as string) : undefined
        );
        sendResponse(res, 200, true, 'Available employees fetched successfully', employees);
    } catch (error) {
        next(error);
    }
};
