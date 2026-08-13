import express from 'express';
import { designationController } from './designation.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = express.Router();

// Protect all routes with auth
router.use(authenticate);

router.get('/', designationController.getAll);
router.get('/:id', designationController.getById);
router.get('/:id/employees', designationController.getEmployees);

// Manage designations permission check (using system settings/departments management scope)
router.post('/', authorize(['departments.manage']), designationController.create);
router.put('/:id', authorize(['departments.manage']), designationController.update);
router.delete('/:id', authorize(['departments.manage']), designationController.delete);

export default router;
