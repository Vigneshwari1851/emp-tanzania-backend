import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../../middlewares/auth.middleware';

const prisma = new PrismaClient();

export class AuditController {
  /**
   * GET /audit-logs?module=&action=&page=&size=
   * Returns paginated audit entries.
   */
  async getLogs(req: AuthRequest, res: Response) {
    try {
      const { module, action, page = '1', size = '20' } = req.query as any;
      const take = parseInt(size, 10);
      const skip = (parseInt(page, 10) - 1) * take;

      const where: any = {};
      if (module) where.module = module;
      if (action) where.action = action;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        prisma.auditLog.count({ where }),
      ]);

      // Enrich logs with actor name & employee ID
      const actorIds = [...new Set(logs.map((l) => l.actorId))];
      const users = await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: {
          id: true,
          email: true,
          details: {
            select: {
              first_name: true,
              last_name: true,
              employee_id: true,
            },
          },
        },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      const enrichedLogs = logs.map((log) => {
        const user = userMap.get(log.actorId);
        return {
          ...log,
          actorName: user?.details
            ? `${user.details.first_name || ''} ${user.details.last_name || ''}`.trim()
            : user?.email || `User #${log.actorId}`,
          actorEmployeeId: user?.details?.employee_id || null,
        };
      });

      res.json({ success: true, data: enrichedLogs, total, page: parseInt(page, 10) });
    } catch (error: any) {
      console.error('Audit log fetch error', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /audit/logs
   * Allows frontend to push manual audit logs (e.g., from mock modules).
   */
  async createLog(req: AuthRequest, res: Response) {
    try {
      const { module, action, entityId, previousValue, newValue } = req.body;
      const actorId = req.user?.id || 0;
      
      const newLog = await prisma.auditLog.create({
        data: {
          module: module || 'SYSTEM',
          action: action || 'UNKNOWN_ACTION',
          entityId: String(entityId || 'N/A'),
          actorId,
          oldValue: previousValue ? String(previousValue) : undefined,
          newValue: newValue ? String(newValue) : undefined,
          ipAddress: req.ip
        }
      });
      
      res.status(201).json({ success: true, data: newLog });
    } catch (error) {
      console.error('Error creating audit log:', error);
      res.status(500).json({ success: false, message: 'Failed to create audit log' });
    }
  }
}

export const auditController = new AuditController();
