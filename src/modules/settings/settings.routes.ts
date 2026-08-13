import { Router } from 'express';
import * as activityLogController from '../audit/activity-log.controller';
import * as customFieldController from '../employees/custom-field.controller';
import * as integrationController from '../integration/integration.controller';

const router = Router();

// Activity Logs
router.get('/logs', activityLogController.listLogs);
router.post('/logs', activityLogController.createLog);

// Custom Fields
router.get('/fields', customFieldController.listFields);
router.post('/fields', customFieldController.createField);
router.put('/fields/:id', customFieldController.updateField);
router.delete('/fields/:id', customFieldController.deleteField);

// Integrations
router.get('/integrations', integrationController.listIntegrations);
router.put('/integrations/:id', integrationController.updateIntegration);
router.post('/integrations/seed', integrationController.seedIntegrations);

export default router;
