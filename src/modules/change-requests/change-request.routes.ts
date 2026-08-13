import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import {
    createChangeRequest,
    getMyChangeRequests,
    getChangeRequestInbox,
    decideChangeRequest
} from './change-request.controller';
import {
    createChangeRequestSchema,
    decideChangeRequestSchema
} from './change-request.validator';

const router = Router();

router.use(authenticate);

router.post('/', validateRequest(createChangeRequestSchema), createChangeRequest);
router.get('/mine', getMyChangeRequests);
router.get('/inbox', getChangeRequestInbox);
router.put('/:id/decision', validateRequest(decideChangeRequestSchema), decideChangeRequest);

export default router;
