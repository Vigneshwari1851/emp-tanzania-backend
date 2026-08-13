import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { LoanTypesService } from './loan-types.service';
import { auditService } from '../audit/audit.service';

const service = new LoanTypesService();

function _audit(req: any, action: string, entityId: string | number, newValue?: any) {
    auditService.log({ module: 'LOAN_TYPES', action, entityId: entityId.toString(), actorId: req.user?.id || 0, newValue, ipAddress: req.ip }).catch(() => { });
}

export class LoanTypesController {

    async getAll(req: AuthRequest, res: Response) {
        try {
            const result = await service.getAll();
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
            const result = await service.create(req.body);
            _audit(req, 'LOAN_TYPE_CREATED', result.id, req.body);
            res.status(201).json({ success: true, data: result, message: 'Loan type created' });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async update(req: AuthRequest, res: Response) {
        try {
            const result = await service.update(Number(req.params.id), req.body);
            _audit(req, 'LOAN_TYPE_UPDATED', String(req.params.id), req.body);
            res.json({ success: true, data: result, message: 'Loan type updated' });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async toggleActive(req: AuthRequest, res: Response) {
        try {
            const result = await service.toggleActive(Number(req.params.id));
            _audit(req, 'LOAN_TYPE_TOGGLED', String(req.params.id), { isActive: result.isActive });
            res.json({ success: true, data: result, message: `Loan type ${result.isActive ? 'activated' : 'deactivated'}` });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async getEligibilityRules(req: AuthRequest, res: Response) {
        try {
            const result = await service.getEligibilityRules(Number(req.params.id));
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async updateEligibilityRules(req: AuthRequest, res: Response) {
        try {
            const result = await service.updateEligibilityRules(Number(req.params.id), req.body.rules || []);
            _audit(req, 'ELIGIBILITY_RULES_UPDATED', String(req.params.id), { count: req.body.rules?.length || 0 });
            res.json({ success: true, data: result, message: 'Eligibility rules updated' });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async getApprovalWorkflow(req: AuthRequest, res: Response) {
        try {
            const result = await service.getApprovalWorkflow(Number(req.params.id));
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async updateApprovalWorkflow(req: AuthRequest, res: Response) {
        try {
            const result = await service.updateApprovalWorkflow(Number(req.params.id), req.body.steps || []);
            _audit(req, 'APPROVAL_WORKFLOW_UPDATED', String(req.params.id), { count: req.body.steps?.length || 0 });
            res.json({ success: true, data: result, message: 'Approval workflow updated' });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async getStats(req: AuthRequest, res: Response) {
        try {
            const result = await service.getStats();
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
