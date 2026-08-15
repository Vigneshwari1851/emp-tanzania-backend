import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { LoanApplicationsService } from './loan-applications.service';
import { auditService } from '../audit/audit.service';
import prisma from '../../config/prisma';

const service = new LoanApplicationsService();

function _audit(req: any, action: string, entityId: string | number, newValue?: any) {
    auditService.log({ module: 'LOAN_APPLICATIONS', action, entityId: entityId.toString(), actorId: req.user?.id || 0, newValue, ipAddress: req.ip }).catch(() => { });
}

export class LoanApplicationsController {

    async getAll(req: AuthRequest, res: Response) {
        try {
            const result = await service.getAll(req.query);
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getMine(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await service.getMine(userId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getById(req: AuthRequest, res: Response) {
        try {
            const result = await service.getById(Number(req.params.id));
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(404).json({ success: false, message: error.message });
        }
    }

    async create(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

            let targetUserId = userId;

            // Check if actor has management role or permissions to submit on behalf of someone else
            const isManagerOrAdmin = req.user.permissions?.includes('payroll:manage') || 
                                     req.user.roles?.some(role => ['SUPER ADMIN', 'SUPER_ADMIN', 'ADMIN', 'HR', 'HR MANAGER', 'HR_MANAGER', 'FINANCE', 'FINANCE MANAGER', 'FINANCE_MANAGER'].includes(String(role).toUpperCase()));

            if (isManagerOrAdmin && req.body.userDetailId) {
                const targetUserDetail = await prisma.userDetail.findUnique({
                    where: { id: Number(req.body.userDetailId) }
                });
                if (targetUserDetail) {
                    targetUserId = targetUserDetail.user_id;
                } else {
                    return res.status(400).json({ success: false, message: 'Target employee profile not found' });
                }
            }

            const result = await service.create(targetUserId, req.body);
            _audit(req, 'APPLICATION_CREATED', result.id, { loanTypeId: req.body.loanTypeId, amount: req.body.requestedAmount });
            res.status(201).json({ success: true, data: result, message: 'Application submitted' });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async withdraw(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await service.withdraw(userId, Number(req.params.id));
            _audit(req, 'APPLICATION_WITHDRAWN', String(req.params.id));
            res.json({ success: true, data: result, message: 'Application withdrawn' });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async checkEligibility(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const loanTypeId = Number(req.params.loanTypeId);
            const result = await service.checkEligibility(userId, loanTypeId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async checkAllEligibility(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await service.checkEligibilityForAllTypes(userId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async approveStep(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await service.approveStep(Number(req.params.id), userId, req.body.remarks, req.body.expectedStep !== undefined ? Number(req.body.expectedStep) : undefined);
            _audit(req, 'APPLICATION_APPROVED_STEP', String(req.params.id), { newStatus: result.status });
            res.json({ success: true, data: result, message: `Approved at step ${result.currentStep}` });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async rejectStep(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await service.rejectStep(Number(req.params.id), userId, req.body.remarks, req.body.expectedStep !== undefined ? Number(req.body.expectedStep) : undefined);
            _audit(req, 'APPLICATION_REJECTED', String(req.params.id), { remarks: req.body.remarks });
            res.json({ success: true, data: result, message: 'Application rejected' });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async getPendingApprovals(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const userRoles = req.user?.roles || [];
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await service.getPendingApprovals(userId, userRoles);
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getRepaymentSchedule(req: AuthRequest, res: Response) {
        try {
            const result = await service.getRepaymentSchedule(Number(req.params.id));
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getDashboardStats(req: AuthRequest, res: Response) {
        try {
            const result = await service.getDashboardStats();
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async disburse(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await service.disburse(Number(req.params.id), req.body);
            _audit(req, 'APPLICATION_DISBURSED', String(req.params.id), { disbursementAmount: req.body.disbursementAmount, disbursementMethod: req.body.disbursementMethod });
            res.json({ success: true, data: result, message: 'Loan disbursed successfully' });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}
