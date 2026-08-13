import { Router } from 'express';
import { PayrollController } from './payroll.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import {
    createComponentSchema, updateComponentSchema, createStructureSchema,
    createGroupSchema, createTaxSectionSchema, createReimbursementSchema,
    updatePayCycleSchema, createRunSchema, submitClaimSchema,
    updateTaxRegimeSchema, submitDeclarationSchema, submitForm12BSchema,
    processPaymentSchema, batchPaymentSchema, saveSystemSettingsSchema
} from './payroll.validator';

const router = Router();
const controller = new PayrollController();

router.get('/test', (req, res) => res.json({ success: true, message: 'Payroll router is reachable' }));

// ─── Read-only access (admin + group viewers) ────────────────────────────
const canView = authorize(['payroll:viewAll', 'payroll:viewGroup']);
// ─── Management access (admin / manage permission) ──────────────────────
const canManage = authorize(['payroll:manage']);
// ─── Processing access (run payroll) ────────────────────────────────────
const canProcess = authorize(['payroll:process']);
// ─── Employee self-service ──────────────────────────────────────────────
const canAccessEmployee = authorize(['payroll:employee']);

// Components
router.get('/components', authenticate as any, canView, controller.getComponents);
router.post('/components', authenticate as any, canManage, validateRequest(createComponentSchema), controller.createComponent);
router.put('/components/:id', authenticate as any, canManage, validateRequest(updateComponentSchema), controller.updateComponent);
router.delete('/components/:id', authenticate as any, canManage, controller.deleteComponent);

// Component Change Requests (Maker-Checker)
router.get('/components/changes/pending', authenticate as any, canManage, (req, res) => controller.getPendingComponentChanges(req as any, res));
router.patch('/components/changes/:changeId/approve', authenticate as any, canManage, (req, res) => controller.approveComponentChange(req as any, res));
router.patch('/components/changes/:changeId/reject', authenticate as any, canManage, (req, res) => controller.rejectComponentChange(req as any, res));

// Structures
router.get('/structures', authenticate as any, canView, controller.getStructures);
router.post('/structures', authenticate as any, canManage, validateRequest(createStructureSchema), controller.createStructure);
router.put('/structures/:id', authenticate as any, canManage, controller.updateStructure);
router.delete('/structures/:id', authenticate as any, canManage, controller.deleteStructure);

// Groups
router.get('/groups', authenticate as any, canView, controller.getGroups);
router.post('/groups', authenticate as any, canManage, validateRequest(createGroupSchema), controller.createGroup);
router.put('/groups/:id', authenticate as any, canManage, controller.updateGroup);
router.delete('/groups/:id', authenticate as any, canManage, controller.deleteGroup);

// Tax Sections
router.get('/tax-sections', authenticate as any, canView, controller.getTaxSections);
router.post('/tax-sections', authenticate as any, canManage, validateRequest(createTaxSectionSchema), controller.createTaxSection);
router.put('/tax-sections/:id', authenticate as any, canManage, controller.updateTaxSection);
router.delete('/tax-sections/:id', authenticate as any, canManage, controller.deleteTaxSection);

// Reimbursements (Admin / Management)
router.get('/reimbursements', authenticate as any, canView, controller.getReimbursements);
router.post('/reimbursements', authenticate as any, canManage, validateRequest(createReimbursementSchema), controller.createReimbursement);
router.put('/reimbursements/:id', authenticate as any, canManage, controller.updateReimbursement);
router.delete('/reimbursements/:id', authenticate as any, canManage, controller.deleteReimbursement);
router.get('/reimbursements/ready-to-pay', authenticate as any, canManage, (req, res) => controller.getReadyToPayReimbursements(req as any, res));
router.get('/reimbursements/all-claims', authenticate as any, canManage, (req, res) => controller.getAllClaims(req as any, res));
router.patch('/reimbursements/:id/payment-mode', authenticate as any, canManage, (req, res) => controller.updateReimbursementPaymentMode(req as any, res));
router.post('/reimbursements/:id/pay', authenticate as any, canManage, validateRequest(processPaymentSchema), (req, res) => controller.processReimbursementPayment(req as any, res));
router.patch('/reimbursements/:id/status', authenticate as any, canManage, (req, res) => controller.updateClaimStatus(req as any, res));
router.post('/reimbursements/batch/payment-mode', authenticate as any, canManage, (req, res) => controller.batchUpdateClaimPaymentMode(req as any, res));
router.post('/reimbursements/batch/pay', authenticate as any, canManage, validateRequest(batchPaymentSchema), (req, res) => controller.batchProcessPayment(req as any, res));

// Categories
router.get('/categories', authenticate as any, canView, controller.getCategories);
router.post('/categories', authenticate as any, canManage, controller.createCategory);
router.put('/categories/:id', authenticate as any, canManage, controller.updateCategory);
router.delete('/categories/:id', authenticate as any, canManage, controller.deleteCategory);

// Pay Cycle
router.get('/pay-cycle', authenticate as any, canView, controller.getPayCycle);
router.put('/pay-cycle', authenticate as any, canManage, validateRequest(updatePayCycleSchema), controller.updatePayCycle);

// Payroll Runs
router.post('/calculate', authenticate as any, canProcess, (req, res) => controller.calculatePayroll(req as any, res));
router.get('/runs', authenticate as any, canView, (req, res) => controller.getAllRuns(req as any, res));
router.get('/payslips', authenticate as any, canView, (req, res) => controller.getAllRuns(req as any, res));
router.post('/runs', authenticate as any, canProcess, validateRequest(createRunSchema), (req, res) => controller.createRun(req as any, res));
router.put('/runs/:id', authenticate as any, canProcess, (req, res) => controller.updateRun(req as any, res));

// Employee Portal (Authenticated — self-service, any authenticated user)
router.get('/portal/me', authenticate as any, (req, res) => controller.getEmployeePortalData(req as any, res));
router.get('/my-payslips', authenticate as any, (req, res) => controller.getMyPayslips(req as any, res));
router.get('/employee-declarations/:userId', authenticate as any, canManage, (req, res) => {
    const userId = parseInt(String(req.params.userId));
    const orgId = (req as any).user?.orgId || 0;
    controller.getEmployeeDeclarationsAdmin(userId, orgId, res);
});
router.get('/my-declarations', authenticate as any, (req, res) => controller.getMyDeclarations(req as any, res));
router.get('/pending-declarations', authenticate as any, (req, res) => controller.getPendingTaxDeclarations(req as any, res));
router.post('/my-declarations', authenticate as any, validateRequest(submitDeclarationSchema), (req, res) => controller.submitDeclaration(req as any, res));
router.post('/tax-declarations/:id/approve', authenticate as any, (req, res) => controller.approveTaxDeclaration(req as any, res));
router.post('/tax-declarations/:id/reject', authenticate as any, (req, res) => controller.rejectTaxDeclaration(req as any, res));
router.delete('/my-declarations/:id', authenticate as any, (req, res) => controller.deleteDeclaration(req as any, res));
router.get('/my-claims', authenticate as any, (req, res) => controller.getMyClaims(req as any, res));
router.post('/reimbursements/check-eligibility', authenticate as any, (req, res) => controller.checkReimbursementEligibility(req as any, res));
router.post('/my-claims', authenticate as any, validateRequest(submitClaimSchema), (req, res) => controller.submitClaim(req as any, res));
router.delete('/my-claims/:id', authenticate as any, (req, res) => controller.deleteClaim(req as any, res));
router.post('/form-12b', authenticate as any, validateRequest(submitForm12BSchema), (req, res) => controller.submitForm12B(req as any, res));
router.post('/tax-regime', authenticate as any, validateRequest(updateTaxRegimeSchema), (req, res) => controller.updateTaxRegime(req as any, res));

// Reporting
router.get('/reports/bank-disbursement', authenticate as any, canView, (req, res) => controller.generateBankFile(req as any, res));
router.get('/reports/payroll-register', authenticate as any, canView, (req, res) => controller.generatePayrollRegister(req as any, res));
router.get('/reports/form-16', authenticate as any, canView, (req, res) => controller.generateForm16Data(req as any, res));
router.get('/reports/pf-ecr', authenticate as any, canView, (req, res) => controller.generateECRFile(req as any, res));

// System Settings
router.get('/system-settings', authenticate as any, canManage, (req, res) => controller.getSystemSettings(req as any, res));
router.post('/system-settings', authenticate as any, canManage, validateRequest(saveSystemSettingsSchema), (req, res) => controller.saveSystemSettings(req as any, res));

export default router;
