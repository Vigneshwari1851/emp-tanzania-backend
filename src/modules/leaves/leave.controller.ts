import { Request, Response, NextFunction } from 'express';
import { sendResponse } from '../../utils/response.util';
import { leaveService } from './leave.service';
import { auditService } from '../audit/audit.service';

function _audit(req: any, action: string, entityId: string | number, newValue?: any, oldValue?: any) {
    auditService.log({
        module: 'LEAVE',
        action,
        entityId: entityId.toString(),
        actorId: req.user?.id || 0,
        newValue,
        oldValue,
        ipAddress: req.ip
    }).catch(() => { });
}

export const applyLeave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const leave = await leaveService.applyLeave(userId, req.body);
    const action = req.body.id ? 'LEAVE_UPDATED' : 'LEAVE_CREATED';
    _audit(req, action, leave.id, req.body);
    sendResponse(res, 201, true, 'Leave application submitted successfully', leave);
  } catch (error) {
    next(error);
  }
};

export const getMyLeaveRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const requests = await leaveService.getMyLeaveRequests(userId);
    sendResponse(res, 200, true, 'Leave requests fetched successfully', requests);
  } catch (error) {
    next(error);
  }
};

export const getPendingLeaveRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const userId = user.id;
    const roles = user.roles || [];
    
    const isSuperAdmin = roles.some((r: string) => ['SUPERADMIN', 'CEO', 'SYSTEMADMINISTRATOR'].includes(r.toUpperCase().replace(/[\s_]+/g, '')));
    const isAdmin = roles.some((r: string) => ['ADMIN', 'SYSTEMADMINISTRATOR'].includes(r.toUpperCase().replace(/[\s_]+/g, '')));
    const isManager = roles.some((r: string) => ['MANAGER', 'TEAMMANAGER'].includes(r.toUpperCase().replace(/[\s_]+/g, '')));
    const isHR = roles.some((r: string) => ['HR', 'HRMANAGER'].includes(r.toUpperCase().replace(/[\s_]+/g, '')));

    // Super Admin, Admin, and HR see all pending requests. Managers only see their direct reports.
    const managerId = (isSuperAdmin || isAdmin || isHR) ? undefined : userId;
    const orgId = user.orgId;

    const requests = await leaveService.getPendingRequests(managerId, orgId);
    sendResponse(res, 200, true, 'Pending leave requests fetched successfully', requests);
  } catch (error) {
    next(error);
  }
};

export const getLeaveHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { search, user_id, leave_policy_id, status, page, limit } = req.query;

    const roles = user.roles || [];
    const isSuperAdmin = roles.some((r: string) => ['SUPERADMIN', 'CEO', 'SYSTEMADMINISTRATOR'].includes(r.toUpperCase().replace(/[\s_]+/g, '')));
    const isAdmin = roles.some((r: string) => ['ADMIN', 'SYSTEMADMINISTRATOR'].includes(r.toUpperCase().replace(/[\s_]+/g, '')));
    const isManager = roles.some((r: string) => ['MANAGER', 'TEAMMANAGER'].includes(r.toUpperCase().replace(/[\s_]+/g, '')));
    const isHR = roles.some((r: string) => ['HR', 'HRMANAGER'].includes(r.toUpperCase().replace(/[\s_]+/g, '')));

    // All management roles see all history. Managers only see their reports.
    // Employees can see ALL APPROVED history (for calendar visibility) but we filter details in service if needed.
    const reporting_manager_id = (isSuperAdmin || isAdmin || isHR) ? undefined : (status === 'APPROVED' ? undefined : user.id);
    const orgId = user.orgId;

    const history = await leaveService.getLeaveHistory({
      search: search as string,
      user_id: user_id ? Number(user_id) : undefined,
      leave_policy_id: leave_policy_id ? Number(leave_policy_id) : (undefined as any),
      status: status as string,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      reporting_manager_id: reporting_manager_id ? Number(reporting_manager_id) : undefined,
      orgId
    });
    sendResponse(res, 200, true, 'Leave history fetched successfully', history);
  } catch (error) {
    next(error);
  }
};

export const handleLeaveAction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const approverId = (req as any).user.id;
    const requestId = Number(req.params.id);
    const updatedRequest = await leaveService.handleLeaveAction(requestId, approverId, req.body);
    _audit(req, `LEAVE_${req.body.status.toUpperCase()}`, requestId, req.body);
    sendResponse(res, 200, true, `Leave request ${req.body.status.toLowerCase()} successfully`, updatedRequest);
  } catch (error) {
    next(error);
  }
};

export const deleteLeaveRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const requestId = Number(req.params.id);
    const result = await leaveService.deleteLeaveRequest(requestId, userId);
    _audit(req, 'LEAVE_DELETED', requestId);
    sendResponse(res, 200, true, 'Leave request deleted successfully', result);
  } catch (error) {
    next(error);
  }
};

export const getMyLeaveBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const balance = await leaveService.getMyLeaveBalance(userId, year);
    sendResponse(res, 200, true, 'Leave balance fetched successfully', balance);
  } catch (error) {
    next(error);
  }
};

export const getAdminLeaveStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const stats = await leaveService.getAdminStats(orgId);
    sendResponse(res, 200, true, 'Admin leave statistics fetched successfully', stats);
  } catch (error) {
    next(error);
  }
};
