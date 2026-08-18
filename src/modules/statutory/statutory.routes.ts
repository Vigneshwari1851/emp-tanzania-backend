import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import {
    getPayeBands,
    savePayeBands,
    getConfig,
    setConfig,
} from './statutory.controller';

const router = Router();

router.use(authenticate);

// PAYE Bands
router.get('/paye-bands', authorize(['payroll:manage']), getPayeBands);
router.post('/paye-bands', authorize(['payroll:manage']), savePayeBands);

// Generic statutory config (covers NSSF, SDL, WCF, HESLB, etc.)
router.get('/:configType', authorize(['payroll:manage']), getConfig);
router.post('/:configType', authorize(['payroll:manage']), setConfig);

export default router;
