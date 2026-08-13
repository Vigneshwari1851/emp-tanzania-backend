import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../../config/prisma';
import { PayrollService } from './payroll.service';
import { PayrollReportService } from './payroll.report.service';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { auditService } from '../audit/audit.service';
import { notificationService } from '../notifications/notification.service';
const payrollService = new PayrollService();
const payrollReportService = new PayrollReportService();

// Standalone audit helper (fire-and-forget)
function _audit(req: any, action: string, entityId: string | number, newValue?: any, oldValue?: any) {
    auditService.log({ module: 'PAYROLL', action, entityId: entityId.toString(), actorId: req.user?.id || 0, newValue, oldValue, ipAddress: req.ip }).catch(() => { });
}

// Safe error response helper — uses AppError status codes, never leaks internals
function _errRes(res: Response, error: any) {
    const status = (error instanceof AppError) ? error.statusCode : 500;
    const message = (error instanceof AppError) ? error.message : 'Failed to process request';
    res.status(status).json({ success: false, message });
}

export class PayrollController {
    // ─── Components ────────────────────────────────────────────────────────
    async getComponents(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.getAllComponents(orgId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async createComponent(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.createComponent(orgId, req.body);
            _audit(req, 'COMPONENT_CREATED', result?.id || 0, req.body);
            res.status(201).json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async deleteComponent(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.deleteComponent(parseInt(String(req.params.id)), orgId);
            _audit(req, 'COMPONENT_DELETED', Number(req.params.id));
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async updateComponent(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.updateComponent(parseInt(String(req.params.id)), orgId, req.body, req.user?.id);
            _audit(req, 'COMPONENT_UPDATED', Number(req.params.id), req.body);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    // ─── Maker-Checker: Pending Component Changes ─────────────────────────
    async getPendingComponentChanges(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.getPendingComponentChanges(orgId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async approveComponentChange(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await payrollService.approveComponentChange(parseInt(String(req.params.changeId)), orgId, userId);
            _audit(req, 'COMPONENT_CHANGE_APPROVED', Number(req.params.changeId));
            res.json({ success: true, data: result, message: 'Change approved and applied.' });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async rejectComponentChange(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await payrollService.rejectComponentChange(parseInt(String(req.params.changeId)), orgId, userId);
            _audit(req, 'COMPONENT_CHANGE_REJECTED', Number(req.params.changeId));
            res.json({ success: true, data: result, message: 'Change rejected.' });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    // ─── Structures ────────────────────────────────────────────────────────
    async getStructures(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.getAllStructures(orgId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async createStructure(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.createStructure(orgId, req.body);
            _audit(req, 'STRUCTURE_CREATED', result?.id || 0, req.body);
            res.status(201).json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async updateStructure(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.updateStructure(parseInt(String(req.params.id)), orgId, req.body);
            _audit(req, 'STRUCTURE_UPDATED', Number(req.params.id), req.body);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async deleteStructure(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.deleteStructure(parseInt(String(req.params.id)), orgId);
            _audit(req, 'STRUCTURE_DELETED', Number(req.params.id));
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    // ─── Groups ────────────────────────────────────────────────────────────
    async getGroups(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.getAllGroups(orgId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async createGroup(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });

            const group = await payrollService.createGroup(orgId, req.body);
            _audit(req, 'GROUP_CREATED', group?.id || 0, req.body);
            res.json({ success: true, data: group });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async updateGroup(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });

            const group = await payrollService.updateGroup(parseInt(String(req.params.id)), orgId, req.body);
            _audit(req, 'GROUP_UPDATED', Number(req.params.id), req.body);
            res.json({ success: true, data: group });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async deleteGroup(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });

            await payrollService.deleteGroup(parseInt(String(req.params.id)), orgId);
            _audit(req, 'GROUP_DELETED', Number(req.params.id));
            res.json({ success: true, message: 'Payroll group deleted' });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    // ─── Tax Sections ──────────────────────────────────────────────────────
    async getTaxSections(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.getAllTaxSections(orgId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async createTaxSection(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.createTaxSection(orgId, req.body);
            _audit(req, 'TAX_SECTION_CREATED', result?.id || 0, req.body);
            res.status(201).json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async updateTaxSection(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.updateTaxSection(parseInt(String(req.params.id)), orgId, req.body);
            _audit(req, 'TAX_SECTION_UPDATED', Number(req.params.id), req.body);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async deleteTaxSection(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.deleteTaxSection(parseInt(String(req.params.id)), orgId);
            _audit(req, 'TAX_SECTION_DELETED', Number(req.params.id));
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    // ─── Reimbursements ────────────────────────────────────────────────────
    async getReimbursements(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.getAllReimbursementTypes(orgId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async createReimbursement(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.createReimbursementType(orgId, req.body);
            _audit(req, 'REIMBURSEMENT_CREATED', result?.id || 0, req.body);
            res.status(201).json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async updateReimbursement(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.updateReimbursementType(parseInt(String(req.params.id)), orgId, req.body);
            _audit(req, 'REIMBURSEMENT_UPDATED', Number(req.params.id), req.body);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async deleteReimbursement(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.deleteReimbursementType(parseInt(String(req.params.id)), orgId);
            _audit(req, 'REIMBURSEMENT_DELETED', Number(req.params.id));
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    // ─── Categories ────────────────────────────────────────────────────────
    async getCategories(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.getAllCategories(orgId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async createCategory(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.createCategory(orgId, req.body);
            _audit(req, 'CATEGORY_CREATED', result?.id || 0, req.body);
            res.status(201).json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async updateCategory(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.updateCategory(parseInt(String(req.params.id)), orgId, req.body);
            _audit(req, 'CATEGORY_UPDATED', Number(req.params.id), req.body);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async deleteCategory(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.deleteCategory(parseInt(String(req.params.id)), orgId);
            _audit(req, 'CATEGORY_DELETED', Number(req.params.id));
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    // ─── Pay Cycle ────────────────────────────────────────────────────────
    async getPayCycle(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.getPayCycle(orgId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async updatePayCycle(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.updatePayCycle(orgId, req.body);
            _audit(req, 'PAY_CYCLE_UPDATED', 'pay-cycle', req.body);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async getAllRuns(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.getAllPayslips(orgId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async createRun(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const result = await payrollService.createPayslip(orgId, req.body, req.user?.id);

            try {
                await auditService.log({
                    module: 'PAYROLL',
                    action: 'PAYROLL_RUN_CREATED',
                    entityId: req.body.month || 'unknown',
                    actorId: req.user?.id || 0,
                    newValue: { month: req.body.month, employeeCount: Array.isArray(result) ? result.length : 1 },
                    ipAddress: req.ip,
                });
            } catch (_) { /* audit failure should not block operation */ }

            res.status(201).json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async updateRun(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ success: false, message: 'Organization context missing' });
            const runId = parseInt(String(req.params.id));

            // Get the current payslip before update (to detect status change)
            const currentRun = await prisma.payslip.findUnique({
                where: { id: runId },
                include: { user: { include: { details: true } } }
            });

            const result = await payrollService.updatePayslip(runId, orgId, req.body);
            _audit(req, 'PAYROLL_RUN_UPDATED', Number(req.params.id), req.body);

            // Send notifications on status change
            if (req.body.status && currentRun && req.body.status !== currentRun.status) {
                const newStatus = req.body.status.toUpperCase();
                const empName = `${currentRun.user?.details?.first_name || ''} ${currentRun.user?.details?.last_name || ''}`.trim();
                const month = currentRun.month;

                try {
                    const STATUS_MESSAGES: Record<string, { title: string; message: string; notifyEmployee?: boolean }> = {
                        'HR_REVIEW': {
                            title: '📋 Payslip Sent for HR Review',
                            message: `Payslip for ${empName} (${month}) has been sent for HR review.`,
                        },
                        'FINANCE_APPROVED': {
                            title: '✅ Payslip Finance Approved',
                            message: `Payslip for ${empName} (${month}) has been approved by finance.`,
                        },
                        'PAID': {
                            title: '💰 Salary Credited',
                            message: `Your salary for ${month} has been processed and marked as paid.`,
                            notifyEmployee: true,
                        },
                        'DRAFT': {
                            title: '🔄 Payslip Rejected',
                            message: `Payslip for ${empName} (${month}) was rejected and sent back to Draft.`,
                        },
                    };

                    const statusInfo = STATUS_MESSAGES[newStatus];
                    if (statusInfo) {
                        // Notify the employee when paid
                        if (statusInfo.notifyEmployee && currentRun.user_id) {
                            await notificationService.create({
                                user_id: currentRun.user_id,
                                title: statusInfo.title,
                                message: statusInfo.message,
                                type: 'PAYROLL',
                                related_module: 'payroll',
                                related_id: runId,
                                metadata: { status: newStatus, month },
                            });
                        }

                        // Notify admins or HR/Finance users (same branch, or super admins)
                        const employeeBranch = currentRun.user?.details?.branch_name;

                        const admins = await prisma.user.findMany({
                            where: {
                                OR: [
                                    { roles: { some: { role: { role_name: { in: ['super admin', 'SUPER ADMIN', 'CEO', 'ceo'] } } } } },
                                    {
                                        AND: [
                                            { details: { branch_name: employeeBranch } },
                                            {
                                                OR: [
                                                    { roles: { some: { role: { role_name: { in: ['admin', 'ADMIN', 'System Administrator', 'SYSTEM ADMINISTRATOR'] } } } } },
                                                    { details: { department: { department_name: { in: ['HR', 'Finance', 'Human Resources', 'Accounts'] } } } }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            },
                            select: { id: true },
                        });
                        for (const admin of admins) {
                            if (admin.id !== req.user?.id) {
                                await notificationService.create({
                                    user_id: admin.id,
                                    title: statusInfo.title,
                                    message: statusInfo.message,
                                    type: 'PAYROLL',
                                    related_module: 'payroll',
                                    related_id: runId,
                                    metadata: { status: newStatus, month, employeeName: empName },
                                });
                            }
                        }
                    }
                } catch (_) { /* notification failure should not block operation */ }
            }

            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    // ─── Employee Portal ────────────────────────────────────────────────────
    async getEmployeePortalData(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            // orgId may be null for employees without dept/branch; service handles it
            const orgId = req.user?.orgId ?? null;
            const result = await payrollService.getEmployeePortalData(userId, orgId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async getMyPayslips(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const orgId = req.user?.orgId;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await payrollService.getMyPayslips(userId, orgId || 0);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async getMyDeclarations(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const orgId = req.user?.orgId;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await payrollService.getMyDeclarations(userId, orgId || 0);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async submitDeclaration(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const orgId = req.user?.orgId;
            if (!userId || !orgId) return res.status(401).json({ success: false, message: 'Unauthorized or Organization context missing' });
            const result = await payrollService.submitDeclaration(userId, orgId, req.body);
            res.status(201).json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async deleteDeclaration(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const orgId = req.user?.orgId;
            if (!userId || !orgId) return res.status(401).json({ success: false, message: 'Unauthorized or Organization context missing' });
            const result = await payrollService.deleteDeclaration(parseInt(String(req.params.id)), userId, orgId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async getPendingTaxDeclarations(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const orgId = req.user?.orgId || 0;
            const singularRole = (req.user as any)?.role || '';
            const userRoles = req.user?.roles || [];
            const rolesArr = Array.isArray(userRoles) ? userRoles : [userRoles];
            const roleNames: string[] = [];
            if (singularRole) roleNames.push(String(singularRole).toUpperCase());
            for (const r of rolesArr) {
                if (typeof r === 'string' && r.trim()) roleNames.push(r.toUpperCase());
                else if (r && typeof r === 'object') {
                    const rName = (r as any).role_name || (r as any).role?.role_name || (r as any).name;
                    if (rName) roleNames.push(String(rName).toUpperCase());
                }
            }
            const roleStr = roleNames.join(',');
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await payrollService.getPendingTaxDeclarations(userId, roleStr, orgId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async approveTaxDeclaration(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const orgId = req.user?.orgId;
            const singularRole = (req.user as any)?.role;
            const userRoles = req.user?.roles || [];
            let roleStr = singularRole ? String(singularRole) : 'ADMIN';
            const rolesArr = Array.isArray(userRoles) ? userRoles : [userRoles];
            for (const r of rolesArr) {
                if (typeof r === 'string' && r.trim()) { roleStr = r; break; }
                if (r && typeof r === 'object') {
                    const rObj = r as any;
                    const rName = rObj.role_name || rObj.role?.role_name || rObj.name;
                    if (rName) { roleStr = String(rName); break; }
                }
            }
            const idParam = String(req.params.id || '0');
            const remarksStr = typeof req.body?.remarks === 'string' ? req.body.remarks : undefined;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await payrollService.approveTaxDeclaration(parseInt(idParam, 10), userId, roleStr, orgId || 0, remarksStr);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async rejectTaxDeclaration(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const orgId = req.user?.orgId;
            const singularRole = (req.user as any)?.role;
            const userRoles = req.user?.roles || [];
            let roleStr = singularRole ? String(singularRole) : 'ADMIN';
            const rolesArr = Array.isArray(userRoles) ? userRoles : [userRoles];
            for (const r of rolesArr) {
                if (typeof r === 'string' && r.trim()) { roleStr = r; break; }
                if (r && typeof r === 'object') {
                    const rObj = r as any;
                    const rName = rObj.role_name || rObj.role?.role_name || rObj.name;
                    if (rName) { roleStr = String(rName); break; }
                }
            }
            const idParam = String(req.params.id || '0');
            const remarksStr = typeof req.body?.remarks === 'string' ? req.body.remarks : undefined;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await payrollService.rejectTaxDeclaration(parseInt(idParam, 10), userId, roleStr, orgId || 0, remarksStr);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async getMyClaims(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const orgId = req.user?.orgId;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const result = await payrollService.getMyClaims(userId, orgId || 0);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async submitClaim(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const orgId = req.user?.orgId;
            if (!userId || !orgId) return res.status(401).json({ success: false, message: 'Unauthorized or Organization context missing' });
            const result = await payrollService.submitClaim(userId, orgId, req.body);
            _audit(req, 'CLAIM_SUBMITTED', result?.id || 0, req.body);
            res.status(201).json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async deleteClaim(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const orgId = req.user?.orgId;
            if (!userId || !orgId) return res.status(401).json({ success: false, message: 'Unauthorized or Organization context missing' });
            const result = await payrollService.deleteClaim(parseInt(String(req.params.id)), userId, orgId);
            _audit(req, 'CLAIM_DELETED', Number(req.params.id));
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async checkReimbursementEligibility(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const orgId = req.user?.orgId;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
            const { type, amount } = req.body;
            const result = await payrollService.checkReimbursementEligibility(userId, orgId || 0, type, Number(amount || 0));
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async getEmployeeDeclarationsAdmin(userId: number, orgId: number, res: Response) {
        try {
            const result = await payrollService.getMyDeclarations(userId, orgId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async calculatePayroll(req: AuthRequest, res: Response) {
        try {
            // Only admins/managers should typically calculate payroll
            const { employeeId, month, year, workingDays, lopDays, overtimeHours, arrearsAmount, bonusAmount } = req.body;
            if (!employeeId || !month || !year) {
                return res.status(400).json({ success: false, message: 'Missing required parameters: employeeId, month, year' });
            }

            const result = await payrollService.calculatePayrollEngine({
                employeeId: Number(employeeId),
                month: Number(month),
                year: Number(year),
                workingDays: Number(workingDays || 26),
                lopDays: Number(lopDays || 0),
                overtimeHours: Number(overtimeHours || 0),
                arrearsAmount: Number(arrearsAmount || 0),
                bonusAmount: Number(bonusAmount || 0)
            });

            _audit(req, 'PAYROLL_CALCULATED', req.body.employeeId, { month: req.body.month, year: req.body.year });
            res.json({ success: true, data: result });
        } catch (error: any) {
            console.error("Payroll calculation failed:", error);
            _errRes(res, error);
        }
    }

    async submitForm12B(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const result = await payrollService.submitForm12B(userId, req.body);
            res.status(201).json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async updateTaxRegime(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const result = await payrollService.updateTaxRegime(userId, req.body.regime);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async generateBankFile(req: AuthRequest, res: Response) {
        try {
            const { month } = req.query;
            if (!month) return res.status(400).json({ success: false, message: 'Month is required' });

            const orgId = req.user?.orgId;
            const csv = await payrollReportService.generateBankDisbursementFile(String(month), orgId || undefined);

            // Generate SHA-256 fingerprint for anti-tampering
            const hash = crypto.createHash('sha256').update(csv).digest('hex');

            try {
                const rowCount = csv.split('\n').length - 1;
                await auditService.log({
                    module: 'PAYROLL',
                    action: 'BANK_FILE_GENERATED',
                    entityId: String(month),
                    actorId: req.user?.id || 0,
                    newValue: { file: `Bank_Disbursement_${month}.csv`, rows: rowCount, checksum: hash },
                    ipAddress: req.ip,
                });
            } catch (_) { /* audit failure should not block download */ }

            res.header('Content-Type', 'text/csv');
            res.header('X-File-Hash', hash);
            res.header('Access-Control-Expose-Headers', 'X-File-Hash');
            res.attachment(`Bank_Disbursement_${month}.csv`);
            res.send(csv);

        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async generatePayrollRegister(req: AuthRequest, res: Response) {
        try {
            const { month } = req.query;
            if (!month) return res.status(400).json({ success: false, message: 'Month is required' });

            const orgId = req.user?.orgId;
            const excelBuffer = await payrollReportService.generatePayrollRegister(String(month), orgId || undefined);

            // Generate SHA-256 fingerprint for anti-tampering
            const hash = crypto.createHash('sha256').update(excelBuffer).digest('hex');

            try {
                await auditService.log({
                    module: 'PAYROLL',
                    action: 'PAYROLL_REGISTER_GENERATED',
                    entityId: String(month),
                    actorId: req.user?.id || 0,
                    newValue: { file: `Payroll_Register_${month}.xlsx`, checksum: hash },
                    ipAddress: req.ip,
                });
            } catch (_) { /* audit failure should not block download */ }

            res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.header('X-File-Hash', hash);
            res.header('Access-Control-Expose-Headers', 'X-File-Hash');
            res.attachment(`Payroll_Register_${month}.xlsx`);
            res.send(excelBuffer);

        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async generateECRFile(req: AuthRequest, res: Response) {
        try {
            const { month } = req.query;
            if (!month) return res.status(400).json({ success: false, message: 'Month is required' });

            const orgId = req.user?.orgId;
            const ecr = await payrollReportService.generatePFECRFile(String(month), orgId || undefined);

            res.header('Content-Type', 'text/plain');
            res.attachment(`PF_ECR_${month}.txt`);
            res.send(ecr);
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async generateForm16Data(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const financialYear = req.query.financialYear || '2025-26';
            const orgId = req.user?.orgId;
            const data = await payrollReportService.generateForm16Data(userId, String(financialYear), orgId || undefined);

            res.json({ success: true, data });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async getSystemSettings(req: AuthRequest, res: Response) {
        try {
            const settings = await payrollService.getSystemSettings();
            res.json({ success: true, data: settings });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async saveSystemSettings(req: AuthRequest, res: Response) {
        try {
            const oldSettings = await payrollService.getSystemSettings();
            await payrollService.saveSystemSettings(req.body);
            auditService.log({
                module: 'SETTINGS',
                action: 'SYSTEM_SETTINGS_UPDATED',
                entityId: 'system-settings',
                actorId: req.user?.id || 0,
                newValue: req.body,
                oldValue: oldSettings,
                ipAddress: req.ip
            }).catch(() => { });
            res.json({ success: true, message: 'Settings saved successfully' });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async getReadyToPayReimbursements(req: AuthRequest, res: Response) {
        try {
            const orgId = req.user?.orgId;
            const result = await payrollService.getReadyToPayReimbursements(orgId || undefined);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async updateReimbursementPaymentMode(req: AuthRequest, res: Response) {
        try {
            const id = parseInt(String(req.params.id));
            const { payment_mode } = req.body;
            const result = await payrollService.updateReimbursementPaymentMode(id, payment_mode);
            _audit(req, 'REIMBURSEMENT_PAYMENT_MODE_UPDATED', id, { payment_mode });
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async processReimbursementPayment(req: AuthRequest, res: Response) {
        try {
            const id = parseInt(String(req.params.id));
            const actorId = req.user?.id;
            const result = await payrollService.processReimbursementPayment(id, req.body, actorId);
            _audit(req, 'REIMBURSEMENT_PAID', id, req.body);
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async getAllClaims(req: AuthRequest, res: Response) {
        try {
            const result = await payrollService.getAllClaims();
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async updateClaimStatus(req: AuthRequest, res: Response) {
        try {
            const id = parseInt(String(req.params.id));
            const { status, remarks } = req.body;
            const actorId = req.user?.id;
            const result = await payrollService.updateClaimStatus(id, status, remarks, actorId);
            _audit(req, 'CLAIM_STATUS_UPDATED', id, { status, remarks });
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async batchUpdateClaimPaymentMode(req: AuthRequest, res: Response) {
        try {
            const { ids, payment_mode } = req.body;
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ success: false, message: 'ids array is required' });
            }
            const result = await payrollService.batchUpdateClaimPaymentMode(ids, payment_mode);
            _audit(req, 'BATCH_PAYMENT_MODE_UPDATE', 'bulk', { count: ids.length, payment_mode });
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }

    async batchProcessPayment(req: AuthRequest, res: Response) {
        try {
            const { ids, payment_reference, payment_mode } = req.body;
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ success: false, message: 'ids array is required' });
            }
            const actorId = req.user?.id;
            const result = await payrollService.batchProcessPayment(ids, payment_reference, payment_mode, actorId);
            _audit(req, 'BATCH_PAYMENT_PROCESSED', 'bulk', { count: ids.length, payment_mode, payment_reference });
            res.json({ success: true, data: result });
        } catch (error: any) {
            _errRes(res, error);
        }
    }
}
