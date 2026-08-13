import { Router } from 'express';
import { getAssignments, assignAsset, returnAsset, requestReturn, acceptReturn, getMyAssets } from './assignment.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getAssignments);
router.post('/assign', assignAsset);
router.post('/:id/request-return', requestReturn);
router.post('/:id/accept-return', acceptReturn);
router.post('/:id/return', returnAsset); // :id is assetId
router.get('/my-assets', getMyAssets);

export default router;
