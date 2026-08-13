import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import {
    submitFeedback,
    listFeedback,
    getFeedbackById,
    markFeedbackRead,
    updateFeedbackStatus,
    deleteFeedback
} from './feedback.controller';
import {
    submitFeedbackSchema,
    feedbackIdParamsSchema,
    updateFeedbackStatusSchema
} from './feedback.validator';

const router = Router();

router.use(authenticate);

router.post('/', validateRequest(submitFeedbackSchema), submitFeedback);
router.get('/', listFeedback);
router.get('/:id', validateRequest(feedbackIdParamsSchema), getFeedbackById);
router.patch('/:id/read', validateRequest(feedbackIdParamsSchema), markFeedbackRead);
router.patch('/:id/status', validateRequest(updateFeedbackStatusSchema), updateFeedbackStatus);
router.delete('/:id', validateRequest(feedbackIdParamsSchema), deleteFeedback);

export default router;
