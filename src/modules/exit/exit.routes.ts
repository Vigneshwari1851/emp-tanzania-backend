import { Router } from 'express';
import { exitController } from './exit.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

// Apply authentication middleware to all exit routes
router.use(authenticate);

router.get('/my-assigned-assets', exitController.getMyAssignedAssets);
router.post('/initiate', exitController.initiateExit);
router.get('/stats', exitController.getStats);
router.get('/all-requests', exitController.getAllRequests);
router.get('/my-requests', exitController.getMyExitRequests);
router.get('/:id', exitController.getRequestById);
router.put('/:id', exitController.updateExitRequest);
router.put('/:id/status', exitController.updateStatus);
router.post('/:id/withdraw', exitController.withdrawResignation);
router.post('/:id/hr-override', exitController.hrOverride);
router.post('/:id/generate-docs', exitController.generateDocuments);
router.put('/:id/negotiate-lwd', exitController.negotiateLWD);
router.put('/:id/settlement', exitController.updateSettlement);
router.patch('/asset/:assetId/status', exitController.updateAssetStatus);
router.patch('/clearance-task/:taskId/status', exitController.updateClearanceTaskStatus);

export default router;
