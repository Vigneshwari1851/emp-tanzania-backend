import express from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import * as bankController from './bank.controller';

const router = express.Router();

router.get('/', authenticate, bankController.getAllBanks);

export default router;
