import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import * as surveyController from './survey.controller';
import { createSurveySchema, updateSurveySchema, submitResponseSchema, addQuestionSchema } from './survey.validator';

const router = Router();

// Public routes (no auth) — mounted separately in index.ts
export const publicSurveyRoutes = Router();
publicSurveyRoutes.get('/:id', surveyController.getPublicSurvey);
publicSurveyRoutes.post('/responses', validateRequest(submitResponseSchema), surveyController.submitPublicResponse);

router.use(authenticate);

// Admin routes (RBAC enforced)
router.post('/', authorize(['CREATE_SURVEYS']), validateRequest(createSurveySchema), surveyController.createSurvey);
router.put('/:id', authorize(['CREATE_SURVEYS']), validateRequest(updateSurveySchema), surveyController.updateSurvey);
router.post('/:surveyId/questions', authorize(['CREATE_SURVEYS']), validateRequest(addQuestionSchema), surveyController.addQuestion);
router.get('/:surveyId/responses', authorize(['VIEW_SURVEY_RESULTS']), surveyController.getSurveyResponses);
router.patch('/:id/close', authorize(['CREATE_SURVEYS']), surveyController.closeSurvey);
router.post('/:id/clone', authorize(['CREATE_SURVEYS']), surveyController.cloneSurvey);
router.post('/:id/copy', authorize(['CREATE_SURVEYS']), surveyController.copySurvey);
router.post('/:id/share', authorize(['CREATE_SURVEYS']), surveyController.shareSurvey);

// Shared / Employee routes
router.get('/', surveyController.listSurveys);
router.get('/:id', surveyController.getSurvey);
router.post('/responses', validateRequest(submitResponseSchema), surveyController.submitResponse);

export default router;
