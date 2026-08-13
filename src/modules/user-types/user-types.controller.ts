import { Request, Response, NextFunction } from 'express';
import { userTypeService } from './user-types.service';
import { sendResponse } from '../../utils/response.util';
import { auditService } from '../audit/audit.service';

function _audit(req: any, action: string, entityId: string | number, newValue?: any, oldValue?: any) {
  auditService.log({
    module: 'SETTINGS',
    action,
    entityId: entityId.toString(),
    actorId: req.user?.id || 0,
    newValue,
    oldValue,
    ipAddress: req.ip
  }).catch(() => { });
}

export class UserTypeController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = (req as any).user?.orgId;
      const data = { ...req.body, organization_id: orgId };
      const result = await userTypeService.create(data);
      _audit(req, 'USER_TYPE_CREATED', result.id, result);
      return sendResponse(res, 201, true, 'User type created successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = (req as any).user?.orgId;
      const result = await userTypeService.getAll(orgId);
      return sendResponse(res, 200, true, 'User types fetched successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      const result = await userTypeService.getById(id);
      return sendResponse(res, 200, true, 'User type fetched successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      const oldEntity = await userTypeService.getById(id);
      const result = await userTypeService.update(id, req.body);
      _audit(req, 'USER_TYPE_UPDATED', id, result, oldEntity);
      return sendResponse(res, 200, true, 'User type updated successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      const oldEntity = await userTypeService.getById(id);
      const result = await userTypeService.delete(id);
      _audit(req, 'USER_TYPE_DELETED', id, undefined, oldEntity);
      return sendResponse(res, 200, true, result.message);
    } catch (error) {
      next(error);
    }
  }

  async getModules(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await userTypeService.getModules();
      return sendResponse(res, 200, true, 'Modules fetched successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async getAssignedModules(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      const result = await userTypeService.getAssignedModules(id);
      return sendResponse(res, 200, true, 'Assigned modules fetched successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async updateAssignedModules(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { moduleIds } = req.body;
      const oldEntity = await userTypeService.getAssignedModules(id);
      const result = await userTypeService.updateAssignedModules(id, moduleIds || []);
      _audit(req, 'USER_TYPE_PERMISSIONS_UPDATED', id, result, oldEntity);
      return sendResponse(res, 200, true, 'Modules updated successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

export const userTypeController = new UserTypeController();
