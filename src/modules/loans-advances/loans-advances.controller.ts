import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { LoansAdvancesService } from './loans-advances.service';
import { auditService } from '../audit/audit.service';

const service = new LoansAdvancesService();

function _audit(req: any, action: string, entityId: string | number, newValue?: any) {
    auditService.log({ module: 'LOANS_ADVANCES', action, entityId: entityId.toString(), actorId: req.user?.id || 0, newValue, ipAddress: req.ip }).catch(() => { });
}

export class LoansAdvancesController {

    // ─── Loans ─────────────────────────────────────────────────────────────

    async getLoans(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await service.getAllLoans(orgId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async createLoan(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const isAdmin = req.body.status === 'APPROVED';
            const orgId = req.user?.orgId || 0;
            const result = await service.createLoan(userId, req.body, isAdmin, orgId);

            _audit(req, isAdmin ? 'LOAN_CREATED' : 'LOAN_REQUESTED', result.id, { principalAmount: req.body.principalAmount, status: result.status });
            res.status(201).json({ success: true, data: result });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async approveLoanStep(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const { remarks } = req.body;
            const result = await service.approveLoanStep(Number(req.params.id), userId, remarks);
            _audit(req, 'LOAN_APPROVED_STEP', String(req.params.id), { newStatus: result.status, remarks });
            res.json({ success: true, data: result, message: `Loan advanced to ${result.status}` });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async rejectLoanStep(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const { remarks } = req.body;
            const result = await service.rejectLoanStep(Number(req.params.id), userId, remarks);
            _audit(req, 'LOAN_REJECTED', String(req.params.id), { remarks });
            res.json({ success: true, data: result, message: 'Loan rejected' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async settleLoan(req: AuthRequest, res: Response) {
        try {
            const result = await service.settleLoan(Number(req.params.id));
            _audit(req, 'LOAN_SETTLED', String(req.params.id));
            res.json({ success: true, data: result, message: 'Loan settled' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async confirmLoanDisbursement(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await service.confirmLoanDisbursement(Number(req.params.id), userId, req.body);
            _audit(req, 'LOAN_DISBURSED', String(req.params.id), { disbursementReference: req.body.disbursementReference });
            res.json({ success: true, data: result, message: 'Loan disbursement confirmed' });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async getLoansForApproval(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const userRoles = req.user?.roles || [];
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await service.getLoansForApproval(userId, userRoles);
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // ─── Advances ──────────────────────────────────────────────────────────

    async getAdvances(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await service.getAllAdvances(orgId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async createAdvance(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const isAdmin = req.body.status === 'APPROVED';
            const orgId = req.user?.orgId || 0;
            const result = await service.createAdvance(userId, req.body, isAdmin, orgId);

            _audit(req, isAdmin ? 'ADVANCE_CREATED' : 'ADVANCE_REQUESTED', result.id, { principalAmount: req.body.principalAmount, status: result.status });
            res.status(201).json({ success: true, data: result });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async approveAdvanceStep(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const { remarks } = req.body;
            const result = await service.approveAdvanceStep(Number(req.params.id), userId, remarks);
            _audit(req, 'ADVANCE_APPROVED_STEP', String(req.params.id), { newStatus: result.status, remarks });
            res.json({ success: true, data: result, message: `Advance advanced to ${result.status}` });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async rejectAdvanceStep(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const { remarks } = req.body;
            const result = await service.rejectAdvanceStep(Number(req.params.id), userId, remarks);
            _audit(req, 'ADVANCE_REJECTED', String(req.params.id), { remarks });
            res.json({ success: true, data: result, message: 'Advance rejected' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async settleAdvance(req: AuthRequest, res: Response) {
        try {
            const result = await service.settleAdvance(Number(req.params.id));
            _audit(req, 'ADVANCE_SETTLED', String(req.params.id));
            res.json({ success: true, data: result, message: 'Advance settled' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async confirmAdvanceDisbursement(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await service.confirmAdvanceDisbursement(Number(req.params.id), userId, req.body);
            _audit(req, 'ADVANCE_DISBURSED', String(req.params.id), { disbursementReference: req.body.disbursementReference });
            res.json({ success: true, data: result, message: 'Advance disbursement confirmed' });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async getAdvancesForApproval(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const userRoles = req.user?.roles || [];
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await service.getAdvancesForApproval(userId, userRoles);
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getSettings(req: AuthRequest, res: Response) {
        try {
            const result = await service.getSettings();
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async saveSettings(req: AuthRequest, res: Response) {
        try {
            const result = await service.saveSettings(req.body);
            _audit(req, 'LOAN_SETTINGS_UPDATED', 0, req.body);
            res.json({ success: true, data: result, message: 'Settings saved successfully' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
