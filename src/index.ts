import express from 'express';
import cors from 'cors';
import { config } from './config';
import { errorHandler } from './middlewares/error.middleware';
import authRoutes from './modules/auth/auth.routes';
import rolesRoutes from './modules/rbac/roles.routes';
import { sendResponse } from './utils/response.util';
import organizationRoutes from './modules/organization/organization.routes';
import departmentRoutes from './modules/organization/department.routes';
import teamRoutes from './modules/organization/team.routes';
import employeeRoutes from './modules/employees/employee.routes';
import leaveRoutes from './modules/leaves/leave.routes';
import leavePolicyRoutes from './modules/leaves/leave-policy.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import permissionsRoutes from './modules/rbac/permissions.routes';
import settingsRoutes from './modules/settings/settings.routes';
import branchRoutes from './modules/organization/branch.routes';
import notificationRoutes from './modules/notifications/notification.routes';
import bankRoutes from './modules/employees/bank.routes';
import payrollRoutes from './modules/payroll/payroll.routes';
import designationRoutes from './modules/designation/designation.routes';
import { webSocketService } from './modules/notifications/websocket.service';
import exitRoutes from './modules/exit/exit.routes';
import { initExitCron } from './modules/exit/exit.cron';
import { initOfferCron } from './modules/recruitment/offer.cron';
import { initRecruitmentEmailListeners } from './modules/recruitment/recruitment.email.listeners';
import assetRoutes from './modules/asset/asset.routes';
import assignmentRoutes from './modules/assignment/assignment.routes';
import lmsRoutes from './modules/lms/lms.routes';
import auditRoutes from './modules/audit/audit.routes';
import recruitmentRoutes from './modules/recruitment/recruitment.routes';
import surveyRoutes from './modules/survey/survey.routes';
import { publicSurveyRoutes } from './modules/survey/survey.routes';
import editionRoutes from './modules/edition/edition.routes';
import userTypeRoutes from './modules/user-types/user-types.routes';
import newsRoutes from './modules/news/news.routes';
import documentRoutes from './modules/document/document.routes';
import loansAdvancesRoutes from './modules/loans-advances/loans-advances.routes';
import loanTypesRoutes from './modules/loans-advances/loan-types.routes';
import loanApplicationsRoutes from './modules/loans-advances/loan-applications.routes';


import path from 'path';
import fs from 'fs';
import multer from 'multer';

const app = express();

// Middlewares
app.use('/public', express.static(path.join(__dirname, '../public')));
app.use('/upload', express.static(path.join(__dirname, '../upload')));
app.use(cors());

app.use(express.json({ limit: '10mb' }));

// Request Logging
app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
});

// Routes
app.get('/', (req, res) => {
    return sendResponse(res, 200, true, 'Employee Management API is running');
});

app.use('/employee-api/auth', authRoutes);
app.use('/employee-api/roles', rolesRoutes);
app.use('/employee-api/organizations', organizationRoutes);
app.use('/employee-api/teams', teamRoutes);
app.use('/employee-api/departments', departmentRoutes);
app.use('/employee-api/employees', employeeRoutes);
app.use('/employee-api/leave-policies', leavePolicyRoutes);
app.use('/employee-api/leaves', leaveRoutes);
app.use('/employee-api/attendance', attendanceRoutes);
app.use('/employee-api/permissions', permissionsRoutes);
app.use('/employee-api/settings', settingsRoutes);
app.use('/employee-api/branches', branchRoutes);
app.use('/employee-api/notifications', notificationRoutes);
app.use('/employee-api/banks', bankRoutes);
app.use('/employee-api/payroll', payrollRoutes);
app.use('/employee-api/exit', exitRoutes);
app.use('/employee-api/designations', designationRoutes);
app.use('/employee-api/assets', assetRoutes);
app.use('/employee-api/assignments', assignmentRoutes);
app.use('/employee-api/lms', lmsRoutes);
app.use('/employee-api/audit', auditRoutes);
app.use('/employee-api/recruitment', recruitmentRoutes);
app.use('/employee-api/public/surveys', publicSurveyRoutes);
app.use('/employee-api/survey', surveyRoutes);
app.use('/employee-api/edition', editionRoutes);
app.use('/employee-api/surveys', surveyRoutes);
app.use('/employee-api/user-types', userTypeRoutes);
app.use('/employee-api/news', newsRoutes);
app.use('/employee-api/documents', documentRoutes);
app.use('/employee-api/loans-advances', loansAdvancesRoutes);
app.use('/employee-api/loan-types', loanTypesRoutes);
app.use('/employee-api/loan-applications', loanApplicationsRoutes);
import changeRequestRoutes from './modules/change-requests/change-request.routes';
app.use('/employee-api/change-requests', changeRequestRoutes);
import feedbackRoutes from './modules/feedback/feedback.routes';
app.use('/employee-api/feedback', feedbackRoutes);


// Generic file upload endpoint for Asset Images and other modules
const uploadDir = path.join(__dirname, '../upload');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const singleStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'file-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const singleUpload = multer({
    storage: singleStorage,
    limits: { fileSize: 20 * 1024 * 1024 }
}).single('file');

app.post('/employee-api/upload', (req, res) => {
    singleUpload(req, res, (err) => {
        if (err) {
            console.error('Upload error:', err);
            return res.status(400).json({ success: false, error: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        const fileUrl = `/upload/${req.file.filename}`;
        return res.json({ success: true, url: fileUrl });
    });
});

// 404 Handler
app.use((req, res, next) => {
    console.log(`[404] No route found for: ${req.method} ${req.url}`);
    res.status(404).send(`Cannot ${req.method} ${req.url}`);
});

// Error Handling
app.use(errorHandler);

// Server Start
const port = config.PORT;
const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Initialize WebSocket server
webSocketService.init(server);

// Initialize Exit Workflow Cron
initExitCron();

// Initialize Offer Expiry Cron
initOfferCron();

// Register Recruitment Email EventBus Listeners
initRecruitmentEmailListeners();
