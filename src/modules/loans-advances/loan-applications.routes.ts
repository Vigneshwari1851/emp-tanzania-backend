import { Router } from 'express';
import { LoanApplicationsController } from './loan-applications.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = Router();
const controller = new LoanApplicationsController();
const canManage = authorize(['payroll:manage']);

router.get('/dashboard/stats', authenticate, canManage, (req, res) => controller.getDashboardStats(req, res));
router.get('/pending-approvals', authenticate, (req, res) => controller.getPendingApprovals(req, res));
router.get('/mine', authenticate, (req, res) => controller.getMine(req, res));
router.get('/eligibility', authenticate, (req, res) => controller.checkAllEligibility(req, res));
router.get('/eligibility/:loanTypeId', authenticate, (req, res) => controller.checkEligibility(req, res));
router.get('/', authenticate, canManage, (req, res) => controller.getAll(req, res));
router.get('/:id', authenticate, (req, res) => controller.getById(req, res));
router.post('/', authenticate, (req, res) => controller.create(req, res));
router.patch('/:id/withdraw', authenticate, (req, res) => controller.withdraw(req, res));
router.post('/:id/approve', authenticate, (req, res) => controller.approveStep(req, res));
router.post('/:id/reject', authenticate, (req, res) => controller.rejectStep(req, res));
router.get('/:id/schedule', authenticate, (req, res) => controller.getRepaymentSchedule(req, res));
router.post('/:id/disburse', authenticate, canManage, (req, res) => controller.disburse(req, res));

export default router;
