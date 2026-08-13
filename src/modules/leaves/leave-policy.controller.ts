import { Request, Response, NextFunction } from 'express';
import { sendResponse } from '../../utils/response.util';
import { leavePolicyService } from './leave-policy.service';
import { auditService } from '../audit/audit.service';

function _audit(req: any, action: string, entityId: string | number, newValue?: any, oldValue?: any) {
    auditService.log({
        module: 'LEAVE_POLICY',
        action,
        entityId: entityId.toString(),
        actorId: req.user?.id || 0,
        newValue,
        oldValue,
        ipAddress: req.ip
    }).catch(() => { });
}

export const createLeavePolicy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const policy = await leavePolicyService.create(req.body);
    _audit(req, 'LEAVE_POLICY_CREATED', policy.id, req.body);
    sendResponse(res, 201, true, 'Leave policy created successfully', policy);
  } catch (error) {
    next(error);
  }
};

export const getAllLeavePolicies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const policies = await leavePolicyService.getAll();
    sendResponse(res, 200, true, 'Leave policies fetched successfully', policies);
  } catch (error) {
    next(error);
  }
};

export const getLeavePolicyById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const policy = await leavePolicyService.getById(Number(req.params.id));
    sendResponse(res, 200, true, 'Leave policy fetched successfully', policy);
  } catch (error) {
    next(error);
  }
};

export const updateLeavePolicy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const policy = await leavePolicyService.update(Number(req.params.id), req.body);
    _audit(req, 'LEAVE_POLICY_UPDATED', policy.id, req.body);
    sendResponse(res, 200, true, 'Leave policy updated successfully', policy);
  } catch (error) {
    next(error);
  }
};

export const deleteLeavePolicy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await leavePolicyService.delete(Number(req.params.id));
    _audit(req, 'LEAVE_POLICY_DELETED', req.params.id as string);
    sendResponse(res, 200, true, 'Leave policy deleted successfully');
  } catch (error) {
    next(error);
  }
};
