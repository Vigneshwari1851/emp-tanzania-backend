import { Request, Response, NextFunction } from 'express';
import { sendResponse } from '../../utils/response.util';
import { attendanceService } from './attendance.service';
import { auditService } from '../audit/audit.service';

function _audit(req: any, action: string, entityId: string | number, newValue?: any, oldValue?: any) {
    auditService.log({
        module: 'ATTENDANCE',
        action,
        entityId: entityId.toString(),
        actorId: req.user?.id || 0,
        newValue,
        oldValue,
        ipAddress: req.ip
    }).catch(() => { });
}

export const checkIn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const log = await attendanceService.checkIn(userId, req.body || {});
    sendResponse(res, 200, true, 'Checked in successfully', log);
  } catch (error) {
    next(error);
  }
};

export const checkOut = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const log = await attendanceService.checkOut(userId, req.body || {});
    sendResponse(res, 200, true, 'Checked out successfully', log);
  } catch (error) {
    next(error);
  }
};

export const getMyAttendanceLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      status: req.query.status as string
    };
    const logs = await attendanceService.getMyLogs(userId, filters);
    sendResponse(res, 200, true, 'Attendance logs fetched successfully', logs);
  } catch (error) {
    next(error);
  }
};

export const getTeamAttendanceLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const filters = {
      department_id: req.query.department_id ? Number(req.query.department_id) : undefined,
      date: req.query.date as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      status: req.query.status as string,
      orgId
    };
    const logs = await attendanceService.getTeamLogs(filters);
    sendResponse(res, 200, true, 'Team attendance logs fetched successfully', logs);
  } catch (error) {
    next(error);
  }
};

export const getAttendanceStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const stats = await attendanceService.getDashboardStats(orgId);
    sendResponse(res, 200, true, 'Attendance statistics fetched successfully', stats);
  } catch (error) {
    next(error);
  }
};

export const logExportAudit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { format, filterType, count } = req.body;
    _audit(req, 'ATTENDANCE_EXPORTED', 'bulk', { format, filterType, count });
    sendResponse(res, 200, true, 'Export audit logged successfully');
  } catch (error) {
    next(error);
  }
};
