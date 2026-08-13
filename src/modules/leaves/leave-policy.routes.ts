import { Router } from 'express';
import {
  createLeavePolicy,
  getAllLeavePolicies,
  getLeavePolicyById,
  updateLeavePolicy,
  deleteLeavePolicy
} from './leave-policy.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', authorize(['policies.manage']), createLeavePolicy);
router.get('/', getAllLeavePolicies);
router.get('/:id', getLeavePolicyById);
router.put('/:id', authorize(['policies.manage']), updateLeavePolicy);
router.delete('/:id', authorize(['policies.manage']), deleteLeavePolicy);

export default router;
