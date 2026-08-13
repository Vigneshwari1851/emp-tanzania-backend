import { Request, Response, NextFunction } from 'express';
import { designationService } from './designation.service';
import { createDesignationSchema, updateDesignationSchema } from './designation.validator';
import { sendResponse } from '../../utils/response.util';
import { AuthRequest } from '../../middlewares/auth.middleware';

export class DesignationController {
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const validatedData = createDesignationSchema.parse(req.body);
            const orgId = (req as AuthRequest).user?.orgId;
            const designation = await designationService.create({
                ...validatedData,
                organization_id: orgId ?? undefined,
            } as any);
            return sendResponse(res, 201, true, 'Designation created successfully', designation);
        } catch (error: any) {
            if (error?.code === 'P2002' && error?.meta?.target?.includes('designation_name')) {
                return sendResponse(res, 400, false, 'Designation name already exists for this organization', null);
            }
            next(error);
        }
    }

    async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const departmentId = req.query.department_id
                ? parseInt(req.query.department_id as string, 10)
                : undefined;
            const orgId = (req as AuthRequest).user?.orgId || undefined;
            const tree = await designationService.getAll(departmentId, orgId);
            return sendResponse(res, 200, true, 'Designations fetched successfully', tree);
        } catch (error) {
            next(error);
        }
    }

    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const id = parseInt(req.params.id as string, 10);
            const designation = await designationService.getById(id);
            return sendResponse(res, 200, true, 'Designation fetched successfully', designation);
        } catch (error) {
            next(error);
        }
    }

    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const id = parseInt(req.params.id as string, 10);
            const validatedData = updateDesignationSchema.parse(req.body);
            const designation = await designationService.update(id, validatedData);
            return sendResponse(res, 200, true, 'Designation updated successfully', designation);
        } catch (error) {
            next(error);
        }
    }

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const id = parseInt(req.params.id as string, 10);
            const result = await designationService.delete(id);
            return sendResponse(res, 200, true, result.message);
        } catch (error) {
            next(error);
        }
    }

    async getEmployees(req: Request, res: Response, next: NextFunction) {
        try {
            const id = parseInt(req.params.id as string, 10);
            const employees = await designationService.getEmployees(id);
            return sendResponse(res, 200, true, 'Employees fetched successfully', employees);
        } catch (error) {
            next(error);
        }
    }
}

export const designationController = new DesignationController();
