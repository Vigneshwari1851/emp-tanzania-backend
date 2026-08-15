import { Router } from 'express';
import { LoansAdvancesController } from './loans-advances.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = Router();
const controller = new LoansAdvancesController();

const canManage = authorize(['payroll:manage', 'loans-advances:manage']);
const canView = authorize(['payroll:viewAll', 'payroll:viewGroup', 'loans-advances:view']);

// ─── Loans ─────────────────────────────────────────────────────────────
router.get('/loans', authenticate as any, canView, (req, res) => controller.getLoans(req as any, res));
router.post('/loans', authenticate as any, (req, res) => controller.createLoan(req as any, res));
router.get('/loans/pending-approvals', authenticate as any, (req, res) => controller.getLoansForApproval(req as any, res));
router.patch('/loans/:id/approve-step', authenticate as any, (req, res) => controller.approveLoanStep(req as any, res));
router.patch('/loans/:id/reject-step', authenticate as any, (req, res) => controller.rejectLoanStep(req as any, res));
router.patch('/loans/:id/settle', authenticate as any, canManage, (req, res) => controller.settleLoan(req as any, res));
router.patch('/loans/:id/disburse', authenticate as any, canManage, (req, res) => controller.confirmLoanDisbursement(req as any, res));

// ─── Advances ──────────────────────────────────────────────────────────
router.get('/advances', authenticate as any, canView, (req, res) => controller.getAdvances(req as any, res));
router.post('/advances', authenticate as any, (req, res) => controller.createAdvance(req as any, res));
router.get('/advances/pending-approvals', authenticate as any, (req, res) => controller.getAdvancesForApproval(req as any, res));
router.patch('/advances/:id/approve-step', authenticate as any, (req, res) => controller.approveAdvanceStep(req as any, res));
router.patch('/advances/:id/reject-step', authenticate as any, (req, res) => controller.rejectAdvanceStep(req as any, res));
router.patch('/advances/:id/settle', authenticate as any, canManage, (req, res) => controller.settleAdvance(req as any, res));
router.patch('/advances/:id/disburse', authenticate as any, canManage, (req, res) => controller.confirmAdvanceDisbursement(req as any, res));

// ─── Settings ──────────────────────────────────────────────────────────
router.get('/settings', authenticate as any, canView, (req, res) => controller.getSettings(req as any, res));
router.post('/settings', authenticate as any, canManage, (req, res) => controller.saveSettings(req as any, res));

export default router;
