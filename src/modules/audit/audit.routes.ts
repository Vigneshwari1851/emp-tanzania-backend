import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { auditController } from './audit.controller';

const router = Router();

// GET /audit/logs – list audit entries (protected)
router.get('/logs', authenticate as any, (req, res) => auditController.getLogs(req as any, res));

// POST /audit/logs – create audit entry (protected)
router.post('/logs', authenticate as any, (req, res) => auditController.createLog(req as any, res));

export default router;
