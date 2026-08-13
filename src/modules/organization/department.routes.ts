import express from 'express';
import * as departmentController from './department.controller';
import { validateRequest } from '../../middlewares/validate.middleware';
import { createDepartmentSchema, updateDepartmentSchema } from './department.validator';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = express.Router();

// Placeholder routes
router.use(authenticate);

router.get('/', departmentController.getAllDepartments);
router.get('/manager', departmentController.getDepartmentManager);
router.get('/:id', departmentController.getDepartmentById);
router.post('/', authorize(['departments.manage']), validateRequest(createDepartmentSchema), departmentController.createDepartment);
router.put('/:id', authorize(['departments.manage']), validateRequest(updateDepartmentSchema), departmentController.updateDepartment);
router.delete('/:id', authorize(['departments.manage']), departmentController.deleteDepartment);
router.get('/employees/:departmentId', departmentController.getEmployeesByDepartment);

export default router;
