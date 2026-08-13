import { Router } from 'express';
import { LoanTypesController } from './loan-types.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = Router();
const controller = new LoanTypesController();
const canManage = authorize(['payroll:manage']);

router.get('/', authenticate, canManage, (req, res) => controller.getAll(req, res));
router.get('/stats', authenticate, canManage, (req, res) => controller.getStats(req, res));
router.get('/:id', authenticate, canManage, (req, res) => controller.getById(req, res));
router.post('/', authenticate, canManage, (req, res) => controller.create(req, res));
router.put('/:id', authenticate, canManage, (req, res) => controller.update(req, res));
router.patch('/:id/toggle', authenticate, canManage, (req, res) => controller.toggleActive(req, res));

router.get('/:id/rules', authenticate, canManage, (req, res) => controller.getEligibilityRules(req, res));
router.put('/:id/rules', authenticate, canManage, (req, res) => controller.updateEligibilityRules(req, res));

router.get('/:id/workflow', authenticate, canManage, (req, res) => controller.getApprovalWorkflow(req, res));
router.put('/:id/workflow', authenticate, canManage, (req, res) => controller.updateApprovalWorkflow(req, res));

export default router;
