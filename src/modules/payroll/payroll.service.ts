import prisma from '../../config/prisma';
import { StatutoryEngine } from './statutory.engine';
import { TaxEngine } from './tax.engine';
import { PayrollEngineFactory } from './payroll.engines';
import { AppError } from '../../middlewares/error.middleware';
import { notificationService } from '../notifications/notification.service';

async function getSetting(key: string, fallback: number): Promise<number> {
    try {
        const setting = await prisma.systemSetting.findUnique({ where: { key } });
        if (setting && setting.value) {
            const val = parseFloat(setting.value);
            if (!isNaN(val)) return val;
        }
    } catch { /* use fallback */ }
    return fallback;
}

export class PayrollService {
    // ─── Salary Components ──────────────────────────────────────────────────
    async getAllComponents(orgId: number) {
        return await prisma.salaryComponent.findMany({
            where: { status: true, organization_id: orgId },
            orderBy: { name: 'asc' }
        });
    }

    async createComponent(orgId: number, data: any) {
        const existing = await prisma.salaryComponent.findFirst({
            where: {
                organization_id: orgId,
                name: data.name,
                status: true
            }
        });
        if (existing) {
            throw new AppError(`Component "${data.name}" already exists in your library.`, 409);
        }

        return await prisma.salaryComponent.create({
            data: {
                organization_id: orgId,
                name: data.name,
                type: data.type,
                calculation_type: data.calculationType,
                value: data.value,
                is_taxable: data.isTaxable,
                is_statutory: data.isStatutory,
                is_default: !!data.isDefault,
                status: true
            }
        });
    }

    async updateComponent(id: number, orgId: number, data: any, requestedBy?: number) {
        const component = await prisma.salaryComponent.findFirst({
            where: { id, organization_id: orgId, status: true }
        });
        if (!component) throw new AppError('Component not found.', 404);        // If component is a default, create a pending change instead of direct update
        if (component.is_default) {
            const change = await prisma.salaryComponentChange.create({
                data: {
                    salary_component_id: id,
                    proposed_name: data.name !== component.name ? data.name : undefined,
                    proposed_type: data.type !== component.type ? data.type : undefined,
                    proposed_calculation_type: data.calculationType !== component.calculation_type ? data.calculationType : undefined,
                    proposed_value: data.value !== undefined && parseFloat(String(data.value)) !== parseFloat(String(component.value))
                        ? parseFloat(String(data.value)) : undefined,
                    proposed_is_taxable: data.isTaxable !== component.is_taxable ? data.isTaxable : undefined,
                    proposed_is_statutory: data.isStatutory !== component.is_statutory ? data.isStatutory : undefined,
                    status: 'pending',
                    requested_by: requestedBy || null
                }
            });
            return { _pendingChange: true, change, message: 'Edit submitted for approval. An admin will review your changes.' };
        }

        // Non-default: direct update
        const existing = await prisma.salaryComponent.findFirst({
            where: {
                organization_id: orgId,
                name: data.name,
                id: { not: id },
                status: true
            }
        });
        if (existing) {
            throw new AppError(`Component "${data.name}" already exists in your library.`, 409);
        }

        return await prisma.salaryComponent.update({
            where: { id, organization_id: orgId },
            data: {
                name: data.name,
                type: data.type,
                calculation_type: data.calculationType,
                value: data.value,
                is_taxable: data.isTaxable,
                is_statutory: data.isStatutory
            }
        });
    }

    // ─── Maker-Checker: Pending Component Changes ─────────────────────────
    async getPendingComponentChanges(orgId: number) {
        return await prisma.salaryComponentChange.findMany({
            where: {
                status: 'pending',
                component: { organization_id: orgId, status: true }
            },
            include: { component: true },
            orderBy: { created_at: 'desc' }
        });
    }

    async approveComponentChange(changeId: number, orgId: number, approvedBy: number) {
        const change = await prisma.salaryComponentChange.findFirst({
            where: {
                id: changeId,
                status: 'pending',
                component: { organization_id: orgId, status: true }
            },
            include: { component: true }
        });
        if (!change) throw new AppError('Pending change not found or already processed.', 404);

        // Apply the proposed changes to the component
        const updateData: any = {};
        if (change.proposed_name) updateData.name = change.proposed_name;
        if (change.proposed_type) updateData.type = change.proposed_type;
        if (change.proposed_calculation_type) updateData.calculation_type = change.proposed_calculation_type;
        if (change.proposed_value !== null && change.proposed_value !== undefined) updateData.value = change.proposed_value;
        if (change.proposed_is_taxable !== null && change.proposed_is_taxable !== undefined) updateData.is_taxable = change.proposed_is_taxable;
        if (change.proposed_is_statutory !== null && change.proposed_is_statutory !== undefined) updateData.is_statutory = change.proposed_is_statutory;

        const [updatedComponent] = await prisma.$transaction([
            prisma.salaryComponent.update({
                where: { id: change.salary_component_id },
                data: updateData
            }),
            prisma.salaryComponentChange.update({
                where: { id: changeId },
                data: { status: 'approved', approved_by: approvedBy }
            })
        ]);

        return updatedComponent;
    }

    async rejectComponentChange(changeId: number, orgId: number, rejectedBy: number) {
        const change = await prisma.salaryComponentChange.findFirst({
            where: {
                id: changeId,
                status: 'pending',
                component: { organization_id: orgId, status: true }
            }
        });
        if (!change) throw new AppError('Pending change not found or already processed.', 404);

        return await prisma.salaryComponentChange.update({
            where: { id: changeId },
            data: { status: 'rejected', approved_by: rejectedBy }
        });
    }

    async deleteComponent(id: number, orgId: number) {
        const component = await prisma.salaryComponent.findFirst({
            where: { id, organization_id: orgId, status: true }
        });
        if (!component) throw new AppError('Component not found.', 404);
        if (component.is_default) throw new AppError('Default components cannot be deleted. They are country-specific system defaults.', 400);

        return await prisma.salaryComponent.update({
            where: { id, organization_id: orgId },
            data: { status: false }
        });
    }

    // ─── Salary Structures ──────────────────────────────────────────────────
    async getAllStructures(orgId: number) {
        return await prisma.salaryStructure.findMany({
            where: { status: true, organization_id: orgId },
            include: {
                components: {
                    include: {
                        salary_component: true
                    },
                    orderBy: { order: 'asc' }
                }
            }
        });
    }

    async createStructure(orgId: number, data: any) {
        const { components, ...rest } = data;

        // Always include default components
        const defaultComponents = await prisma.salaryComponent.findMany({
            where: { organization_id: orgId, is_default: true, status: true }
        });

        // Merge: default components (always included) + user-selected components (deduplicated)
        const defaultIds = new Set(defaultComponents.map(c => c.id));
        const userComponentIds: number[] = (components || []).map((comp: any) => {
            const id = typeof comp.id === 'string' && comp.id.startsWith('struct-')
                ? parseInt(comp.id.split('-').pop()!)
                : parseInt(comp.id);
            return id;
        }).filter((id: number) => !isNaN(id) && !defaultIds.has(id));

        const allComponentIds = [...defaultComponents.map(c => c.id), ...userComponentIds];

        return await prisma.salaryStructure.create({
            data: {
                organization_id: orgId,
                name: rest.name,
                level: rest.level,
                role_id: (rest.roleId && !isNaN(parseInt(rest.roleId))) ? parseInt(rest.roleId) : null,
                employee_id: (rest.employeeId && !isNaN(parseInt(rest.employeeId))) ? parseInt(rest.employeeId) : null,
                components: {
                    create: allComponentIds.map((componentId, index) => ({
                        salary_component_id: componentId,
                        order: index
                    }))
                }
            },
            include: { components: true }
        });
    }

    async updateStructure(id: number, orgId: number, data: any) {
        const { components, ...rest } = data;

        // Always include default components
        const defaultComponents = await prisma.salaryComponent.findMany({
            where: { organization_id: orgId, is_default: true, status: true }
        });

        // Merge: default components (always included) + user-selected components (deduplicated)
        const defaultIds = new Set(defaultComponents.map(c => c.id));
        const userComponentIds: number[] = (components || []).map((comp: any) => {
            const id = typeof comp.id === 'string' && comp.id.startsWith('struct-')
                ? parseInt(comp.id.split('-').pop()!)
                : parseInt(comp.id);
            return id;
        }).filter((id: number) => !isNaN(id) && !defaultIds.has(id));

        const allComponentIds = [...defaultComponents.map(c => c.id), ...userComponentIds];

        // Delete existing components first
        await prisma.salaryStructureComponent.deleteMany({
            where: { salary_structure_id: id }
        });

        return await prisma.salaryStructure.update({
            where: { id, organization_id: orgId },
            data: {
                name: rest.name,
                level: rest.level,
                role_id: (rest.roleId && !isNaN(parseInt(rest.roleId))) ? parseInt(rest.roleId) : null,
                employee_id: (rest.employeeId && !isNaN(parseInt(rest.employeeId))) ? parseInt(rest.employeeId) : null,
                components: {
                    create: allComponentIds.map((componentId, index) => ({
                        salary_component_id: componentId,
                        order: index
                    }))
                }
            },
            include: { components: true }
        });
    }

    async deleteStructure(id: number, orgId: number) {
        return await prisma.salaryStructure.update({
            where: { id, organization_id: orgId },
            data: { status: false }
        });
    }

    // ─── Tax Sections ───────────────────────────────────────────────────────
    async getAllTaxSections(orgId: number) {
        return await prisma.taxSection.findMany({
            where: { status: true, organization_id: orgId }
        });
    }

    async createTaxSection(orgId: number, data: any) {
        return await prisma.taxSection.create({
            data: {
                organization_id: orgId,
                section: data.section,
                label: data.label,
                limit: data.limit,
                instruments: data.instruments || [],
                status: true
            }
        });
    }

    async updateTaxSection(id: number, orgId: number, data: any) {
        return await prisma.taxSection.update({
            where: { id, organization_id: orgId },
            data: {
                section: data.section,
                label: data.label,
                limit: data.limit,
                instruments: data.instruments
            }
        });
    }

    async deleteTaxSection(id: number, orgId: number) {
        return await prisma.taxSection.update({
            where: { id, organization_id: orgId },
            data: { status: false }
        });
    }

    // ─── Reimbursement Types ────────────────────────────────────────────────
    async getAllReimbursementTypes(orgId: number) {
        return await prisma.reimbursementType.findMany({
            where: { status: true, organization_id: orgId },
            include: {
                role: true,
                department: true,
                branch: true,
                payroll_group: true
            }
        });
    }

    async createReimbursementType(orgId: number, data: any) {
        return await prisma.reimbursementType.create({
            data: {
                organization_id: orgId,
                type: data.type,
                label: data.label,
                limit: data.limit,
                period: data.period || 'Monthly',
                role_id: (data.role_id && !isNaN(parseInt(data.role_id))) ? parseInt(data.role_id) : null,
                department_id: (data.department_id && !isNaN(parseInt(data.department_id))) ? parseInt(data.department_id) : null,
                branch_id: (data.branch_id && !isNaN(parseInt(data.branch_id))) ? parseInt(data.branch_id) : null,
                payroll_group_id: (data.payroll_group_id && !isNaN(parseInt(data.payroll_group_id))) ? parseInt(data.payroll_group_id) : null,
                status: true
            },
            include: {
                role: true,
                department: true,
                branch: true,
                payroll_group: true
            }
        });
    }

    async updateReimbursementType(id: number, orgId: number, data: any) {
        return await prisma.reimbursementType.update({
            where: { id, organization_id: orgId },
            data: {
                type: data.type,
                label: data.label,
                limit: data.limit,
                period: data.period,
                role_id: (data.role_id && !isNaN(parseInt(data.role_id))) ? parseInt(data.role_id) : null,
                department_id: (data.department_id && !isNaN(parseInt(data.department_id))) ? parseInt(data.department_id) : null,
                branch_id: (data.branch_id && !isNaN(parseInt(data.branch_id))) ? parseInt(data.branch_id) : null,
                payroll_group_id: (data.payroll_group_id && !isNaN(parseInt(data.payroll_group_id))) ? parseInt(data.payroll_group_id) : null,
            },
            include: {
                role: true,
                department: true,
                branch: true,
                payroll_group: true
            }
        });
    }

    async deleteReimbursementType(id: number, orgId: number) {
        return await prisma.reimbursementType.update({
            where: { id, organization_id: orgId },
            data: { status: false }
        });
    }

    // ─── Payroll Groups ─────────────────────────────────────────────────────
    async getAllGroups(orgId: number) {
        return await prisma.payrollGroup.findMany({
            where: { status: true, organization_id: orgId },
            include: {
                salary_structure: {
                    include: {
                        components: {
                            include: {
                                salary_component: true
                            }
                        }
                    }
                }
            }
        });
    }

    async createGroup(orgId: number, data: any) {
        return await prisma.payrollGroup.create({
            data: {
                organization_id: orgId,
                name: data.name,
                criteria: data.criteria,
                salary_structure_id: (data.salaryStructureId && !isNaN(parseInt(data.salaryStructureId))) ? parseInt(data.salaryStructureId) : null,
                payment_category_id: (data.paymentCategoryId && !isNaN(parseInt(data.paymentCategoryId))) ? parseInt(data.paymentCategoryId) : null,
                status: true
            }
        });
    }

    async updateGroup(id: number, orgId: number, data: any) {
        return await prisma.payrollGroup.update({
            where: { id, organization_id: orgId },
            data: {
                name: data.name,
                criteria: data.criteria,
                salary_structure_id: (data.salaryStructureId && !isNaN(parseInt(data.salaryStructureId))) ? parseInt(data.salaryStructureId) : null,
                payment_category_id: (data.paymentCategoryId && !isNaN(parseInt(data.paymentCategoryId))) ? parseInt(data.paymentCategoryId) : null,
                status: data.status !== undefined ? data.status : true
            }
        });
    }

    async deleteGroup(id: number, orgId: number) {
        return await prisma.payrollGroup.update({
            where: { id, organization_id: orgId },
            data: { status: false }
        });
    }

    // ─── Payment Categories ─────────────────────────────────────────────────
    async getAllCategories(orgId: number) {
        return await prisma.paymentCategory.findMany({
            where: { status: true, organization_id: orgId }
        });
    }

    async createCategory(orgId: number, data: any) {
        return await prisma.paymentCategory.create({
            data: {
                organization_id: orgId,
                name: data.name,
                frequency: data.frequency,
                pay_day: data.payDay,
                status: true
            }
        });
    }

    async updateCategory(id: number, orgId: number, data: any) {
        return await prisma.paymentCategory.update({
            where: { id, organization_id: orgId },
            data: {
                name: data.name,
                frequency: data.frequency,
                pay_day: data.payDay
            }
        });
    }

    async deleteCategory(id: number, orgId: number) {
        return await prisma.paymentCategory.update({
            where: { id, organization_id: orgId },
            data: { status: false }
        });
    }

    // ─── Pay Cycle ──────────────────────────────────────────────────────────
    async getPayCycle(orgId: number) {
        return await prisma.payCycle.findFirst({
            where: { organization_id: orgId },
            orderBy: { id: 'desc' }
        });
    }

    async updatePayCycle(orgId: number, data: any) {
        const current = await this.getPayCycle(orgId);
        if (current) {
            return await prisma.payCycle.update({
                where: { id: current.id, organization_id: orgId },
                data: {
                    frequency: data.frequency,
                    pay_day: data.payDay,
                    attendance_start_day: data.attendanceStartDay,
                    attendance_end_day: data.attendanceEndDay,
                    cutoff_day: data.cutoffDay
                }
            });
        }
        return await prisma.payCycle.create({
            data: {
                organization_id: orgId,
                frequency: data.frequency,
                pay_day: data.payDay,
                attendance_start_day: data.attendanceStartDay,
                attendance_end_day: data.attendanceEndDay,
                cutoff_day: data.cutoffDay
            }
        });
    }

  async getAllPayslips(orgId: number) {
    return await prisma.payslip.findMany({
      where: { organization_id: orgId },
      include: { user: { include: { details: { include: { role: true, department: true, designation: true, payroll_group: true, team: true } } } } },
      orderBy: { created_at: 'desc' }
    });
  }

  async createPayslip(orgId: number, data: any, actorId?: number) {
    // Use upsert to prevent duplicate payslips for the same employee in the same month
    // If a payslip already exists for this user+month, update it instead of creating a new one
    const existing = await prisma.payslip.findFirst({
      where: {
        organization_id: orgId,
        user_id: parseInt(data.userId),
        month: data.month
      },
      orderBy: { created_at: 'desc' }
    });

    let payslip;
    if (existing) {
      payslip = await prisma.payslip.update({
        where: { id: existing.id },
        data: {
          gross_amount: data.grossAmount,
          deduction_amount: data.deductionAmount,
          net_amount: data.netAmount,
          status: data.status || 'DRAFT',
          breakdown: data.breakdown || {}
        }
      });
    } else {
      payslip = await prisma.payslip.create({
        data: {
          organization_id: orgId,
          user_id: parseInt(data.userId),
          month: data.month,
          gross_amount: data.grossAmount,
          deduction_amount: data.deductionAmount,
          net_amount: data.netAmount,
          status: data.status || 'DRAFT',
          breakdown: data.breakdown || {}
        }
      });
    }

    // Link corresponding approved reimbursement claims and mark them as Paid
    try {
        await prisma.expenseClaim.updateMany({
            where: {
                user_id: parseInt(data.userId),
                status: { in: ['approved', 'waiting_payout'] },
                payment_status: 'Ready To Pay',
                payment_mode: 'Salary Payroll'
            },
            data: {
                status: 'Paid',
                payment_status: 'Paid',
                payroll_id: payslip.id,
                payment_date: new Date(),
                payment_reference: `PAYROLL-${payslip.id}`,
                paid_by: actorId || null
            }
        });
    } catch (err) {
        console.error("Failed to update reimbursement claims to Paid:", err);
    }

    // Reduce loan/advance balances (transactional)
    try {
        const loanRecovery = Number(data.breakdown?.deductions?.['Loan Recovery']) || 0;
        const advanceRecovery = Number(data.breakdown?.deductions?.['Advance Recovery']) || 0;

        if (loanRecovery > 0 || advanceRecovery > 0) {
            await this.recoverLoanAndAdvance(parseInt(data.userId), loanRecovery, advanceRecovery);
        }
    } catch (err) {
        console.error("Failed to reduce loan/advance balances:", err);
    }

    return payslip;
  }

  async updatePayslip(id: number, orgId: number, data: any) {
    return await prisma.payslip.update({
        where: { id, organization_id: orgId },
        data: {
            status: data.status,
            ...(data.breakdown && { breakdown: data.breakdown }),
            ...(data.netAmount && { net_amount: data.netAmount })
        }
    });
  }

    // ─── Employee Portal Methods ────────────────────────────────────────────
    async getMyPayslips(userId: number, orgId: number | null) {
        return await prisma.payslip.findMany({
            where: { user_id: userId, ...(orgId ? { organization_id: orgId } : {}) },
            orderBy: { created_at: 'desc' }
        });
    }

    async getMyDeclarations(userId: number, orgId: number | null) {
        return await prisma.taxDeclaration.findMany({
            where: { user_id: userId, ...(orgId ? { organization_id: orgId } : {}) },
            orderBy: { submitted_on: 'desc' }
        });
    }

    async submitDeclaration(userId: number, orgId: number, data: any) {
        const decl = await prisma.taxDeclaration.create({
            data: {
                user_id: userId,
                organization_id: orgId,
                section: data.section,
                instrument: data.instrument,
                amount: data.amount,
                financial_year: data.financialYear || '2025-26',
                proof_url: data.proofUrl,
                status: 'Pending Manager Approval'
            }
        });

        // Stage 1 Notification: Notify Reporting Manager (or HR/Admins if no manager assigned)
        try {
            const userDetail = await prisma.userDetail.findUnique({
                where: { user_id: userId },
                select: { first_name: true, last_name: true, reporting_manager_id: true }
            });
            const empName = userDetail ? `${userDetail.first_name || ''} ${userDetail.last_name || ''}`.trim() : 'An employee';

            const recipientIds = new Set<number>();
            if (userDetail?.reporting_manager_id) {
                recipientIds.add(userDetail.reporting_manager_id);
            } else {
                const adminUsers = await prisma.user.findMany({
                    where: {
                        OR: [
                            { roles: { some: { role: { role_name: { in: ['super admin', 'SUPER ADMIN', 'CEO', 'ceo', 'admin', 'ADMIN', 'HR', 'hr', 'MANAGER', 'manager'] } } } } },
                            { details: { role: { role_name: { in: ['super admin', 'SUPER ADMIN', 'CEO', 'ceo', 'admin', 'ADMIN', 'HR', 'hr', 'MANAGER', 'manager'] } } } }
                        ]
                    },
                    select: { id: true }
                });
                for (const u of adminUsers) {
                    recipientIds.add(u.id);
                }
            }
            recipientIds.delete(userId);

            for (const targetId of recipientIds) {
                await notificationService.create({
                    user_id: targetId,
                    title: '📜 New Tax Declaration Submitted',
                    message: `${empName} submitted a Tax Declaration for Section ${data.section} (₹${data.amount}) for FY ${data.financialYear || '2025-26'}. Pending Manager Approval.`,
                    type: 'TAX_DECLARATION',
                    related_module: 'tax_declaration',
                    related_id: decl.id
                });
            }
        } catch (e) {
            console.error('Notification error in submitDeclaration:', e);
        }

        return decl;
    }

    async approveTaxDeclaration(id: number, approverUserId: number, approverRole: string, orgId: number, remarks?: string) {
        const decl = await prisma.taxDeclaration.findUnique({
            where: { id },
            include: { user: true }
        });
        if (!decl) throw new AppError('Tax declaration not found', 404);

        const sUpper = (decl.status || '').trim().toUpperCase();

        let newStatus = 'Approved';

        if (sUpper === 'PENDING MANAGER APPROVAL' || sUpper === 'PENDING') {
            newStatus = 'Pending HR Approval';
        } else if (sUpper === 'PENDING HR APPROVAL') {
            newStatus = 'Pending Finance Approval';
        } else {
            newStatus = 'Approved';
        }

        const updated = await prisma.taxDeclaration.update({
            where: { id },
            data: {
                status: newStatus,
                remarks: remarks ? `${decl.remarks ? decl.remarks + ' | ' : ''}${approverRole}: ${remarks}` : decl.remarks
            }
        });

        // Notifications (safely wrapped)
        try {
            const empDetail = await prisma.userDetail.findUnique({
                where: { user_id: decl.user_id },
                select: { first_name: true, last_name: true }
            });
            const empName = empDetail ? `${empDetail.first_name || ''} ${empDetail.last_name || ''}`.trim() : 'Employee';

            // 1. Notify Employee of progress
            let empTitle = `Tax Declaration Status: ${newStatus}`;
            let empMessage = `Your Tax Declaration for Section ${decl.section} (₹${decl.amount}) is now ${newStatus}.`;

            if (newStatus === 'Pending HR Approval') {
                empTitle = '✅ Tax Declaration Approved by Manager';
                empMessage = `Manager approved your Tax Declaration for Section ${decl.section} (₹${decl.amount}). Pending HR verification.`;
            } else if (newStatus === 'Pending Finance Approval') {
                empTitle = '✅ Tax Declaration Verified by HR';
                empMessage = `HR verified your Tax Declaration for Section ${decl.section} (₹${decl.amount}). Pending Finance verification.`;
            } else if (newStatus === 'Approved') {
                empTitle = '🎉 Tax Declaration Fully Approved!';
                empMessage = `Your Tax Declaration for Section ${decl.section} (₹${decl.amount}) for FY ${decl.financial_year} is fully approved and locked into your tax calculation.`;
            }

            if (decl.user_id) {
                await notificationService.create({
                    user_id: decl.user_id,
                    title: empTitle,
                    message: empMessage,
                    type: 'TAX_DECLARATION',
                    related_module: 'tax_declaration',
                    related_id: decl.id
                });
            }

            // 2. Next Stage Approver Notifications
            if (newStatus === 'Pending HR Approval') {
                const hrUsers = await prisma.user.findMany({
                    where: {
                        OR: [
                            { roles: { some: { role: { role_name: { contains: 'hr' } } } } },
                            { roles: { some: { role: { role_name: { contains: 'HR' } } } } },
                            { details: { role: { role_name: { contains: 'hr' } } } },
                            { details: { role: { role_name: { contains: 'HR' } } } },
                            { roles: { some: { role: { role_name: { contains: 'admin' } } } } },
                            { details: { role: { role_name: { contains: 'admin' } } } }
                        ]
                    },
                    select: { id: true }
                });
                for (const hr of hrUsers) {
                    if (hr.id !== approverUserId && hr.id !== decl.user_id) {
                        await notificationService.create({
                            user_id: hr.id,
                            title: '📜 Tax Declaration - Pending HR Verification',
                            message: `${empName}'s Tax Declaration for Section ${decl.section} (₹${decl.amount}) was approved by Manager. Pending HR verification.`,
                            type: 'TAX_DECLARATION',
                            related_module: 'tax_declaration',
                            related_id: decl.id
                        });
                    }
                }
            } else if (newStatus === 'Pending Finance Approval') {
                let financeUsers = await prisma.user.findMany({
                    where: {
                        OR: [
                            { roles: { some: { role: { role_name: { contains: 'finance' } } } } },
                            { roles: { some: { role: { role_name: { contains: 'Finance' } } } } },
                            { roles: { some: { role: { role_name: { contains: 'payroll' } } } } },
                            { roles: { some: { role: { role_name: { contains: 'Payroll' } } } } },
                            { roles: { some: { role: { role_name: { contains: 'account' } } } } },
                            { roles: { some: { role: { role_name: { contains: 'Account' } } } } },
                            { roles: { some: { role: { role_name: { contains: 'admin' } } } } },
                            { roles: { some: { role: { role_name: { contains: 'Admin' } } } } },
                            { details: { role: { role_name: { contains: 'finance' } } } },
                            { details: { role: { role_name: { contains: 'Finance' } } } },
                            { details: { role: { role_name: { contains: 'payroll' } } } },
                            { details: { role: { role_name: { contains: 'Payroll' } } } },
                            { details: { role: { role_name: { contains: 'account' } } } },
                            { details: { role: { role_name: { contains: 'Account' } } } },
                            { details: { role: { role_name: { contains: 'admin' } } } },
                            { details: { role: { role_name: { contains: 'Admin' } } } }
                        ]
                    },
                    select: { id: true }
                });

                if (!financeUsers || financeUsers.length === 0) {
                    financeUsers = await prisma.user.findMany({
                        select: { id: true }
                    });
                }

                for (const fin of financeUsers) {
                    if (fin.id !== approverUserId && fin.id !== decl.user_id) {
                        await notificationService.create({
                            user_id: fin.id,
                            title: '💰 Tax Declaration - Pending Finance Approval',
                            message: `${empName}'s Tax Declaration for Section ${decl.section} (₹${decl.amount}) was verified by HR. Pending Finance verification.`,
                            type: 'TAX_DECLARATION',
                            related_module: 'tax_declaration',
                            related_id: decl.id
                        });
                    }
                }
            } else if (newStatus === 'Approved') {
                await notificationService.create({
                    user_id: decl.user_id,
                    title: 'Tax Declaration Approved! 🎉',
                    message: `Your Tax Declaration (${decl.section} - ₹${decl.amount}) for FY ${decl.financial_year} has been approved by Finance and locked into the tax engine.`,
                    type: 'TAX_DECLARATION',
                    related_module: 'tax_declaration',
                    related_id: decl.id
                });
            }
        } catch (e) {
            console.error('Notification error in approveTaxDeclaration:', e);
        }

        return updated;
    }

    async rejectTaxDeclaration(id: number, approverUserId: number, approverRole: string, orgId: number, remarks?: string) {
        const decl = await prisma.taxDeclaration.findUnique({
            where: { id },
            include: { user: true }
        });
        if (!decl) throw new AppError('Tax declaration not found', 404);

        const updated = await prisma.taxDeclaration.update({
            where: { id },
            data: {
                status: 'Rejected',
                remarks: remarks ? `${decl.remarks ? decl.remarks + ' | ' : ''}Rejected by ${approverRole}: ${remarks}` : 'Rejected'
            }
        });

        try {
            await notificationService.create({
                user_id: decl.user_id,
                title: 'Tax Declaration Rejected',
                message: `Your Tax Declaration (${decl.section} - ₹${decl.amount}) was rejected by ${approverRole}. Reason: ${remarks || 'No remarks provided.'}`,
                type: 'TAX_DECLARATION',
                related_module: 'tax_declaration',
                related_id: decl.id
            });
        } catch (e) {
            console.error('Notification error in rejectTaxDeclaration:', e);
        }

        return updated;
    }

    async getPendingTaxDeclarations(userId: number, role: string, orgId: number) {
        const userRole = (role || '').toUpperCase();

        // Admin, Super Admin, Finance, HR
        if (userRole.includes('ADMIN') || userRole.includes('SUPER') || userRole.includes('FINANCE') || userRole.includes('HR') || userRole.includes('HUMAN')) {
            const statusFilter = userRole.includes('FINANCE')
                ? { status: { in: ['Pending Finance Approval', 'Pending HR Approval', 'Pending Manager Approval', 'Pending', 'REJECTED'] } }
                : userRole.includes('HR')
                    ? { status: { in: ['Pending HR Approval', 'Pending Manager Approval', 'Pending', 'REJECTED'] } }
                    : {}; // Admin/Super sees all

            return await prisma.taxDeclaration.findMany({
                where: {
                    ...statusFilter,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            details: {
                                select: {
                                    first_name: true,
                                    last_name: true,
                                    department: { select: { department_name: true } }
                                }
                            }
                        }
                    }
                },
                orderBy: { submitted_on: 'desc' }
            });
        }

        // Manager
        if (userRole.includes('MANAGER')) {
            const directReports = await prisma.userDetail.findMany({
                where: { reporting_manager_id: userId },
                select: { user_id: true }
            });
            const reporteeUserIds = directReports.map(d => d.user_id);
            reporteeUserIds.push(userId); // Include manager's own declarations as well

            return await prisma.taxDeclaration.findMany({
                where: {
                    user_id: { in: reporteeUserIds },
                    status: { in: ['Pending Manager Approval', 'Pending', 'REJECTED'] }
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            details: {
                                select: {
                                    first_name: true,
                                    last_name: true,
                                    department: { select: { department_name: true } }
                                }
                            }
                        }
                    }
                },
                orderBy: { submitted_on: 'desc' }
            });
        }

        // Regular Employee: Return their own declarations
        return await prisma.taxDeclaration.findMany({
            where: { user_id: userId },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        details: {
                            select: {
                                first_name: true,
                                last_name: true,
                                department: { select: { department_name: true } }
                            }
                        }
                    }
                }
            },
            orderBy: { submitted_on: 'desc' }
        });
    }

    async deleteDeclaration(id: number, userId: number, orgId: number) {
        return await prisma.taxDeclaration.delete({
            where: { id, user_id: userId, organization_id: orgId }
        });
    }

    async getMyClaims(userId: number, orgId: number | null) {
        return await prisma.expenseClaim.findMany({
            where: { user_id: userId, ...(orgId ? { organization_id: orgId } : {}) },
            orderBy: { submitted_on: 'desc' }
        });
    }

    async submitClaim(userId: number, orgId: number, data: any) {
        // ─── VALIDATION: Check reimbursement type period limit ───
        const reimbType = await prisma.reimbursementType.findFirst({
            where: {
                type: data.type,
                status: true,
                ...(orgId ? { organization_id: orgId } : {})
            }
        });
        if (reimbType) {
            const typeLimit = Number(reimbType.limit);
            const period = (reimbType.period || 'Monthly').toLowerCase();
            const now = new Date();
            let startDate: Date;

            if (period === 'monthly') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            } else if (period === 'yearly' || period === 'annual') {
                const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
                startDate = new Date(fyStartYear, 3, 1);
            } else {
                startDate = new Date(0);
            }

            if (period !== 'per claim') {
                const existingClaims = await prisma.expenseClaim.findMany({
                    where: {
                        user_id: userId,
                        type: data.type,
                        expense_date: { gte: startDate },
                        status: { notIn: ['rejected', 'Cancelled'] }
                    }
                });
                const totalClaimed = existingClaims.reduce((sum, c) => sum + Number(c.amount), 0);
                const newAmount = Number(data.amount);
                if (totalClaimed + newAmount > typeLimit) {
                    throw new AppError(
                        `Claim amount of ₹${newAmount.toLocaleString()} exceeds the ${period} limit of ₹${typeLimit.toLocaleString()} for "${reimbType.label}". ` +
                        `You have already claimed ₹${totalClaimed.toLocaleString()} this ${period}. ` +
                        `Remaining: ₹${Math.max(0, typeLimit - totalClaimed).toLocaleString()}.`,
                        400
                    );
                }
            }
        }

        const claim = await prisma.expenseClaim.create({
            data: {
                user_id: userId,
                organization_id: orgId,
                type: data.type,
                amount: data.amount,
                description: data.description,
                expense_date: new Date(data.date),
                proof_url: data.proofUrl,
                status: 'Submitted'
            }
        });

        // Stage 1 Workflow Notification: Notify Reporting Manager at submission stage (or Admins if no manager assigned)
        try {
            const userDetail2 = await prisma.userDetail.findUnique({
                where: { user_id: userId },
                select: { first_name: true, last_name: true, reporting_manager_id: true }
            });
            const empName = userDetail2 ? `${userDetail2.first_name || ''} ${userDetail2.last_name || ''}`.trim() : 'An employee';

            const recipientIds = new Set<number>();

            // 1. Add reporting manager
            if (userDetail2?.reporting_manager_id) {
                recipientIds.add(userDetail2.reporting_manager_id);
            }

            // 2. If no reporting manager assigned, fallback to admins so the claim isn't stuck
            if (recipientIds.size === 0) {
                const adminUsers = await prisma.user.findMany({
                    where: {
                        OR: [
                            { roles: { some: { role: { role_name: { in: ['super admin', 'SUPER ADMIN', 'CEO', 'ceo', 'admin', 'ADMIN', 'MANAGER', 'manager'] } } } } },
                            { details: { role: { role_name: { in: ['super admin', 'SUPER ADMIN', 'CEO', 'ceo', 'admin', 'ADMIN', 'MANAGER', 'manager'] } } } }
                        ]
                    },
                    select: { id: true }
                });
                for (const u of adminUsers) recipientIds.add(u.id);
            }

            // Remove submitting employee
            recipientIds.delete(userId);

            console.log(`[submitClaim] Sending notifications to ${recipientIds.size} recipients for claim ${claim.id}`);

            for (const targetUserId of recipientIds) {
                await notificationService.create({
                    user_id: targetUserId,
                    title: '🧾 New Expense Claim Submitted',
                    message: `${empName} submitted a reimbursement claim for ${data.type} (₹${Number(data.amount).toLocaleString()}). Please review and approve.`,
                    type: 'REIMBURSEMENT',
                    related_module: 'reimbursement',
                    related_id: claim.id,
                    metadata: { claimId: claim.id, amount: data.amount, type: data.type }
                });
            }
        } catch (e) {
            console.error('[submitClaim] Notification error:', e);
        }

        return claim;
    }

    async deleteClaim(id: number, userId: number, orgId: number) {
        return await prisma.expenseClaim.delete({
            where: { id, user_id: userId, organization_id: orgId }
        });
    }

    async checkReimbursementEligibility(userId: number, orgId: number, type: string, amount: number) {
        const errors: string[] = [];

        // Check active loan/advance blocking
        const userDetail = await prisma.userDetail.findUnique({
            where: { user_id: userId },
            select: { id: true }
        });
        let hasActiveLoan = false;
        let outstandingBalance = 0;
        if (userDetail) {
            const activeLoan = await prisma.loan.findFirst({
                where: { userDetailId: userDetail.id, isActive: true, status: 'APPROVED', outstandingBalance: { gt: 0 } }
            });
            const activeAdvance = await prisma.advance.findFirst({
                where: { userDetailId: userDetail.id, isActive: true, status: 'APPROVED', outstandingBalance: { gt: 0 } }
            });
            if (activeLoan || activeAdvance) {
                hasActiveLoan = true;
                outstandingBalance = Number(activeLoan?.outstandingBalance || 0) + Number(activeAdvance?.outstandingBalance || 0);
                errors.push(`Active loan/advance with outstanding balance of ₹${outstandingBalance.toLocaleString()}. Reimbursements are blocked until EMI completion.`);
            }
        }

        // Check reimbursement type period limit
        let limit = 0;
        let used = 0;
        let remaining = 0;
        if (type) {
            const reimbType = await prisma.reimbursementType.findFirst({
                where: { type, status: true, ...(orgId ? { organization_id: orgId } : {}) }
            });
            if (reimbType) {
                limit = Number(reimbType.limit);
                const period = (reimbType.period || 'Monthly').toLowerCase();
                const now = new Date();
                let startDate: Date;
                if (period === 'monthly') {
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                } else if (period === 'yearly' || period === 'annual') {
                    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
                    startDate = new Date(fyStartYear, 3, 1);
                } else {
                    startDate = new Date(0);
                }
                if (period !== 'per claim') {
                    const existingClaims = await prisma.expenseClaim.findMany({
                        where: { user_id: userId, type, expense_date: { gte: startDate }, status: { notIn: ['rejected', 'Cancelled'] } }
                    });
                    used = existingClaims.reduce((sum, c) => sum + Number(c.amount), 0);
                    remaining = Math.max(0, limit - used);
                    if (amount > 0 && used + amount > limit) {
                        errors.push(`Claim amount of ₹${amount.toLocaleString()} exceeds the ${period} limit of ₹${limit.toLocaleString()} for "${reimbType.label}". Already claimed: ₹${used.toLocaleString()}. Remaining: ₹${remaining.toLocaleString()}.`);
                    }
                }
            }
        }

        return { eligible: errors.length === 0, errors, hasActiveLoan, outstandingBalance, limit, used, remaining };
    }

    // ─── Employee Portal Context (compensation-driven) ───────────────────────
    async getEmployeePortalData(userId: number, orgId: number | null) {
        // 1. Get employee details with payroll group → salary structure → components
        const userDetail = await prisma.userDetail.findUnique({
            where: { user_id: userId },
            include: {
                loans: { where: { isActive: true } },
                advances: { where: { isActive: true } },
                role: true,
                department: true,
                payroll_group: {
                    include: {
                        salary_structure: {
                            include: {
                                components: {
                                    include: { salary_component: true },
                                    orderBy: { order: 'asc' }
                                }
                            }
                        },
                        reimbursement_types: {
                            where: { status: true }
                        }
                    }
                }
            }
        });

        // 2. Get org-level tax sections (only if we have an orgId)
        const taxSections = orgId ? await prisma.taxSection.findMany({
            where: { status: true, organization_id: orgId },
            orderBy: { section: 'asc' }
        }) : [];

        const baseSalary = userDetail?.base_salary ? Number(userDetail.base_salary) : 0;

        const earnings: { label: string; value: number }[] = [];
        const deductions: { label: string; value: number }[] = [];
        let totalDeductions = 0;
        let grossSalary = 0;

        // 3a. PRIMARY: Use per-employee compensation_breakdown if available (set by admin on employee profile)
        //
        //     Formula: CTC = Gross + Employer Contributions
        //              Net  = Gross - Employee Deductions
        //
        //     The compensation_breakdown already sums to CTC. Items like PF and PT
        //     within the breakdown are Employer Contributions (already inside CTC),
        //     NOT additional deductions from the employee's take-home pay.
        //     Therefore: all breakdown items → earnings, and Net = Gross.
        //     Employee-side deductions (if any) come from a separate source.
        const rawBreakdown = userDetail?.compensation_breakdown;
        const breakdownArray: any[] = Array.isArray(rawBreakdown)
            ? rawBreakdown
            : (typeof rawBreakdown === 'string'
                ? (() => { try { return JSON.parse(rawBreakdown); } catch { return []; } })()
                : []);

        // Employer-contribution labels to exclude from gross earnings display
        // (they are part of CTC cost structure, not paid directly to employee)
        const EMPLOYER_CONTRIBUTION_KEYWORDS = ['pf', 'provident fund', 'professional tax', 'pt', 'esi', 'tds', 'income tax', 'lwf', 'gratuit'];

        const isEmployerContribution = (name: string): boolean => {
            const lower = name.toLowerCase();
            return EMPLOYER_CONTRIBUTION_KEYWORDS.some(kw => lower.includes(kw));
        };

        const structureComponents = userDetail?.payroll_group?.salary_structure?.components || [];

        let realDeductions = 0;

        if (breakdownArray.length > 0) {
            // All breakdown items together = CTC.
            // Employer contributions (PF, PT etc.) are shown separately as deductions in payslip
            // but they are NOT additional charges — they come out of the CTC allocation.
            for (const item of breakdownArray) {
                const label: string = item.componentType || item.name || 'Unknown';
                const value: number = Math.round(parseFloat(item.amount) || 0);
                if (value === 0) continue;

                if (isEmployerContribution(label)) {
                    // These are employer contributions inside CTC — show in deductions
                    // for payslip clarity but Net = Gross (no double counting)
                    deductions.push({ label, value });
                    totalDeductions += value;
                } else if (label === "Outstanding Loan Recovery" || label === "Salary Advance Recovery") {
                    // Ignore the static full-amount records from compensation breakdown.
                    continue;
                } else {
                    earnings.push({ label, value });
                    grossSalary += value;
                }
            }
        } else {
            // 3b. FALLBACK: compute from salary structure components if no per-employee breakdown exists
            for (const sc of structureComponents) {
                const comp = sc.salary_component;
                const value = comp.calculation_type === 'percentage'
                    ? Math.round((baseSalary * Number(comp.value)) / 100)
                    : Number(comp.value);

                if (comp.type === 'earning') {
                    earnings.push({ label: comp.name, value });
                    grossSalary += value;
                } else {
                    deductions.push({ label: comp.name, value });
                    totalDeductions += value;
                }
            }
        }

        // Compute dynamic loan and advance recovery (only DISBURSED or legacy APPROVED)
        const activeLoan = userDetail?.loans?.find((l: any) => l.outstandingBalance > 0 && (l.status === 'DISBURSED' || l.status === 'APPROVED'));
        if (activeLoan && Number(activeLoan.outstandingBalance) > 0) {
            const recovery = Math.min(Number(activeLoan.monthlyRecovery), Number(activeLoan.outstandingBalance));
            if (recovery > 0) {
                deductions.push({ label: "Outstanding Loan Recovery", value: recovery });
                totalDeductions += recovery;
                realDeductions += recovery;
            }
        }

        const activeAdvance = userDetail?.advances?.find((a: any) => a.outstandingBalance > 0 && (a.status === 'DISBURSED' || a.status === 'APPROVED'));
        if (activeAdvance && Number(activeAdvance.outstandingBalance) > 0) {
            const recovery = Math.min(Number(activeAdvance.monthlyRecovery), Number(activeAdvance.outstandingBalance));
            if (recovery > 0) {
                deductions.push({ label: "Salary Advance Recovery", value: recovery });
                totalDeductions += recovery;
                realDeductions += recovery;
            }
        }

        // 4. Reimbursement types eligible for this employee based on payroll group
        const reimbursementTypes = (userDetail?.payroll_group?.reimbursement_types || []).map((r: any) => ({
            id: r.id,
            type: r.type,
            label: r.label,
            limit: Number(r.limit),
            period: r.period
        }));

        // 5. Approved Reimbursements integrated with Payroll
        const approvedReimbursements = await prisma.expenseClaim.findMany({
            where: {
                user_id: userId,
                status: 'approved',
                payment_status: 'Ready To Pay',
                payment_mode: 'Salary Payroll'
            }
        });
        const reimbursementTotal = approvedReimbursements.reduce((sum, claim) => sum + Number(claim.amount), 0);
        if (reimbursementTotal > 0) {
            earnings.push({ label: 'Reimbursement', value: reimbursementTotal });
            grossSalary += reimbursementTotal;
        }

        const netSalary = Math.max(0, grossSalary - realDeductions);

        return {
            userDetailId: userDetail?.id,
            baseSalary,
            payrollGroup: userDetail?.payroll_group
                ? { id: userDetail.payroll_group.id, name: userDetail.payroll_group.name }
                : null,
            salaryStructure: userDetail?.payroll_group?.salary_structure
                ? { id: userDetail.payroll_group.salary_structure.id, name: userDetail.payroll_group.salary_structure.name }
                : null,
            computedPayslip: {
                grossSalary,
                netSalary,
                totalDeductions,
                earnings,
                deductions
            },
            taxSections: taxSections.map((ts: any) => ({
                key: ts.section,
                label: ts.label,
                limit: Number(ts.limit),
                instruments: Array.isArray(ts.instruments) ? ts.instruments : []
            })),
            reimbursementTypes,
            activeLoans: userDetail?.loans || [],
            activeAdvances: userDetail?.advances || [],
            employeeDetails: userDetail
        };
    }

    // ─── Payroll Calculation Engine ───────────────────────────────────────────
    async calculatePayrollEngine(data: {
        employeeId: number;
        month: number;
        year: number;
        workingDays: number;
        lopDays: number;
        overtimeHours: number;
        arrearsAmount?: number;
        bonusAmount?: number;
    }) {
        const { employeeId, workingDays, lopDays: manualLopDays, overtimeHours, arrearsAmount = 0, bonusAmount = 0 } = data;
        
        // 1. Fetch Employee Details, Structure, and Declarations
        const employee = await prisma.user.findUnique({
            where: { id: employeeId },
            include: {
                details: {
                    include: {
                        loans: { where: { isActive: true } },
                        advances: { where: { isActive: true } },
                        payroll_group: {
                            include: {
                                salary_structure: {
                                    include: {
                                        components: {
                                            include: { salary_component: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                taxDeclarations: {
                    where: { status: 'approved' }
                }
            }
        });

        if (!employee) throw new AppError("Employee not found", 404);

        const apiDetails = employee.details;
        const structure = apiDetails?.payroll_group?.salary_structure;
        
        // Auto-calculate LOP from approved unpaid leaves for the payroll month
        const { month, year } = data;
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59);
        let autoLopDays = 0;
        try {
            const unpaidLeaves = await prisma.leaveRequest.findMany({
                where: {
                    user_id: employeeId,
                    status: 'APPROVED',
                    start_date: { lte: monthEnd },
                    end_date: { gte: monthStart },
                },
                include: { leave_policy: true }
            });
            for (const leave of unpaidLeaves) {
                const isUnpaid = (leave.leave_policy as any)?.leave_category === 'unpaid';
                if (isUnpaid) {
                    autoLopDays += leave.duration;
                }
            }
        } catch { /* fall back to manual LOP */ }
        const lopDays = autoLopDays > 0 ? autoLopDays : manualLopDays;
        
        const monthlyReference = apiDetails?.base_salary 
            ? parseFloat(apiDetails.base_salary as any) 
            : 0;

        let earnings: Record<string, number> = {};
        let deductions: Record<string, number> = {};
        let grossSalary = 0;

        // Parse Compensation Breakdown
        if (apiDetails?.compensation_breakdown) {
            try {
                const breakdown = typeof apiDetails.compensation_breakdown === 'string' 
                    ? JSON.parse(apiDetails.compensation_breakdown) 
                    : apiDetails.compensation_breakdown;
                
                breakdown.forEach((comp: any) => {
                    const name = comp.componentType || comp.name;
                    const amount = parseFloat(comp.amount || comp.value || 0);
                    
                    const isDeduction = comp.type === 'deduction' || 
                                        ['PF - Employee', 'Professional Tax', 'Income Tax (TDS)', 'TDS', 'EPF', 'ESI', 'Employee EPF (12%)', 'Employee ESI (0.75%)'].includes(name);
                    
                    if (!isDeduction && comp.type !== 'deduction') {
                        earnings[name] = amount;
                        grossSalary += amount;
                    } else {
                        if (name === "Outstanding Loan Recovery" || name === "Salary Advance Recovery") return;
                        deductions[name] = amount;
                    }
                });
            } catch (e) {
                console.error("Failed to parse compensation_breakdown", e);
            }
        } 


        if (Object.keys(earnings).length === 0 && structure) {
            structure.components.forEach(sc => {
                const comp = sc.salary_component;
                if (comp.type === 'earning') {
                    const amount = comp.calculation_type === 'percentage' 
                        ? (monthlyReference * Number(comp.value)) / 100 
                        : Number(comp.value);
                    earnings[comp.name] = amount;
                    grossSalary += amount;
                }
            });
        }

        // 2. LOP Deduction
        const defaultWorkingDays = await getSetting('DEFAULT_WORKING_DAYS', 26);
        const effectiveWorkingDays = workingDays || defaultWorkingDays;
        const dailyRate = grossSalary / effectiveWorkingDays;
        const lopDeductionAmount = Math.round(dailyRate * lopDays);
        const proratedGross = grossSalary - lopDeductionAmount;

        // 3. Overtime, Arrears, and Bonus
        const hoursPerDay = await getSetting('HOURS_PER_WORKING_DAY', 8);
        const overtimeMultiplier = await getSetting('OVERTIME_MULTIPLIER', 1.5);
        const hourlyRate = dailyRate / hoursPerDay;
        const otAmount = Math.round(overtimeHours * hourlyRate * overtimeMultiplier);
        if (otAmount > 0) {
            earnings['Overtime'] = otAmount;
        }
        if (arrearsAmount > 0) {
            earnings['Arrears'] = arrearsAmount;
        }
        if (bonusAmount > 0) {
            earnings['Bonus'] = bonusAmount;
        }

        const totalActualGross = proratedGross + otAmount + arrearsAmount + bonusAmount;

        // 4. Statutory & Tax Calculations (Routed through PayrollEngineFactory based on employee's country)
        const country = apiDetails?.country || '';
        const engine = PayrollEngineFactory.getEngine(country);

        const engineInput = {
            employeeId,
            baseSalary: monthlyReference,
            actualGross: totalActualGross,
            lopDays,
            workingDays,
            lopDeductionAmount,
            earnings,
            deductions,
            apiDetails
        };

        const engineResult = await engine.calculate(engineInput);

        const finalDeductions = { ...engineResult.deductions };
        let totalDeductions = Object.values(finalDeductions).reduce((a, b) => a + b, 0);

        // 5. Loan and Advance Recoveries (only DISBURSED or legacy APPROVED)
        employee.details?.loans?.forEach((loan: any) => {
            if (loan.outstandingBalance > 0 && (loan.status === 'DISBURSED' || loan.status === 'APPROVED')) {
                const recovery = Math.min(Number(loan.monthlyRecovery), Number(loan.outstandingBalance));
                if (recovery > 0) {
                    finalDeductions['Loan Recovery'] = (finalDeductions['Loan Recovery'] || 0) + recovery;
                    totalDeductions += recovery;
                }
            }
        });

        employee.details?.advances?.forEach((advance: any) => {
            if (advance.outstandingBalance > 0 && (advance.status === 'DISBURSED' || advance.status === 'APPROVED')) {
                const recovery = Math.min(Number(advance.monthlyRecovery), Number(advance.outstandingBalance));
                if (recovery > 0) {
                    finalDeductions['Advance Recovery'] = (finalDeductions['Advance Recovery'] || 0) + recovery;
                    totalDeductions += recovery;
                }
            }
        });

        // 6. Loss of Pay (LOP) display in deductions (without double-deduction)
        if (lopDeductionAmount > 0) {
            finalDeductions['Loss of Pay'] = lopDeductionAmount;
            // Note: We do NOT add lopDeductionAmount to totalDeductions because it has already
            // reduced the gross salary (proratedGross) and totalActualGross!
        }

        // 7. Approved Reimbursements (Salary Payroll mode)
        const approvedReimbursements = await prisma.expenseClaim.findMany({
            where: {
                user_id: employeeId,
                status: 'approved',
                payment_status: 'Ready To Pay',
                payment_mode: 'Salary Payroll'
            }
        });
        const reimbursementTotal = approvedReimbursements.reduce((sum, claim) => sum + Number(claim.amount), 0);
        if (reimbursementTotal > 0) {
            earnings['Reimbursement'] = reimbursementTotal;
        }

        const netPay = Math.max(0, totalActualGross + reimbursementTotal - totalDeductions);

        return {
            grossSalary: totalActualGross + reimbursementTotal,
            totalDeductions,
            netPay,
            earnings: Object.keys(earnings).map(k => ({ label: k, value: earnings[k] })),
            deductions: Object.keys(finalDeductions).map(k => ({ label: k, value: finalDeductions[k] })),
            lopDeductionAmount,
            taxInfo: engineResult.taxInfo
        };
    }

    // ─── Form 12B (Prior Employment) ──────────────────────────────────────
    async submitForm12B(userId: number, data: any) {
        const record = await prisma.priorEmploymentIncome.create({
            data: {
                user_id: userId,
                financial_year: data.financialYear || '2025-26',
                gross_income: Number(data.grossSalary || 0),
                tds_deducted: Number(data.tdsDeducted || 0),
                pf_deducted: Number(data.pfDeducted || 0),
                pt_deducted: Number(data.ptDeducted || 0)
            }
        });

        // Notify HR, Finance, and Admins
        try {
            const userDetail = await prisma.userDetail.findUnique({
                where: { user_id: userId },
                select: { first_name: true, last_name: true }
            });
            const empName = userDetail ? `${userDetail.first_name || ''} ${userDetail.last_name || ''}`.trim() : 'An employee';

            const recipientIds = new Set<number>();
            const adminUsers = await prisma.user.findMany({
                where: {
                    OR: [
                        { roles: { some: { role: { role_name: { in: ['super admin', 'SUPER ADMIN', 'CEO', 'ceo', 'admin', 'ADMIN', 'HR', 'hr', 'finance', 'FINANCE'] } } } } },
                        { details: { role: { role_name: { in: ['super admin', 'SUPER ADMIN', 'CEO', 'ceo', 'admin', 'ADMIN', 'HR', 'hr', 'finance', 'FINANCE'] } } } }
                    ]
                },
                select: { id: true }
            });
            for (const u of adminUsers) {
                recipientIds.add(u.id);
            }
            recipientIds.delete(userId);

            for (const targetId of recipientIds) {
                await notificationService.create({
                    user_id: targetId,
                    title: '📜 New Form 12B Submitted',
                    message: `${empName} submitted Form 12B (Prior Employment Income) with a gross salary of ₹${Number(data.grossSalary || 0).toLocaleString()} for FY ${data.financialYear || '2025-26'}.`,
                    type: 'TAX_DECLARATION',
                    related_module: 'tax_declaration',
                    related_id: record.id
                });
            }
        } catch (e) {
            console.error('Notification error in submitForm12B:', e);
        }

        return record;
    }

    // ─── Tax Regime ────────────────────────────────────────────────────────
    async updateTaxRegime(userId: number, regime: string) {
        const normalized = regime.charAt(0).toUpperCase() + regime.slice(1).toLowerCase();
        if (!['Old', 'New'].includes(normalized)) {
            throw new AppError('Invalid tax regime. Must be "Old" or "New".', 400);
        }

        const now = new Date();
        const currentFyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        const fyStartDate = new Date(currentFyStartYear, 3, 1);

        const existing = await prisma.userDetail.findUnique({
            where: { user_id: userId },
            select: { tax_regime_changed_at: true }
        });

        if (existing?.tax_regime_changed_at) {
            const changedAt = new Date(existing.tax_regime_changed_at);
            if (changedAt >= fyStartDate) {
                throw new AppError('You can only change your tax regime once per financial year. Try again next FY.', 400);
            }
        }

        return await prisma.userDetail.update({
            where: { user_id: userId },
            data: { tax_regime: normalized, tax_regime_changed_at: now }
        });
    }

    // ─── System Settings ───────────────────────────────────────────────────
    async getSystemSettings() {
        return await prisma.systemSetting.findMany();
    }

    async saveSystemSettings(settings: any[]) {
        if (!Array.isArray(settings)) return;
        for (const item of settings) {
            await prisma.systemSetting.upsert({
                where: { key: item.key },
                update: { value: String(item.value) },
                create: { key: item.key, value: String(item.value) }
            });
        }
    }

    // ─── Transactional Loan/Advance Recovery ───────────────────────────────
    async recoverLoanAndAdvance(userId: number, loanRecovery: number, advanceRecovery: number) {
        const { LoansAdvancesService } = await import('../loans-advances/loans-advances.service');
        const loansAdvancesService = new LoansAdvancesService();
        return loansAdvancesService.recoverLoanAndAdvance(userId, loanRecovery, advanceRecovery);
    }

    // ─── Reimbursement Payments Integration ───────────────────────────────
    async getReadyToPayReimbursements(orgId?: number) {
        return await prisma.expenseClaim.findMany({
            where: {
                status: { in: ['approved', 'waiting_payout'] },
                ...(orgId ? { organization_id: orgId } : {})
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        details: {
                            select: {
                                first_name: true,
                                last_name: true
                            }
                        }
                    }
                }
            },
            orderBy: { submitted_on: 'desc' }
        });
    }

    async updateReimbursementPaymentMode(id: number, paymentMode: string) {
        // When mode is "Salary Payroll", set payment_status to "Ready To Pay"
        // so the payroll calculation engine can pick it up
        const updateData: any = { payment_mode: paymentMode };
        if (paymentMode === 'Salary Payroll') {
            updateData.payment_status = 'Ready To Pay';
        }
        return await prisma.expenseClaim.update({
            where: { id },
            data: updateData
        });
    }

    async processReimbursementPayment(id: number, data: { payment_reference: string; payment_date: string; payment_mode?: string }, actorId?: number) {
        const updatedClaim = await prisma.expenseClaim.update({
            where: { id },
            data: {
                status: 'Paid',
                payment_status: 'Paid',
                payment_mode: data.payment_mode || 'Bank Transfer',
                payment_reference: data.payment_reference,
                payment_date: new Date(data.payment_date),
                paid_by: actorId || null
            }
        });

        try {
            if (updatedClaim.user_id) {
                await notificationService.create({
                    user_id: updatedClaim.user_id,
                    title: '💸 Reimbursement Paid! 🎉',
                    message: `Your reimbursement claim for ${updatedClaim.type} (₹${Number(updatedClaim.amount).toLocaleString()}) has been paid via ${updatedClaim.payment_mode}. Ref: ${updatedClaim.payment_reference || 'N/A'}`,
                    type: 'REIMBURSEMENT',
                    related_module: 'reimbursement',
                    related_id: updatedClaim.id,
                    metadata: { claimId: updatedClaim.id, status: 'Paid', ref: updatedClaim.payment_reference }
                });
            }
        } catch (e) {
            console.error('Notification error in processReimbursementPayment:', e);
        }

        return updatedClaim;
    }

    // ─── Admin Claim Management ──────────────────────────────────────────
    async getAllClaims(orgId?: number) {
        return await prisma.expenseClaim.findMany({
            where: {
                ...(orgId ? { organization_id: orgId } : {})
            },
            include: {
                user: {
                    include: {
                        details: {
                            include: {
                                department: true,
                                designation: true,
                                role: true,
                                payroll_group: true,
                                user_types: true,
                                team: true
                            }
                        }
                    }
                }
            },
            orderBy: { submitted_on: 'desc' }
        });
    }

    async updateClaimStatus(id: number, status: string, remarks?: string, actorId?: number) {
        const updatedClaim = await prisma.expenseClaim.update({
            where: { id },
            data: {
                status,
                remarks: remarks || null,
                updated_at: new Date()
            }
        });

        try {
            const empDetail = await prisma.userDetail.findUnique({
                where: { user_id: updatedClaim.user_id },
                select: { first_name: true, last_name: true }
            });
            const empName = empDetail ? `${empDetail.first_name || ''} ${empDetail.last_name || ''}`.trim() : 'Employee';
            const sLower = status.toLowerCase();

            // 1. Employee Notification (Updates employee on status progress)
            let empTitle = `Reimbursement Status: ${status}`;
            let empMessage = `Your reimbursement claim for ${updatedClaim.type} (₹${Number(updatedClaim.amount).toLocaleString()}) is now ${status}.`;

            if (sLower.includes('hr approval') || sLower.includes('pending_hr')) {
                empTitle = '✅ Claim Approved by Manager';
                empMessage = `Your manager approved your reimbursement claim for ${updatedClaim.type} (₹${Number(updatedClaim.amount).toLocaleString()}). Pending HR review.`;
            } else if (sLower.includes('finance approval') || sLower.includes('pending_finance') || sLower.includes('waiting_payout')) {
                empTitle = '✅ Claim Verified by HR';
                empMessage = `HR verified your reimbursement claim for ${updatedClaim.type} (₹${Number(updatedClaim.amount).toLocaleString()}). Pending Finance payout.`;
            } else if (sLower === 'approved') {
                empTitle = '🎉 Claim Fully Approved!';
                empMessage = `Your reimbursement claim for ${updatedClaim.type} (₹${Number(updatedClaim.amount).toLocaleString()}) has been fully approved.`;
            } else if (sLower.includes('reject')) {
                empTitle = '❌ Claim Rejected';
                empMessage = `Your reimbursement claim for ${updatedClaim.type} (₹${Number(updatedClaim.amount).toLocaleString()}) was rejected. ${remarks ? `Remarks: ${remarks}` : ''}`;
            }

            if (updatedClaim.user_id) {
                await notificationService.create({
                    user_id: updatedClaim.user_id,
                    title: empTitle,
                    message: empMessage,
                    type: 'REIMBURSEMENT',
                    related_module: 'reimbursement',
                    related_id: updatedClaim.id,
                    metadata: { claimId: updatedClaim.id, status, remarks }
                });
            }

            // 2. Next Stage Workflow Notifications
            if (sLower.includes('hr approval') || sLower.includes('pending_hr')) {
                // Manager approved -> Notify HR users to review
                const hrUsers = await prisma.user.findMany({
                    where: {
                        OR: [
                            { roles: { some: { role: { role_name: { contains: 'hr' } } } } },
                            { roles: { some: { role: { role_name: { contains: 'HR' } } } } },
                            { details: { role: { role_name: { contains: 'hr' } } } },
                            { details: { role: { role_name: { contains: 'HR' } } } },
                            { roles: { some: { role: { role_name: { contains: 'admin' } } } } },
                            { details: { role: { role_name: { contains: 'admin' } } } }
                        ]
                    },
                    select: { id: true }
                });
                for (const hr of hrUsers) {
                    if (hr.id !== actorId && hr.id !== updatedClaim.user_id) {
                        await notificationService.create({
                            user_id: hr.id,
                            title: '📋 Claim Pending HR Verification',
                            message: `${empName}'s reimbursement claim for ${updatedClaim.type} (₹${Number(updatedClaim.amount).toLocaleString()}) was approved by Manager. Pending HR verification.`,
                            type: 'REIMBURSEMENT',
                            related_module: 'reimbursement',
                            related_id: updatedClaim.id,
                            metadata: { claimId: updatedClaim.id, status }
                        });
                    }
                }
            } else if (sLower.includes('finance approval') || sLower.includes('pending_finance') || sLower.includes('waiting_payout') || sLower === 'approved') {
                // HR approved -> Notify Finance users to process payout
                const financeUsers = await prisma.user.findMany({
                    where: {
                        OR: [
                            { roles: { some: { role: { role_name: { contains: 'finance' } } } } },
                            { roles: { some: { role: { role_name: { contains: 'Finance' } } } } },
                            { roles: { some: { role: { role_name: { contains: 'account' } } } } },
                            { roles: { some: { role: { role_name: { contains: 'payroll' } } } } },
                            { details: { role: { role_name: { contains: 'finance' } } } },
                            { details: { role: { role_name: { contains: 'Finance' } } } },
                            { details: { role: { role_name: { contains: 'account' } } } },
                            { details: { role: { role_name: { contains: 'payroll' } } } },
                            { roles: { some: { role: { role_name: { contains: 'admin' } } } } },
                            { details: { role: { role_name: { contains: 'admin' } } } }
                        ]
                    },
                    select: { id: true }
                });
                for (const fin of financeUsers) {
                    if (fin.id !== actorId && fin.id !== updatedClaim.user_id) {
                        await notificationService.create({
                            user_id: fin.id,
                            title: '💰 Claim Ready for Finance Payout',
                            message: `${empName}'s reimbursement claim for ${updatedClaim.type} (₹${Number(updatedClaim.amount).toLocaleString()}) is approved and ready for payment processing.`,
                            type: 'REIMBURSEMENT',
                            related_module: 'reimbursement',
                            related_id: updatedClaim.id,
                            metadata: { claimId: updatedClaim.id, status }
                        });
                    }
                }
            }
        } catch (e) {
            console.error('Notification error in updateClaimStatus:', e);
        }

        return updatedClaim;
    }

    async batchUpdateClaimPaymentMode(ids: number[], paymentMode: string) {
        return await prisma.expenseClaim.updateMany({
            where: { id: { in: ids } },
            data: {
                payment_mode: paymentMode,
                ...(paymentMode === 'Salary Payroll' ? { payment_status: 'Ready To Pay' } : {})
            }
        });
    }

    async batchProcessPayment(ids: number[], paymentReference: string, paymentMode: string, actorId?: number) {
        const result = await prisma.expenseClaim.updateMany({
            where: { id: { in: ids } },
            data: {
                status: 'Paid',
                payment_status: 'Paid',
                payment_mode: paymentMode,
                payment_reference: paymentReference,
                payment_date: new Date(),
                paid_by: actorId || null
            }
        });

        try {
            const claims = await prisma.expenseClaim.findMany({
                where: { id: { in: ids } },
                select: { id: true, user_id: true, type: true, amount: true }
            });

            for (const c of claims) {
                if (c.user_id) {
                    await notificationService.create({
                        user_id: c.user_id,
                        title: '💸 Reimbursement Paid! 🎉',
                        message: `Your reimbursement claim for ${c.type} (₹${Number(c.amount).toLocaleString()}) has been processed and paid via ${paymentMode}. Ref: ${paymentReference || 'N/A'}`,
                        type: 'REIMBURSEMENT',
                        related_module: 'reimbursement',
                        related_id: c.id,
                        metadata: { claimId: c.id, status: 'Paid', ref: paymentReference }
                    });
                }
            }
        } catch (e) {
            console.error('Notification error in batchProcessPayment:', e);
        }

        return result;
    }
}
