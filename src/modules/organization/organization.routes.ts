import express from 'express';
import * as organizationController from './organization.controller';
import { createOrganizationSchema, updateOrganizationSchema, updateShiftSchema } from './organization.validator';
import { validateRequest } from '../../middlewares/validate.middleware';
import { authorize, authenticate } from '../../middlewares/auth.middleware';

const router = express.Router();

// Public route to get organization details by slug
router.get(
    '/by-slug/:slug',
    organizationController.getOrganizationBySlug
);

// All other organization routes require authentication
router.use(authenticate);

router.post(
    '/',
    authorize(['organization.manage']),
    validateRequest(createOrganizationSchema),
    organizationController.createOrganization
);

router.get(
    '/',
    // authorize(['organization.manage', 'organization.view']),
    organizationController.getAllOrganizations
);

router.get(
    '/:id',
    // authorize(['organization.manage', 'organization.view']),
    organizationController.getOrganizationById
);

router.put(
    '/:id',
    authorize(['organization.manage']),
    validateRequest(updateOrganizationSchema),
    organizationController.updateOrganization
);

router.delete(
    '/:id',
    authorize(['organization.manage']),
    organizationController.deleteOrganization
);

router.get(
    '/:id/shifts',
    organizationController.getOrganizationShifts
);

router.put(
    '/:id/shifts/:shiftId',
    authorize(['organization.manage']),
    validateRequest(updateShiftSchema),
    organizationController.updateOrganizationShift
);

export default router;