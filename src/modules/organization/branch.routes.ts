import express from 'express';
import * as branchController from './branch.controller';
import { validateRequest } from '../../middlewares/validate.middleware';
import { createBranchSchema, updateBranchSchema } from './branch.validator';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = express.Router();

router.use(authenticate);

// We assume permissions exist like 'branches.read' and 'branches.manage'
// You may need to seed these in your database
router.get('/', authorize(['branches.read']), branchController.getAllBranches);
router.get('/:id', authorize(['branches.read']), branchController.getBranchById);
router.post('/', authorize(['branches.manage']), validateRequest(createBranchSchema), branchController.createBranch);
router.put('/:id', authorize(['branches.manage']), validateRequest(updateBranchSchema), branchController.updateBranch);
router.delete('/:id', authorize(['branches.manage']), branchController.deleteBranch);

export default router;
