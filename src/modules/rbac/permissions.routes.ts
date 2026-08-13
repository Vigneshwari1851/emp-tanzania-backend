import { Router } from 'express';
import * as permissionsController from './permissions.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get(
    '/grouped',
    authorize(['roles.read']),
    permissionsController.listPermissionsGrouped
);

router.post(
    '/seed-hierarchy',
    authorize(['roles.admin']),
    permissionsController.seedHierarchy
);

// Module Management
router.post(
    '/modules',
    authorize(['roles.admin']),
    permissionsController.createModule
);

router.put(
    '/modules/:id',
    authorize(['roles.admin']),
    permissionsController.updateModule
);

router.delete(
    '/modules/:id',
    authorize(['roles.admin']),
    permissionsController.deleteModule
);

// Permission Management
router.post(
    '/',
    authorize(['roles.admin']),
    permissionsController.createPermission
);

router.put(
    '/:id',
    authorize(['roles.admin']),
    permissionsController.updatePermission
);

router.delete(
    '/:id',
    authorize(['roles.admin']),
    permissionsController.deletePermission
);

export default router;
