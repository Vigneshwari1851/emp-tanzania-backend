import { Router } from 'express';
import {
  checkIn,
  checkOut,
  getMyAttendanceLogs,
  getTeamAttendanceLogs,
  getAttendanceStats,
  logExportAudit
} from './attendance.controller';
import { authorize, authenticate } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/my-logs', getMyAttendanceLogs);
router.get('/team-logs',  getTeamAttendanceLogs);
router.get('/stats',  getAttendanceStats);
router.post('/export/audit', logExportAudit);

export default router;
