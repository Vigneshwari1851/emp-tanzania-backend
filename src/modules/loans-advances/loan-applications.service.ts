import prisma from '../../config/prisma';
import { notificationService } from '../notifications/notification.service';

export class LoanApplicationsService {

    // ─── Applications ────────────────────────────────────────────────────

    async getAll(filters: any) {
        const where: any = {};
        if (filters.status) where.status = filters.status;
        if (filters.loanTypeId) where.loanTypeId = Number(filters.loanTypeId);
        if (filters.userId) {
            const ud = await prisma.userDetail.findUnique({ where: { user_id: Number(filters.userId) } });
            if (ud) where.userDetailId = ud.id;
        }

        return await prisma.loanApplication.findMany({
            where,
            include: {
                userDetail: { include: { user: true, department: true, designation: true } },
                loanType: true,
                approvals: { orderBy: { stepOrder: 'asc' }, include: { approver: { select: { id: true, username: true, details: { select: { first_name: true, last_name: true } } } } } },
                repaymentSchedule: { orderBy: { installmentNo: 'asc' } },
                documents: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getMine(userId: number) {
        const ud = await prisma.userDetail.findUnique({ where: { user_id: userId } });
        if (!ud) return [];

        return await prisma.loanApplication.findMany({
            where: { userDetailId: ud.id },
            include: {
                loanType: true,
                approvals: { orderBy: { stepOrder: 'asc' }, include: { approver: { select: { id: true, username: true, details: { select: { first_name: true, last_name: true } } } } } },
                repaymentSchedule: { orderBy: { installmentNo: 'asc' } },
                documents: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getById(id: number) {
        const app = await prisma.loanApplication.findUnique({
            where: { id },
            include: {
                userDetail: { include: { user: true, department: true, designation: true, reporting_manager: { select: { id: true, username: true, details: { select: { first_name: true, last_name: true } } } } } },
                loanType: { include: { eligibilityRules: true, approvalWorkflow: { orderBy: { stepOrder: 'asc' } } } },
                approvals: { orderBy: { stepOrder: 'asc' }, include: { approver: { select: { id: true, username: true, details: { select: { first_name: true, last_name: true } } } } } },
                repaymentSchedule: { orderBy: { installmentNo: 'asc' } },
                documents: true
            }
        });
        if (!app) throw new Error('Application not found');
        return app;
    }

    async create(userId: number, data: any) {
        const ud = await prisma.userDetail.findUnique({
            where: { user_id: userId },
            select: { id: true, first_name: true, last_name: true, reporting_manager_id: true, employment_type: true, start_date: true, base_salary: true, department_id: true, designation_id: true, team_id: true, work_location: true, role_id: true }
        });
        if (!ud) throw new Error('Employee profile not found');

        const loanType = await prisma.loanType.findUnique({
            where: { id: Number(data.loanTypeId) },
            include: { eligibilityRules: { where: { isActive: true } }, approvalWorkflow: { orderBy: { stepOrder: 'asc' } } }
        });
        if (!loanType) throw new Error('Loan type not found');
        if (!loanType.isActive) throw new Error('This loan type is currently inactive');

        // Check policy targeting (department, designation, branch, role)
        const targetingResult = this._checkPolicyTargeting(loanType, ud);
        if (!targetingResult.eligible) {
            throw new Error(`Not eligible: ${targetingResult.reasons.join('; ')}`);
        }

        const amount = Number(data.requestedAmount);
        if (amount < Number(loanType.minAmount)) throw new Error(`Minimum amount is ${loanType.minAmount}`);
        if (amount > Number(loanType.maxAmount)) throw new Error(`Maximum amount is ${loanType.maxAmount}`);

        const tenure = Number(data.tenure);
        if (tenure > loanType.maxTenure) throw new Error(`Maximum tenure is ${loanType.maxTenure} months`);

        // Check eligibility
        const eligibility = await this.checkEligibility(userId, loanType.id);
        if (!eligibility.eligible) {
            throw new Error(`Not eligible: ${eligibility.reasons.join('; ')}`);
        }

        // Generate application number
        const count = await prisma.loanApplication.count();
        const appNumber = `LA-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

        // Calculate EMI
        const principal = amount;
        const ratePerMonth = Number(loanType.interestRate) / 12 / 100;
        let emi: number;
        if (loanType.repaymentMethod === 'ONE_TIME') {
            emi = principal;
        } else if (ratePerMonth > 0) {
            emi = (principal * ratePerMonth * Math.pow(1 + ratePerMonth, tenure)) / (Math.pow(1 + ratePerMonth, tenure) - 1);
        } else {
            emi = principal / tenure;
        }
        emi = Math.ceil(emi);

        const totalPayable = emi * tenure;

        // Determine initial status based on workflow
        const bypass = data.bypassWorkflow === true;
        const hasWorkflow = loanType.approvalWorkflow.length > 0 && !bypass;
        const initialStatus = hasWorkflow ? 'SUBMITTED' : 'APPROVED';
        const currentStep = hasWorkflow ? 1 : 0;

        const application = await prisma.loanApplication.create({
            data: {
                applicationNumber: appNumber,
                userDetailId: ud.id,
                loanTypeId: loanType.id,
                requestedAmount: amount,
                approvedAmount: hasWorkflow ? null : amount,
                tenure,
                monthlyEmi: emi,
                interestRate: loanType.interestRate,
                totalPayable,
                outstandingBalance: hasWorkflow ? 0 : amount,
                paidAmount: 0,
                reason: data.reason || null,
                status: initialStatus,
                currentStep,
                startDate: hasWorkflow ? null : new Date(),
                endDate: hasWorkflow ? null : new Date(Date.now() + tenure * 30 * 24 * 60 * 60 * 1000)
            }
        });

        // Create approval records for each workflow step
        if (hasWorkflow) {
            const approvalData = loanType.approvalWorkflow.map(step => ({
                applicationId: application.id,
                stepOrder: step.stepOrder,
                approverId: ud.reporting_manager_id || userId, // Default to manager, will be resolved on approval
                status: step.stepOrder === 1 ? 'PENDING' : 'PENDING'
            }));
            await prisma.loanApproval.createMany({ data: approvalData });
        }

        // Generate repayment schedule if auto-approved
        if (!hasWorkflow) {
            await this.generateRepaymentSchedule(application.id, tenure, emi, Number(loanType.interestRate), principal);
        }

        // Notify approvers (Reporting Manager + Step 1 approvers / Manager role)
        const targetUserIds = new Set<number>();
        if (ud.reporting_manager_id) {
            targetUserIds.add(ud.reporting_manager_id);
        }
        if (hasWorkflow) {
            const step1 = loanType.approvalWorkflow.find(s => s.stepOrder === 1);
            if (step1) {
                const stepApprovers = await this._getUsersByRole(step1.roleName);
                stepApprovers.forEach(a => targetUserIds.add(a.id));
            }
        }
        // Fallback to manager / HR role users if no specific manager assigned
        if (targetUserIds.size === 0) {
            const defaultApprovers = await this._getUsersByRole('manager');
            defaultApprovers.forEach(a => targetUserIds.add(a.id));
        }
        targetUserIds.delete(userId);

        const empName = `${ud.first_name || ''} ${ud.last_name || ''}`.trim() || 'Employee';
        for (const targetId of targetUserIds) {
            await this._notifyUser(
                targetId,
                '💰 New Loan Application Submitted',
                `${empName} submitted a ${loanType.name} application (${appNumber} - ₹${Number(amount).toLocaleString()}). Pending review.`,
                'LOAN_APPLICATION',
                application.id
            );
        }

        return await this.getById(application.id);
    }

    async withdraw(userId: number, applicationId: number) {
        const ud = await prisma.userDetail.findUnique({ where: { user_id: userId } });
        if (!ud) throw new Error('Employee profile not found');

        const app = await prisma.loanApplication.findUnique({ where: { id: applicationId } });
        if (!app) throw new Error('Application not found');
        if (app.userDetailId !== ud.id) throw new Error('Not your application');
        if (!['DRAFT', 'SUBMITTED'].includes(app.status)) throw new Error('Cannot withdraw at this stage');

        return await prisma.loanApplication.update({
            where: { id: applicationId },
            data: { status: 'WITHDRAWN', isActive: false }
        });
    }

    // ─── Eligibility Engine ──────────────────────────────────────────────

    async checkEligibility(userId: number, loanTypeId: number) {
        const ud = await prisma.userDetail.findUnique({
            where: { user_id: userId },
            select: {
                id: true, employment_type: true, start_date: true, base_salary: true,
                department_id: true, designation_id: true, team_id: true, work_location: true,
                role_id: true
            }
        });
        if (!ud) return { eligible: false, reasons: ['Employee profile not found'] };

        const loanType = await prisma.loanType.findUnique({
            where: { id: loanTypeId },
            include: { eligibilityRules: { where: { isActive: true } } }
        });
        if (!loanType) return { eligible: false, reasons: ['Loan type not found'] };
        if (!loanType.isActive) return { eligible: false, reasons: ['Loan type is inactive'] };

        // Check policy targeting first
        const targetingResult = this._checkPolicyTargeting(loanType, ud);
        if (!targetingResult.eligible) return targetingResult;

        const rules = loanType.eligibilityRules;

        if (rules.length === 0) return { eligible: true, reasons: [] };

        const reasons: string[] = [];

        for (const rule of rules) {
            const value = rule.ruleValue;
            switch (rule.ruleType) {
                case 'employment_type': {
                    const allowed = this._parseArray(value);
                    if (allowed.length > 0 && ud.employment_type && !allowed.includes(ud.employment_type)) {
                        reasons.push(`Requires employment type: ${allowed.join(', ')}`);
                    }
                    break;
                }
                case 'min_service_months': {
                    const minMonths = Number(value);
                    if (ud.start_date && minMonths > 0) {
                        const monthsWorked = Math.floor((Date.now() - new Date(ud.start_date).getTime()) / (30 * 24 * 60 * 60 * 1000));
                        if (monthsWorked < minMonths) {
                            reasons.push(`Minimum ${minMonths} months service required (current: ${monthsWorked} months)`);
                        }
                    }
                    break;
                }
                case 'min_salary': {
                    const minSal = Number(value);
                    if (ud.base_salary && Number(ud.base_salary) < minSal) {
                        reasons.push(`Minimum salary of ${minSal} required`);
                    }
                    break;
                }
                case 'max_salary': {
                    const maxSal = Number(value);
                    if (ud.base_salary && Number(ud.base_salary) > maxSal) {
                        reasons.push(`Maximum salary of ${maxSal} exceeded`);
                    }
                    break;
                }
                case 'departments': {
                    const allowed = this._parseNumberArray(value);
                    if (allowed.length > 0 && ud.department_id && !allowed.includes(ud.department_id)) {
                        reasons.push('Not eligible for your department');
                    }
                    break;
                }
                case 'designations': {
                    const allowed = this._parseNumberArray(value);
                    if (allowed.length > 0 && ud.designation_id && !allowed.includes(ud.designation_id)) {
                        reasons.push('Not eligible for your designation');
                    }
                    break;
                }
                case 'locations': {
                    const allowed = this._parseArray(value);
                    if (allowed.length > 0 && ud.work_location && !allowed.includes(ud.work_location)) {
                        reasons.push(`Not eligible for location: ${ud.work_location}`);
                    }
                    break;
                }
                case 'max_active_loans': {
                    const maxActive = Number(value);
                    const activeCount = await prisma.loanApplication.count({
                        where: {
                            userDetailId: ud.id,
                            loanTypeId,
                            status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED', 'DISBURSED'] },
                            isActive: true
                        }
                    });
                    if (activeCount >= maxActive) {
                        reasons.push(`Maximum ${maxActive} active loan(s) of this type allowed`);
                    }
                    break;
                }
                case 'confirmation_required': {
                    if (value === 'true' && ud.start_date) {
                        const joinDate = new Date(ud.start_date);
                        const probationEnd = new Date(joinDate.getTime() + 6 * 30 * 24 * 60 * 60 * 1000);
                        if (Date.now() < probationEnd.getTime()) {
                            reasons.push('Requires confirmation after probation period');
                        }
                    }
                    break;
                }
            }
        }

        return { eligible: reasons.length === 0, reasons };
    }

    async checkEligibilityForAllTypes(userId: number) {
        const loanTypes = await prisma.loanType.findMany({
            where: { isActive: true },
            include: { eligibilityRules: { where: { isActive: true } }, department: true, designation: true, branch: true, role: true }
        });

        const results = [];
        for (const lt of loanTypes) {
            const eligibility = await this.checkEligibility(userId, lt.id);
            results.push({
                loanType: lt,
                eligible: eligibility.eligible,
                reasons: eligibility.reasons
            });
        }
        return results;
    }

    // ─── Approval Engine ─────────────────────────────────────────────────

    async approveStep(applicationId: number, approverId: number, remarks?: string) {
        const app = await prisma.loanApplication.findUnique({
            where: { id: applicationId },
            include: {
                loanType: { include: { approvalWorkflow: { orderBy: { stepOrder: 'asc' } } } },
                userDetail: { include: { user: true } }
            }
        });
        if (!app) throw new Error('Application not found');
        if (!app.status.startsWith('PENDING_STEP') && app.status !== 'SUBMITTED') {
            throw new Error('Application is not in a pending approval state');
        }

        const currentStepApproval = await prisma.loanApproval.findFirst({
            where: { applicationId, stepOrder: app.currentStep, status: 'PENDING' }
        });
        if (!currentStepApproval) throw new Error('No pending approval found for current step');

        // Update the approval record
        await prisma.loanApproval.update({
            where: { id: currentStepApproval.id },
            data: { status: 'APPROVED', remarks: remarks || null, actionAt: new Date(), approverId }
        });

        const totalSteps = app.loanType?.approvalWorkflow?.length || 1;
        const nextStep = app.currentStep + 1;
        const empDetail = app.userDetail;
        const empName = `${empDetail?.first_name || ''} ${empDetail?.last_name || ''}`.trim() || 'Employee';

        if (nextStep > totalSteps) {
            // All steps approved — final approval
            const updated = await prisma.loanApplication.update({
                where: { id: applicationId },
                data: {
                    status: 'APPROVED',
                    approvedAmount: app.requestedAmount,
                    outstandingBalance: app.requestedAmount,
                    currentStep: totalSteps,
                    startDate: new Date(),
                    endDate: new Date(Date.now() + app.tenure * 30 * 24 * 60 * 60 * 1000)
                }
            });

            await this.generateRepaymentSchedule(
                applicationId, app.tenure, Number(app.monthlyEmi),
                Number(app.interestRate), Number(app.requestedAmount)
            );

            // Notify Employee
            await this._notifyUser(
                app.userDetail.user_id,
                '🎉 Loan Application Fully Approved!',
                `Your ${app.loanType?.name || 'Loan'} application (${app.applicationNumber} - ₹${Number(app.requestedAmount).toLocaleString()}) has been fully approved.`,
                'LOAN_APPLICATION',
                applicationId
            );

            // Also Notify HR and Finance Teams of final approval
            const hrAndFinUsers = await this._getUsersByRole('hr');
            const finUsers = await this._getUsersByRole('finance');
            const allTargetIds = new Set([...hrAndFinUsers.map(u => u.id), ...finUsers.map(u => u.id)]);
            allTargetIds.delete(approverId);
            allTargetIds.delete(app.userDetail.user_id);

            for (const targetId of allTargetIds) {
                await this._notifyUser(
                    targetId,
                    '🎉 Loan Application Approved',
                    `${empName}'s ${app.loanType?.name || 'Loan'} application (${app.applicationNumber} - ₹${Number(app.requestedAmount).toLocaleString()}) was approved.`,
                    'LOAN_APPLICATION',
                    applicationId
                );
            }

            return await this.getById(applicationId);
        }

        // Move to next step
        const nextStatus = `PENDING_STEP_${nextStep}`;
        await prisma.loanApplication.update({
            where: { id: applicationId },
            data: { status: nextStatus, currentStep: nextStep }
        });

        // Notify next approver group (HR / Finance)
        const nextWorkflowStep = app.loanType?.approvalWorkflow?.find(s => s.stepOrder === nextStep);
        const targetRoleName = nextWorkflowStep?.roleName || (nextStep === 2 ? 'hr' : 'finance');
        const nextApprovers = await this._getUsersByRole(targetRoleName);

        for (const a of nextApprovers) {
            if (a.id !== approverId && a.id !== app.userDetail.user_id) {
                await this._notifyUser(
                    a.id,
                    `📜 Loan Application - Pending ${targetRoleName.toUpperCase()} Review`,
                    `${empName}'s ${app.loanType?.name || 'Loan'} application (${app.applicationNumber} - ₹${Number(app.requestedAmount).toLocaleString()}) approved at Step ${app.currentStep}. Pending ${targetRoleName} review.`,
                    'LOAN_APPLICATION',
                    applicationId
                );
            }
        }

        // Notify employee of progress
        await this._notifyUser(
            app.userDetail.user_id,
            'Application In Progress',
            `Your ${app.applicationNumber} has been approved at step ${app.currentStep} of ${totalSteps}. Pending ${targetRoleName} review.`,
            'LOAN_APPLICATION',
            applicationId
        );

        return await this.getById(applicationId);
    }

    async rejectStep(applicationId: number, approverId: number, remarks?: string) {
        const app = await prisma.loanApplication.findUnique({
            where: { id: applicationId },
            include: {
                loanType: true,
                userDetail: { include: { user: true } }
            }
        });
        if (!app) throw new Error('Application not found');

        const currentStepApproval = await prisma.loanApproval.findFirst({
            where: { applicationId, stepOrder: app.currentStep, status: 'PENDING' }
        });
        if (!currentStepApproval) throw new Error('No pending approval found for current step');

        await prisma.loanApproval.update({
            where: { id: currentStepApproval.id },
            data: { status: 'REJECTED', remarks: remarks || 'Rejected', actionAt: new Date(), approverId }
        });

        await prisma.loanApplication.update({
            where: { id: applicationId },
            data: { status: 'REJECTED', isActive: false, outstandingBalance: 0 }
        });

        await this._notifyUser(
            app.userDetail.user_id,
            'Application Rejected',
            `Your ${app.loanType.name} application ${app.applicationNumber} has been rejected.${remarks ? ` Reason: ${remarks}` : ''}`,
            'LOAN_APPLICATION',
            applicationId
        );

        return await this.getById(applicationId);
    }

    async getPendingApprovals(approverId: number, userRoles: string[]) {
        const isSuperAdmin = userRoles.some(r => ['SUPER ADMIN', 'SUPER_ADMIN', 'CEO'].includes(r.toUpperCase()));

        // Find all workflow steps where this user's role matches
        const userRoleNames = userRoles.map(r => r.toUpperCase());

        const pendingApps = await prisma.loanApplication.findMany({
            where: {
                isActive: true,
                status: { startsWith: 'PENDING_STEP' }
            },
            include: {
                userDetail: { include: { user: true, department: true, designation: true } },
                loanType: { include: { approvalWorkflow: { orderBy: { stepOrder: 'asc' } } } },
                approvals: { orderBy: { stepOrder: 'asc' }, include: { approver: { select: { id: true, details: { select: { first_name: true, last_name: true } } } } } },
                repaymentSchedule: { orderBy: { installmentNo: 'asc' } }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Filter: show only applications where the user can approve the current step
        return pendingApps.filter(app => {
            if (isSuperAdmin) return true;

            const currentStepWorkflow = app.loanType.approvalWorkflow.find((s: { stepOrder: number }) => s.stepOrder === app.currentStep);
            if (!currentStepWorkflow) return false;

            return userRoleNames.includes(currentStepWorkflow.roleName.toUpperCase()) ||
                   userRoleNames.includes('SUPER ADMIN') ||
                   userRoleNames.includes('ADMIN');
        });
    }

    // ─── Repayment Schedule ──────────────────────────────────────────────

    async generateRepaymentSchedule(applicationId: number, tenure: number, emi: number, interestRate: number, principal: number) {
        const schedule = [];
        let remainingBalance = principal;
        const ratePerMonth = Number(interestRate) / 12 / 100;

        for (let i = 1; i <= tenure; i++) {
            const interestPortion = remainingBalance * ratePerMonth;
            const principalPortion = emi - interestPortion;
            const dueDate = new Date();
            dueDate.setMonth(dueDate.getMonth() + i);

            schedule.push({
                applicationId,
                installmentNo: i,
                dueDate,
                amount: emi,
                principalPortion: Math.max(0, principalPortion),
                interestPortion: Math.max(0, interestPortion),
                status: 'PENDING',
                paidAmount: 0
            });

            remainingBalance = Math.max(0, remainingBalance - principalPortion);
        }

        await prisma.loanRepaymentSchedule.createMany({ data: schedule });
        return schedule;
    }

    async getRepaymentSchedule(applicationId: number) {
        return await prisma.loanRepaymentSchedule.findMany({
            where: { applicationId },
            orderBy: { installmentNo: 'asc' }
        });
    }

    // ─── Disbursement ──────────────────────────────────────────────────

    async disburse(applicationId: number, data: any) {
        const app = await prisma.loanApplication.findUnique({
            where: { id: applicationId },
            include: {
                loanType: true,
                userDetail: { include: { user: true } }
            }
        });
        if (!app) throw new Error('Application not found');
        if (app.status !== 'APPROVED') throw new Error('Only approved applications can be disbursed');

        const disbursementAmount = Number(data.disbursementAmount) || Number(app.approvedAmount);
        const disbursementDate = data.disbursementDate ? new Date(data.disbursementDate) : new Date();

        const updated = await prisma.loanApplication.update({
            where: { id: applicationId },
            data: {
                status: 'DISBURSED',
                outstandingBalance: disbursementAmount,
                startDate: disbursementDate,
                endDate: new Date(disbursementDate.getTime() + app.tenure * 30 * 24 * 60 * 60 * 1000)
            }
        });

        // Generate repayment schedule if not already generated
        const existingSchedule = await prisma.loanRepaymentSchedule.count({ where: { applicationId } });
        if (existingSchedule === 0) {
            await this.generateRepaymentSchedule(
                applicationId, app.tenure, Number(app.monthlyEmi),
                Number(app.interestRate), disbursementAmount
            );
        }

        await this._notifyUser(
            app.userDetail.user_id,
            'Loan Disbursed',
            `Your ${app.loanType.name} loan ${app.applicationNumber} (${disbursementAmount}) has been disbursed.`,
            'LOAN_APPLICATION',
            applicationId
        );

        return await this.getById(applicationId);
    }

    // ─── Dashboard Stats ─────────────────────────────────────────────────

    async getDashboardStats() {
        const [
            totalApplications, pendingApplications, approvedApplications,
            rejectedApplications, settledApplications,
            totalRequested, totalApproved, totalOutstanding, totalPaid,
            byType
        ] = await Promise.all([
            prisma.loanApplication.count(),
            prisma.loanApplication.count({ where: { status: { startsWith: 'PENDING' } } }),
            prisma.loanApplication.count({ where: { status: 'APPROVED' } }),
            prisma.loanApplication.count({ where: { status: 'REJECTED' } }),
            prisma.loanApplication.count({ where: { status: 'SETTLED' } }),
            prisma.loanApplication.aggregate({ _sum: { requestedAmount: true } }),
            prisma.loanApplication.aggregate({ _sum: { approvedAmount: true }, where: { status: { in: ['APPROVED', 'DISBURSED'] } } }),
            prisma.loanApplication.aggregate({ _sum: { outstandingBalance: true }, where: { status: { in: ['APPROVED', 'DISBURSED'] } } }),
            prisma.loanApplication.aggregate({ _sum: { paidAmount: true } }),
            prisma.loanApplication.groupBy({
                by: ['loanTypeId'],
                _count: true,
                _sum: { requestedAmount: true, outstandingBalance: true }
            })
        ]);

        const typeDetails = await Promise.all(
            byType.map(async (bt) => {
                const lt = await prisma.loanType.findUnique({ where: { id: bt.loanTypeId } });
                return { ...bt, loanType: lt };
            })
        );

        return {
            totalApplications,
            pendingApplications,
            approvedApplications,
            rejectedApplications,
            settledApplications,
            totalRequested: Number(totalRequested._sum.requestedAmount || 0),
            totalApproved: Number(totalApproved._sum.approvedAmount || 0),
            totalOutstanding: Number(totalOutstanding._sum.outstandingBalance || 0),
            totalPaid: Number(totalPaid._sum.paidAmount || 0),
            byType: typeDetails
        };
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private _checkPolicyTargeting(loanType: any, ud: any): { eligible: boolean; reasons: string[] } {
        const reasons: string[] = [];

        if (loanType.department_id && ud.department_id !== loanType.department_id) {
            reasons.push('This loan type is not available for your department');
        }
        if (loanType.designation_id && ud.designation_id !== loanType.designation_id) {
            reasons.push('This loan type is not available for your designation');
        }
        if (loanType.branch_id && ud.branch_id && ud.branch_id !== loanType.branch_id) {
            reasons.push('This loan type is not available for your branch');
        }
        if (loanType.role_id && ud.role_id !== loanType.role_id) {
            reasons.push('This loan type is not available for your role');
        }
        if (loanType.effectiveDate && new Date() < new Date(loanType.effectiveDate)) {
            reasons.push(`This loan type is effective from ${new Date(loanType.effectiveDate).toLocaleDateString()}`);
        }
        if (loanType.expiryDate && new Date() > new Date(loanType.expiryDate)) {
            reasons.push('This loan type has expired');
        }

        return { eligible: reasons.length === 0, reasons };
    }

    private _parseArray(value: string): string[] {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [value];
        } catch {
            return value ? value.split(',').map(v => v.trim()) : [];
        }
    }

    private _parseNumberArray(value: string): number[] {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map(Number) : [Number(value)];
        } catch {
            return value ? value.split(',').map(v => Number(v.trim())).filter(n => !isNaN(n)) : [];
        }
    }

    private async _notifyUser(userId: number, title: string, message: string, type: string, relatedId: number) {
        try {
            await notificationService.create({
                user_id: userId, title, message,
                type: 'LOANS_ADVANCES',
                related_module: 'loans-advances',
                related_id: relatedId,
                metadata: { loanAdvanceType: type }
            });
        } catch (_) { }
    }

    private async _getUsersByRole(roleName: string) {
        const cleanName = (roleName || '').trim();
        return await prisma.user.findMany({
            where: {
                OR: [
                    { roles: { some: { role: { role_name: { contains: cleanName } } } } },
                    { details: { role: { role_name: { contains: cleanName } } } },
                    { roles: { some: { role: { role_name: { contains: 'admin' } } } } },
                    { details: { role: { role_name: { contains: 'admin' } } } }
                ]
            },
            select: { id: true }
        });
    }
}
