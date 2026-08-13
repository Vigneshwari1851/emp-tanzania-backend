import express from 'express';
import { userTypeController } from './user-types.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = express.Router();

router.use(authenticate);

router.get('/', userTypeController.getAll);
router.get('/modules', userTypeController.getModules);
router.get('/:id', userTypeController.getById);
router.get('/:id/modules', userTypeController.getAssignedModules);

router.post('/', authorize(['roles.manage']), userTypeController.create);
router.put('/:id', authorize(['roles.manage']), userTypeController.update);
router.put('/:id/modules', authorize(['roles.manage']), userTypeController.updateAssignedModules);
router.delete('/:id', authorize(['roles.manage']), userTypeController.delete);

export default router;
