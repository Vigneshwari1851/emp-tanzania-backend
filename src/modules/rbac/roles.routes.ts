import { Router } from 'express';
import * as rolesController from './roles.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import { z } from 'zod';

const router = Router();

// --- Validation Schemas ---
const roleSchema = z.object({
    body: z.object({
        name: z.string(),
        description: z.string().optional(),
        status: z.boolean().optional(),
        permission_ids: z.array(z.object({
            id: z.number(),
            scope: z.enum(['GLOBAL', 'TEAM', 'OWN']).optional()
        })).optional()
    }),
});

const updateRoleSchema = z.object({
    body: z.object({
        name: z.string().min(3).optional(),
        description: z.string().optional(),
        status: z.boolean().optional(),
    }),
});

const updateRolePermissionsSchema = z.object({
    body: z.object({
        permissions: z.array(z.object({
            id: z.number(),
            scope: z.enum(['GLOBAL', 'TEAM', 'OWN']).optional()
        })),
    }),
});

// --- Routes ---

// All routes require authentication
router.use(authenticate);

// --- Role Management ---
router.post(
    '/',
    authorize(['roles.manage']),
    validateRequest(roleSchema),
    rolesController.createRole
);

router.get(
    '/',
    // authorize(['roles.read']),
    rolesController.listRoles
);

router.get(
    '/permissions/all',
    authorize(['roles.read']),
    rolesController.listAllPermissions
);

router.get(
    '/:id',
    // authorize(['roles.read']),
    rolesController.getRoleById
);

router.get(
    '/:id/permissions',
    authorize(['roles.read']),
    rolesController.getRolePermissions
);

router.put(
    '/:id',
    authorize(['roles.manage']),
    validateRequest(updateRoleSchema),
    rolesController.updateRole
);

router.delete(
    '/:id',
    authorize(['roles.manage']),
    rolesController.deleteRole
);

// --- Mapping Management (Bulk) ---
router.put(
    '/:id/permissions',
    authorize(['roles.manage']),
    validateRequest(updateRolePermissionsSchema),
    rolesController.updateRolePermissions
);

export default router;
