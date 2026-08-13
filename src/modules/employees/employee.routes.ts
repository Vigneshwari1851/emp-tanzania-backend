import express from 'express';
import { validateRequest } from '../../middlewares/validate.middleware';
import { authorize, authenticate } from '../../middlewares/auth.middleware';
import * as employeeController from './employee.controller';
import { createEmployeeSchema, updateEmployeeSchema } from './employee.validator';
import { upload } from '../../middlewares/upload.middleware';

const router = express.Router();

router.use(authenticate);

router.get('/validate/check-duplicate', employeeController.checkDuplicate);

router.post('/', authorize(['employees.create']), upload, validateRequest(createEmployeeSchema), employeeController.createEmployee);
router.get('/export', authorize(['employees.read']), employeeController.exportEmployees);
router.post('/export/audit', authorize(['employees.read']), employeeController.logExportAudit);
router.get('/generate-id', authorize(['employees.read']), employeeController.generateEmployeeId);
router.get('/celebrations', employeeController.getCelebrations);
router.get('/', employeeController.getAllEmployees);
router.get('/team/:id', employeeController.getEmployeesByTeamId);
router.get('/:id', employeeController.getEmployeeById);
router.put('/:id', upload, validateRequest(updateEmployeeSchema), employeeController.updateEmployee);
router.delete('/:id', authorize(['employees.delete']), employeeController.deleteEmployee);

export default router;
