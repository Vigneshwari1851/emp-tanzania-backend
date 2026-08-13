import { Request, Response, NextFunction } from 'express';
import { exitService } from './exit.service';
import { generateExitDocument } from '../../utils/exit-docs.util';
import prisma from '../../shared/prisma/client';
import { AppError } from '../../middlewares/error.middleware';
import { auditService } from '../audit/audit.service';

function _audit(req: any, action: string, entityId: string | number, newValue?: any, oldValue?: any) {
    auditService.log({
        module: 'EXIT',
        action,
        entityId: entityId.toString(),
        actorId: req.user?.id || 0,
        newValue,
        oldValue,
        ipAddress: req.ip
    }).catch(() => { });
}

export class ExitController {
  async initiateExit(req: Request, res: Response, next: NextFunction) {
    try {
      const roles = (req as any).user.roles || [];
      const normalizedRoles = roles.map((r: any) => String(r).toUpperCase());
      const isAdminOrHR = normalizedRoles.some((r: string) => 
        ['SUPER ADMIN', 'SUPER_ADMIN', 'ADMIN', 'CEO', 'SYSTEM ADMINISTRATOR', 'HR', 'HR MANAGER', 'HR_MANAGER', 'HR EXECUTIVE', 'HR_EXECUTIVE'].includes(r)
      );

      // Backend validation/sanitization
      const employee_name = req.body.employee_name || req.body.employeeName;
      const primary_reason = req.body.primary_reason || req.body.primaryReason;
      const company_assets_returned = req.body.company_assets_returned || req.body.companyAssetsReturned || req.body.assets;

      if (!primary_reason || typeof primary_reason !== 'string' || !primary_reason.trim()) {
        throw new AppError('Primary reason is required and must be a valid string.', 400);
      }

      if (!employee_name || typeof employee_name !== 'string' || !employee_name.trim()) {
        throw new AppError('Employee name is required and must be a valid string.', 400);
      }

      if (company_assets_returned !== undefined && !Array.isArray(company_assets_returned)) {
        throw new AppError('Company assets to be returned must be a valid list/array if provided.', 400);
      }

      // Map company_assets_returned to assets for internal db query compatibility
      if (company_assets_returned && !req.body.assets) {
        req.body.assets = company_assets_returned;
      }

      const targetUserId = (isAdminOrHR && req.body.userId) ? parseInt(req.body.userId, 10) : (req as any).user.id;
      const result = await exitService.initiateExit(targetUserId, req.body);
      
      _audit(req, 'EXIT_INITIATED', result.id, { primary_reason });
      
      res.status(201).json({
        success: true,
        message: 'Exit request submitted successfully. Case ID: ' + result.id,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyAssignedAssets(req: Request, res: Response, next: NextFunction) {
    try {
      const requestedUserId = req.query.userId ? parseInt(req.query.userId as string, 10) : (req as any).user.id;
      const userId = requestedUserId;
      const assets = await prisma.assetAssignment.findMany({
        where: { user_id: userId, status: 'ACTIVE' },
        include: { 
          asset: {
            include: { category: true }
          }
        }
      });
      
      res.status(200).json({
        success: true,
        data: assets.map(a => ({
          id: a.asset.id,
          serial_number: a.asset.serial_number,
          name: a.asset.name,
          category: a.asset.category.name,
          assignment_id: a.id
        }))
      });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const roles = (req as any).user.roles || [];
      const orgId = (req as any).user.orgId;
      const result = await exitService.getExitStats(userId, roles, orgId);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const roles = (req as any).user.roles || [];
      const orgId = (req as any).user.orgId;
      const { search, status } = req.query;
      
      const result = await exitService.getAllExitRequests({
        search: search as string,
        status: status as string,
        userId,
        roles,
        orgId
      });
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyExitRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const result = await exitService.getMyExitRequests(userId);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async negotiateLWD(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { proposed_lwd } = req.body;
      const actorId = (req as any).user.id;
      const role = (req as any).user.roles?.[0] || 'MANAGER';

      const result = await exitService.negotiateLWD(id as string, proposed_lwd, actorId, role);
      _audit(req, 'EXIT_LWD_NEGOTIATED', id as string, { proposed_lwd });

      res.status(200).json({
        success: true,
        message: 'LWD negotiation proposal sent successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, interview_responses } = req.body;
      const approverId = (req as any).user.id;
      
      const result = await exitService.updateExitStatus(id as string, status as string, approverId, interview_responses);
      _audit(req, 'EXIT_STATUS_UPDATED', id as string, { status });
      
      res.status(200).json({
        success: true,
        message: `Exit request ${status.toLowerCase()} successfully`,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getRequestById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await exitService.getExitRequestById(id as string);
      
      if (!result) {
        throw new AppError('Exit request not found', 404);
      }
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async updateAssetStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { assetId } = req.params;
      const { returnStatus } = req.body;
      
      const result = await exitService.updateAssetStatus(parseInt(assetId as string, 10), returnStatus);
      _audit(req, 'EXIT_ASSET_STATUS_UPDATED', assetId as string, { returnStatus });
      
      res.status(200).json({
        success: true,
        message: 'Asset status updated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async updateClearanceTaskStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { taskId } = req.params;
      const { status, proofUrl, proofType } = req.body;
      
      const result = await exitService.updateClearanceTaskStatus(
        parseInt(taskId as string, 10), 
        status, 
        proofUrl, 
        proofType
      );
      _audit(req, 'EXIT_CLEARANCE_TASK_UPDATED', taskId as string, { status });
      
      res.status(200).json({
        success: true,
        message: 'Task status updated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async withdrawResignation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;
      const result = await exitService.withdrawResignation(id as string, userId);
      _audit(req, 'EXIT_RESIGNATION_WITHDRAWN', id as string);
      res.status(200).json({
        success: true,
        message: 'Resignation withdrawn successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async hrOverride(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, comments } = req.body;
      const hrId = (req as any).user.id;
      const result = await exitService.hrOverride(id as string, status, hrId, comments);
      _audit(req, 'EXIT_HR_OVERRIDE', id as string, { status, comments });
      res.status(200).json({
        success: true,
        message: 'HR override completed successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async generateDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const exitRequest = await prisma.exitRequest.findUnique({
        where: { id: parseInt(id as string, 10) },
        include: { 
          user: { 
            include: { 
              details: { 
                include: { 
                  department: true,
                  role: true
                } 
              } 
            } 
          } 
        }
      });

      if (!exitRequest) return res.status(404).json({ success: false, message: 'Request not found' });

      const data = {
        name: `${exitRequest.user.details?.first_name} ${exitRequest.user.details?.last_name}`,
        employeeId: exitRequest.user.details?.employee_id || 'N/A',
        designation: (exitRequest.user.details as any)?.role?.role_name || 'Employee',
        department: exitRequest.user.details?.department?.department_name || 'N/A',
        joinDate: exitRequest.user.details?.start_date?.toLocaleDateString() || 'N/A',
        lwd: exitRequest.last_working_day.toLocaleDateString()
      };

      const relievingUrl = await generateExitDocument('RELIEVING', data);
      const experienceUrl = await generateExitDocument('EXPERIENCE', data);
      _audit(req, 'EXIT_DOCUMENTS_GENERATED', id as string, { relievingUrl, experienceUrl });

      res.status(200).json({
        success: true,
        message: 'Documents generated successfully',
        data: { relievingUrl, experienceUrl }
      });
    } catch (error) {
      next(error);
    }
  }

  async updateSettlement(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const roles = (req as any).user?.roles || [];
      const normalizedRoles = roles.map((r: any) => String(r).toUpperCase());

      const hasFinanceOrAdmin = normalizedRoles.some((r: string) =>
        ['FINANCE', 'FINANCE_ADMIN', 'ACCOUNTANT', 'ADMIN', 'SUPER ADMIN', 'SUPER_ADMIN'].includes(r)
      );
      const isHR = normalizedRoles.includes('HR');

      if (isHR && !hasFinanceOrAdmin) {
        throw new AppError('HR users are not authorized to update settlement data. Only Finance and Admin roles can perform this action.', 403);
      }

      const result = await exitService.updateSettlement(id as string, req.body);
      _audit(req, 'EXIT_SETTLEMENT_UPDATED', id as string, req.body);
      res.status(200).json({
        success: true,
        message: 'Settlement data updated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async updateExitRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const company_assets_returned = req.body.company_assets_returned || req.body.companyAssetsReturned || req.body.assets;
      if (company_assets_returned && !req.body.assets) {
        req.body.assets = company_assets_returned;
      }
      const result = await exitService.updateExitRequest(id as string, req.body);
      _audit(req, 'EXIT_REQUEST_UPDATED', id as string, req.body);
      res.status(200).json({
        success: true,
        message: 'Exit request updated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

export const exitController = new ExitController();
