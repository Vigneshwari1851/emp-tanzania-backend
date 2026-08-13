import { Router } from 'express';
import {
  applyLeave,
  getMyLeaveRequests,
  getPendingLeaveRequests,
  getLeaveHistory,
  handleLeaveAction,
  getMyLeaveBalance,
  getAdminLeaveStats,
  deleteLeaveRequest
} from './leave.controller';
import { authorize, authenticate } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/apply', applyLeave);
router.get('/my-requests', getMyLeaveRequests);
router.get('/pending', authorize(['leaves.approve']), getPendingLeaveRequests);
router.get('/history', getLeaveHistory);
router.put('/action/:id', authorize(['leaves.approve', 'leaves.reject']), handleLeaveAction);
router.delete('/:id', deleteLeaveRequest);
router.get('/balance', getMyLeaveBalance);

// Admin Routes
router.get('/statistics', getAdminLeaveStats);

export default router;
