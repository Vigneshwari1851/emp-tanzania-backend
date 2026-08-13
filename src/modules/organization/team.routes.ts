import express from 'express';
import * as teamController from './team.controller';
import { validateRequest } from '../../middlewares/validate.middleware';
import { createTeamSchema, updateTeamSchema } from './team.validator';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = express.Router();

router.get('/test', (req, res) => res.json({ success: true, message: 'Team router is reachable' }));

/* Department based Team */
router.get('/department/:departmentId', teamController.getTeamsByDepartment);

router.use(authenticate);

router.post('/', authorize(['organization.manage']), validateRequest(createTeamSchema), teamController.createTeam);
router.get('/', authorize(['organization.manage']), teamController.getAllTeams);
router.get('/:id', authorize(['organization.manage']), teamController.getTeamById);
router.put('/:id', authorize(['organization.manage']), validateRequest(updateTeamSchema), teamController.updateTeam);
router.delete('/:id', authorize(['organization.manage']), teamController.deleteTeam);

export default router;
