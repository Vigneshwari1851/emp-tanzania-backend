import prisma from '../../config/prisma';
import { notificationService } from '../notifications/notification.service';
import { webSocketService } from '../notifications/websocket.service';

const HR_ROLES = ['HR', 'Human Resources', 'ADMIN', 'SUPER ADMIN', 'CEO', 'SYSTEM ADMINISTRATOR'];
const FINANCE_ROLES = ['Finance', 'Accounts', 'ADMIN', 'SUPER ADMIN', 'CEO', 'SYSTEM ADMINISTRATOR'];

export class LoansAdvancesService {

    // ─── Loans ─────────────────────────────────────────────────────────────

    async getAllLoans(orgId: number) {
        return await prisma.loan.findMany({
            where: {
                userDetail: {
                    department: {
                        branches: {
                            organization_id: orgId
                        }
                    }
                }
            },
            include: {
                userDetail: {
                    include: {
                        user: { include: { roles: { include: { role: true } } } },
                        reporting_manager: { select: { id: true, username: true, details: { select: { first_name: true, last_name: true } } } },
                        department: true,
                        designation: true,
                        role: true,
                        payroll_group: true,
                        user_types: true,
                        team: true
                    }
                },
                reporting_manager: { select: { id: true, username: true, details: { select: { first_name: true, last_name: true } } } },
                hr_approver: { select: { id: true, username: true, details: { select: { first_name: true, last_name: true } } } },
                finance_approver: { select: { id: true, username: true, details: { select: { first_name: true, last_name: true } } } }
            },
            orderBy: { created_at: 'desc' }
        });
    }

    async createLoan(userId: number, data: any, isAdmin: boolean, orgId?: number) {
        const userDetail = await prisma.userDetail.findUnique({
            where: { user_id: userId },
            select: { id: true, reporting_manager_id: true }
        });
        if (!userDetail) throw new Error('User profile details not found.');

        const existingLoan = await prisma.loan.findFirst({
            where: {
                userDetailId: userDetail.id,
                isActive: true,
                status: { in: ['APPROVED', 'PENDING_MANAGER', 'PENDING_HR', 'PENDING_FINANCE'] }
            }
        });
        if (existingLoan) {
            throw new Error('Employee already has an active or pending loan. Only one loan is allowed at a time.');
        }

        // Validate against LoanType maxAmount
        if (orgId) {
            const loanType = await prisma.loanType.findFirst({
                where: { category: 'LOAN', isActive: true, organization_id: orgId }
            });
            if (loanType && Number(loanType.maxAmount) > 0) {
                const requestedAmount = Number(data.principalAmount);
                if (requestedAmount > Number(loanType.maxAmount)) {
                    throw new Error(
                        `Loan amount of ₹${requestedAmount.toLocaleString()} exceeds the maximum allowed limit of ₹${Number(loanType.maxAmount).toLocaleString()} for this loan type.`
                    );
                }
                if (loanType.minAmount && Number(loanType.minAmount) > 0 && requestedAmount < Number(loanType.minAmount)) {
                    throw new Error(
                        `Loan amount of ₹${requestedAmount.toLocaleString()} is below the minimum required amount of ₹${Number(loanType.minAmount).toLocaleString()} for this loan type.`
                    );
                }
            }
        }

        const status = isAdmin ? 'APPROVED' : 'PENDING_MANAGER';

        const loan = await prisma.loan.create({
            data: {
                userDetailId: isAdmin ? (await prisma.userDetail.findUnique({ where: { user_id: data.userDetailId || userId } }))!.id : userDetail.id,
                principalAmount: Number(data.principalAmount),
                monthlyRecovery: Number(data.monthlyRecovery),
                outstandingBalance: Number(data.principalAmount),
                isActive: true,
                status,
                reason: data.reason || null,
                reporting_manager_id: isAdmin ? null : userDetail.reporting_manager_id
            },
            include: {
                userDetail: { include: { user: true } }
            }
        });

        if (!isAdmin) {
            const targetUserIds = new Set<number>();
            if (userDetail.reporting_manager_id) {
                targetUserIds.add(userDetail.reporting_manager_id);
            }
            const hrUsers = await this._getHRUsers();
            hrUsers.forEach(u => targetUserIds.add(u.id));
            targetUserIds.delete(userId);

            const empName = `${loan.userDetail?.first_name || ''} ${loan.userDetail?.last_name || ''}`.trim() || 'An employee';
            for (const targetId of targetUserIds) {
                await this._notify(
                    targetId,
                    '💰 New Loan Request',
                    `${empName} requested a loan of ₹${Number(data.principalAmount).toLocaleString()}. Approval required.`,
                    'LOAN',
                    loan.id,
                    { status: 'PENDING_MANAGER', amount: data.principalAmount }
                );
            }
        }

        return loan;
    }

    async approveLoanStep(id: number, approverId: number, remarks?: string) {
        const loan = await prisma.loan.findUnique({
            where: { id },
            include: {
                userDetail: { include: { user: true, reporting_manager: { select: { id: true } } } }
            }
        });
        if (!loan) throw new Error('Loan not found.');
        if (loan.status === 'APPROVED') throw new Error('Loan is already fully approved.');
        if (loan.status === 'REJECTED') throw new Error('Loan has been rejected.');

        const empName = `${loan.userDetail?.first_name || ''} ${loan.userDetail?.last_name || ''}`.trim();

        if (loan.status === 'PENDING_MANAGER') {
            if (loan.reporting_manager_id !== approverId) {
                const isSuperAdmin = await this._isSuperAdmin(approverId);
                const hasHRRole = await this._hasRole(approverId, HR_ROLES);
                if (!isSuperAdmin && !hasHRRole) throw new Error('Only the reporting manager or HR can approve at this step.');
            }
            const updated = await prisma.loan.update({
                where: { id },
                data: { status: 'PENDING_HR', manager_remarks: remarks || null, manager_approved_at: new Date() }
            });
            await this._notifyHR(`${empName}'s loan of ${loan.principalAmount} needs HR approval.`, 'LOAN', id, { status: 'PENDING_HR', amount: loan.principalAmount, employeeName: empName });
            return updated;
        }

        if (loan.status === 'PENDING_HR') {
            const hasHRRole = await this._hasRole(approverId, HR_ROLES);
            if (!hasHRRole) throw new Error('Only HR users can approve at this step.');
            const updated = await prisma.loan.update({
                where: { id },
                data: { status: 'PENDING_FINANCE', hr_approved_by: approverId, hr_remarks: remarks || null, hr_approved_at: new Date() }
            });
            await this._notifyFinance(`${empName}'s loan of ${loan.principalAmount} needs Finance approval.`, 'LOAN', id, { status: 'PENDING_FINANCE', amount: loan.principalAmount, employeeName: empName });
            return updated;
        }

        if (loan.status === 'PENDING_FINANCE') {
            const hasFinanceRole = await this._hasRole(approverId, FINANCE_ROLES);
            if (!hasFinanceRole) throw new Error('Only Finance users can approve at this step.');
            const updated = await prisma.loan.update({
                where: { id },
                data: { status: 'APPROVED', finance_approved_by: approverId, finance_remarks: remarks || null, finance_approved_at: new Date() }
            });
            if (loan.userDetail?.user_id) {
                await this._notify(
                    loan.userDetail.user_id,
                    'Loan Approved',
                    `Your loan of ${loan.principalAmount} has been fully approved.`,
                    'LOAN',
                    id,
                    { status: 'APPROVED', amount: loan.principalAmount }
                );
            }
            return updated;
        }

        throw new Error('Loan is in an unexpected status.');
    }

    async confirmLoanDisbursement(id: number, financeUserId: number, data: { disbursementReference?: string; disbursedAt?: string }) {
        const loan = await prisma.loan.findUnique({
            where: { id },
            include: { userDetail: { include: { user: true } } }
        });
        if (!loan) throw new Error('Loan not found.');
        if (loan.status !== 'APPROVED') throw new Error('Loan must be approved before confirming disbursement.');

        const updated = await prisma.loan.update({
            where: { id },
            data: {
                status: 'DISBURSED',
                disbursed_at: data.disbursedAt ? new Date(data.disbursedAt) : new Date(),
                disbursement_reference: data.disbursementReference || null
            } as any
        });

        if (loan.userDetail?.user_id) {
            await this._notify(
                loan.userDetail.user_id,
                'Loan Disbursed',
                `Your loan of ${loan.principalAmount} has been disbursed.${data.disbursementReference ? ` Reference: ${data.disbursementReference}` : ''}`,
                'LOAN',
                id,
                { status: 'DISBURSED', amount: loan.principalAmount, reference: data.disbursementReference }
            );
        }

        return updated;
    }

    async rejectLoanStep(id: number, approverId: number, remarks?: string) {
        const loan = await prisma.loan.findUnique({
            where: { id },
            include: { userDetail: { include: { user: true } } }
        });
        if (!loan) throw new Error('Loan not found.');
        if (loan.status === 'APPROVED' || loan.status === 'REJECTED') throw new Error('Loan is already in a terminal state.');

        const updated = await prisma.loan.update({
            where: { id },
            data: { status: 'REJECTED', isActive: false, outstandingBalance: 0, reason: remarks || loan.reason }
        });

        if (loan.userDetail?.user_id) {
            const stepLabel = loan.status === 'PENDING_MANAGER' ? 'Manager' : loan.status === 'PENDING_HR' ? 'HR' : 'Finance';
            await this._notify(
                loan.userDetail.user_id,
                'Loan Rejected',
                `Your loan of ${loan.principalAmount} has been rejected by ${stepLabel}.${remarks ? ` Reason: ${remarks}` : ''}`,
                'LOAN',
                id,
                { status: 'REJECTED', amount: loan.principalAmount }
            );
        }

        return updated;
    }

    async settleLoan(id: number) {
        return await prisma.loan.update({
            where: { id },
            data: { isActive: false, outstandingBalance: 0, status: 'SETTLED' }
        });
    }

    async getLoansForApproval(approverId: number, userRoles: string[]) {
        const user = await prisma.user.findUnique({
            where: { id: approverId },
            include: {
                roles: { include: { role: true } },
                details: { include: { role: true } }
            }
        });

        const allRoleNames = Array.from(new Set([
            ...(userRoles || []).map(r => (typeof r === 'string' ? r : (r as any)?.role_name || '')),
            (user as any)?.role || '',
            user?.details?.role?.role_name || '',
            ...(user?.roles || []).map(r => r.role?.role_name || (r as any).role_name || '')
        ])).map(r => String(r).toUpperCase()).filter(Boolean);

        const isSuperAdmin = allRoleNames.some(r => ['SUPER ADMIN', 'SUPER_ADMIN', 'CEO', 'ADMIN', 'SYSTEM ADMINISTRATOR'].includes(r));
        const hasHRRole = allRoleNames.some(r => HR_ROLES.some(hr => r.includes(hr.toUpperCase())));
        const hasFinanceRole = allRoleNames.some(r => FINANCE_ROLES.some(f => r.includes(f.toUpperCase())));
        const hasManagerRole = allRoleNames.some(r => r.includes('MANAGER') || r.includes('LEAD') || r.includes('HEAD'));

        const orConditions: any[] = [];

        if (isSuperAdmin) {
            orConditions.push(
                { status: 'PENDING_MANAGER' },
                { status: 'PENDING_HR' },
                { status: 'PENDING_FINANCE' }
            );
        } else {
            orConditions.push({ status: 'PENDING_MANAGER', reporting_manager_id: approverId });

            if (hasHRRole || hasManagerRole) {
                orConditions.push(
                    { status: 'PENDING_HR' },
                    { status: 'PENDING_MANAGER', reporting_manager_id: null }
                );
            }
            if (hasFinanceRole) {
                orConditions.push({ status: 'PENDING_FINANCE' });
            }
        }

        if (orConditions.length === 0) return [];

        return await prisma.loan.findMany({
            where: {
                isActive: true,
                OR: orConditions
            },
            include: {
                userDetail: { include: { user: true } },
                reporting_manager: { select: { id: true, username: true, details: { select: { first_name: true, last_name: true } } } },
                hr_approver: { select: { id: true, username: true, details: { select: { first_name: true, last_name: true } } } },
                finance_approver: { select: { id: true, username: true, details: { select: { first_name: true, last_name: true } } } }
            },
            orderBy: { created_at: 'asc' }
        });
    }

    // ─── Advances ──────────────────────────────────────────────────────────

    async getAllAdvances(orgId: number) {
        return await prisma.advance.findMany({
            where: {
                userDetail: {
                    department: {
                        branches: {
                            organization_id: orgId
                        }
                    }
                }
            },
            include: {
                userDetail: {
                    include: {
                        user: { include: { roles: { include: { role: true } } } },
                        reporting_manager: { select: { id: true, username: true, details: { select: { first_name: true, last_name: true } } } }
                    }
                },
                reporting_manager: { select: { id: true, username: true, details: { select: { first_name: true, last_name: true } } } },
                hr_approver: { select: { id: true, username: true, details: { select: { first_name: true, last_name: true } } } },
                finance_approver: { select: { id: true, username: true, details: { select: { first_name: true, last_name: true } } } }
            },
            orderBy: { created_at: 'desc' }
        });
    }

    async createAdvance(userId: number, data: any, isAdmin: boolean, orgId?: number) {
        const userDetail = await prisma.userDetail.findUnique({
            where: { user_id: userId },
            select: { id: true, reporting_manager_id: true }
        });
        if (!userDetail) throw new Error('User profile details not found.');

        const existingAdvance = await prisma.advance.findFirst({
            where: {
                userDetailId: userDetail.id,
                isActive: true,
                status: { in: ['APPROVED', 'PENDING_MANAGER', 'PENDING_HR', 'PENDING_FINANCE'] }
            }
        });
        if (existingAdvance) {
            throw new Error('Employee already has an active or pending salary advance. Only one advance is allowed at a time.');
        }

        // Validate against LoanType maxAmount
        if (orgId) {
            const advanceType = await prisma.loanType.findFirst({
                where: { category: 'ADVANCE', isActive: true, organization_id: orgId }
            });
            if (advanceType && Number(advanceType.maxAmount) > 0) {
                const requestedAmount = Number(data.principalAmount);
                if (requestedAmount > Number(advanceType.maxAmount)) {
                    throw new Error(
                        `Advance amount of ₹${requestedAmount.toLocaleString()} exceeds the maximum allowed limit of ₹${Number(advanceType.maxAmount).toLocaleString()} for this advance type.`
                    );
                }
                if (advanceType.minAmount && Number(advanceType.minAmount) > 0 && requestedAmount < Number(advanceType.minAmount)) {
                    throw new Error(
                        `Advance amount of ₹${requestedAmount.toLocaleString()} is below the minimum required amount of ₹${Number(advanceType.minAmount).toLocaleString()} for this advance type.`
                    );
                }
            }
        }

        const status = isAdmin ? 'APPROVED' : 'PENDING_MANAGER';

        const advance = await prisma.advance.create({
            data: {
                userDetailId: isAdmin ? (await prisma.userDetail.findUnique({ where: { user_id: data.userDetailId || userId } }))!.id : userDetail.id,
                principalAmount: Number(data.principalAmount),
                monthlyRecovery: Number(data.monthlyRecovery),
                outstandingBalance: Number(data.principalAmount),
                isActive: true,
                status,
                reason: data.reason || null,
                reporting_manager_id: isAdmin ? null : userDetail.reporting_manager_id
            },
            include: {
                userDetail: { include: { user: true } }
            }
        });

        if (!isAdmin) {
            const targetUserIds = new Set<number>();
            if (userDetail.reporting_manager_id) {
                targetUserIds.add(userDetail.reporting_manager_id);
            } else {
                const hrUsers = await this._getHRUsers();
                hrUsers.forEach(u => targetUserIds.add(u.id));
            }
            targetUserIds.delete(userId);

            const empName = `${advance.userDetail?.first_name || ''} ${advance.userDetail?.last_name || ''}`.trim() || 'An employee';
            for (const targetId of targetUserIds) {
                await this._notify(
                    targetId,
                    '💵 New Salary Advance Request',
                    `${empName} requested a salary advance of ₹${Number(data.principalAmount).toLocaleString()}. Approval required.`,
                    'ADVANCE',
                    advance.id,
                    { status: 'PENDING_MANAGER', amount: data.principalAmount }
                );
            }
        }

        return advance;
    }

    async approveAdvanceStep(id: number, approverId: number, remarks?: string) {
        const advance = await prisma.advance.findUnique({
            where: { id },
            include: {
                userDetail: { include: { user: true, reporting_manager: { select: { id: true } } } }
            }
        });
        if (!advance) throw new Error('Advance not found.');
        if (advance.status === 'APPROVED') throw new Error('Advance is already fully approved.');
        if (advance.status === 'REJECTED') throw new Error('Advance has been rejected.');

        const empName = `${advance.userDetail?.first_name || ''} ${advance.userDetail?.last_name || ''}`.trim();

        if (advance.status === 'PENDING_MANAGER') {
            if (advance.reporting_manager_id !== approverId) {
                const isSuperAdmin = await this._isSuperAdmin(approverId);
                const hasHRRole = await this._hasRole(approverId, HR_ROLES);
                if (!isSuperAdmin && !hasHRRole) throw new Error('Only the reporting manager or HR can approve at this step.');
            }
            const updated = await prisma.advance.update({
                where: { id },
                data: { status: 'PENDING_HR', manager_remarks: remarks || null, manager_approved_at: new Date() }
            });
            await this._notifyHR(`${empName}'s advance of ${advance.principalAmount} needs HR approval.`, 'ADVANCE', id, { status: 'PENDING_HR', amount: advance.principalAmount, employeeName: empName });
            return updated;
        }

        if (advance.status === 'PENDING_HR') {
            const hasHRRole = await this._hasRole(approverId, HR_ROLES);
            if (!hasHRRole) throw new Error('Only HR users can approve at this step.');
            const updated = await prisma.advance.update({
                where: { id },
                data: { status: 'PENDING_FINANCE', hr_approved_by: approverId, hr_remarks: remarks || null, hr_approved_at: new Date() }
            });
            await this._notifyFinance(`${empName}'s advance of ${advance.principalAmount} needs Finance approval.`, 'ADVANCE', id, { status: 'PENDING_FINANCE', amount: advance.principalAmount, employeeName: empName });
            return updated;
        }

        if (advance.status === 'PENDING_FINANCE') {
            const hasFinanceRole = await this._hasRole(approverId, FINANCE_ROLES);
            if (!hasFinanceRole) throw new Error('Only Finance users can approve at this step.');
            const updated = await prisma.advance.update({
                where: { id },
                data: { status: 'APPROVED', finance_approved_by: approverId, finance_remarks: remarks || null, finance_approved_at: new Date() }
            });
            if (advance.userDetail?.user_id) {
                await this._notify(
                    advance.userDetail.user_id,
                    'Advance Approved',
                    `Your salary advance of ${advance.principalAmount} has been fully approved.`,
                    'ADVANCE',
                    id,
                    { status: 'APPROVED', amount: advance.principalAmount }
                );
            }
            return updated;
        }

        throw new Error('Advance is in an unexpected status.');
    }

    async confirmAdvanceDisbursement(id: number, financeUserId: number, data: { disbursementReference?: string; disbursedAt?: string }) {
        const advance = await prisma.advance.findUnique({
            where: { id },
            include: { userDetail: { include: { user: true } } }
        });
        if (!advance) throw new Error('Advance not found.');
        if (advance.status !== 'APPROVED') throw new Error('Advance must be approved before confirming disbursement.');

        const updated = await prisma.advance.update({
            where: { id },
            data: {
                status: 'DISBURSED',
                disbursed_at: data.disbursedAt ? new Date(data.disbursedAt) : new Date(),
                disbursement_reference: data.disbursementReference || null
            } as any
        });

        if (advance.userDetail?.user_id) {
            await this._notify(
                advance.userDetail.user_id,
                'Advance Disbursed',
                `Your salary advance of ${advance.principalAmount} has been disbursed.${data.disbursementReference ? ` Reference: ${data.disbursementReference}` : ''}`,
                'ADVANCE',
                id,
                { status: 'DISBURSED', amount: advance.principalAmount, reference: data.disbursementReference }
            );
        }

        return updated;
    }

    async rejectAdvanceStep(id: number, approverId: number, remarks?: string) {
        const advance = await prisma.advance.findUnique({
            where: { id },
            include: { userDetail: { include: { user: true } } }
        });
        if (!advance) throw new Error('Advance not found.');
        if (advance.status === 'APPROVED' || advance.status === 'REJECTED') throw new Error('Advance is already in a terminal state.');

        const updated = await prisma.advance.update({
            where: { id },
            data: { status: 'REJECTED', isActive: false, outstandingBalance: 0, reason: remarks || advance.reason }
        });

        if (advance.userDetail?.user_id) {
            const stepLabel = advance.status === 'PENDING_MANAGER' ? 'Manager' : advance.status === 'PENDING_HR' ? 'HR' : 'Finance';
            await this._notify(
                advance.userDetail.user_id,
                'Advance Rejected',
                `Your advance of ${advance.principalAmount} has been rejected by ${stepLabel}.${remarks ? ` Reason: ${remarks}` : ''}`,
                'ADVANCE',
                id,
                { status: 'REJECTED', amount: advance.principalAmount }
            );
        }

        return updated;
    }

    async settleAdvance(id: number) {
        return await prisma.advance.update({
            where: { id },
            data: { isActive: false, outstandingBalance: 0, status: 'SETTLED' }
        });
    }

    async getAdvancesForApproval(approverId: number, userRoles: string[]) {
        const user = await prisma.user.findUnique({
            where: { id: approverId },
            include: {
                roles: { include: { role: true } },
                details: { include: { role: true } }
            }
        });

        const allRoleNames = Array.from(new Set([
            ...(userRoles || []).map(r => (typeof r === 'string' ? r : (r as any)?.role_name || '')),
            (user as any)?.role || '',
            user?.details?.role?.role_name || '',
            ...(user?.roles || []).map(r => r.role?.role_name || (r as any).role_name || '')
        ])).map(r => String(r).toUpperCase()).filter(Boolean);

        const isSuperAdmin = allRoleNames.some(r => ['SUPER ADMIN', 'SUPER_ADMIN', 'CEO', 'ADMIN', 'SYSTEM ADMINISTRATOR'].includes(r));
        const hasHRRole = allRoleNames.some(r => HR_ROLES.some(hr => r.includes(hr.toUpperCase())));
        const hasFinanceRole = allRoleNames.some(r => FINANCE_ROLES.some(f => r.includes(f.toUpperCase())));
        const hasManagerRole = allRoleNames.some(r => r.includes('MANAGER') || r.includes('LEAD') || r.includes('HEAD'));

        const orConditions: any[] = [];

        if (isSuperAdmin) {
            orConditions.push(
                { status: 'PENDING_MANAGER' },
                { status: 'PENDING_HR' },
                { status: 'PENDING_FINANCE' }
            );
        } else {
            orConditions.push({ status: 'PENDING_MANAGER', reporting_manager_id: approverId });

            if (hasHRRole || hasManagerRole) {
                orConditions.push(
                    { status: 'PENDING_HR' },
                    { status: 'PENDING_MANAGER', reporting_manager_id: null }
                );
            }
            if (hasFinanceRole) {
                orConditions.push({ status: 'PENDING_FINANCE' });
            }
        }

        if (orConditions.length === 0) return [];

        return await prisma.advance.findMany({
            where: {
                isActive: true,
                OR: orConditions
            },
            include: {
                userDetail: { include: { user: true } },
                reporting_manager: { select: { id: true, username: true, details: { select: { first_name: true, last_name: true } } } },
                hr_approver: { select: { id: true, username: true, details: { select: { first_name: true, last_name: true } } } },
                finance_approver: { select: { id: true, username: true, details: { select: { first_name: true, last_name: true } } } }
            },
            orderBy: { created_at: 'asc' }
        });
    }

    // ─── Payroll Recovery (called from payroll service) ────────────────────

    async recoverLoanAndAdvance(userId: number, loanRecovery: number, advanceRecovery: number) {
        return await prisma.$transaction(async (tx) => {
            let totalLoanRecovered = 0;
            let totalAdvanceRecovered = 0;

            if (loanRecovery > 0) {
                const userDetail = await tx.userDetail.findUnique({
                    where: { user_id: userId },
                    include: { loans: { where: { isActive: true, status: { in: ['APPROVED', 'DISBURSED'] } } } }
                });
                if (userDetail) {
                    let remaining = loanRecovery;
                    for (const loan of userDetail.loans) {
                        if (remaining <= 0) break;
                        const deduction = Math.min(Number(loan.monthlyRecovery), Number(loan.outstandingBalance), remaining);
                        const newBalance = Math.max(0, Number(loan.outstandingBalance) - deduction);
                        await tx.loan.update({
                            where: { id: loan.id },
                            data: {
                                outstandingBalance: newBalance,
                                isActive: newBalance > 0,
                                ...(newBalance === 0 && { status: 'SETTLED' })
                            }
                        });
                        remaining -= deduction;
                        totalLoanRecovered += deduction;
                    }
                }
            }

            if (advanceRecovery > 0) {
                const userDetail = await tx.userDetail.findUnique({
                    where: { user_id: userId },
                    include: { advances: { where: { isActive: true, status: { in: ['APPROVED', 'DISBURSED'] } } } }
                });
                if (userDetail) {
                    let remaining = advanceRecovery;
                    for (const advance of userDetail.advances) {
                        if (remaining <= 0) break;
                        const deduction = Math.min(Number(advance.monthlyRecovery), Number(advance.outstandingBalance), remaining);
                        const newBalance = Math.max(0, Number(advance.outstandingBalance) - deduction);
                        await tx.advance.update({
                            where: { id: advance.id },
                            data: {
                                outstandingBalance: newBalance,
                                isActive: newBalance > 0,
                                ...(newBalance === 0 && { status: 'SETTLED' })
                            }
                        });
                        remaining -= deduction;
                        totalAdvanceRecovered += deduction;
                    }
                }
            }

            return { totalLoanRecovered, totalAdvanceRecovered };
        });
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    private async _notify(userId: number, title: string, message: string, type: string, relatedId: number, metadata?: any) {
        try {
            await notificationService.create({
                user_id: userId,
                title,
                message,
                type: 'LOANS_ADVANCES',
                related_module: 'loans-advances',
                related_id: relatedId,
                metadata: { ...metadata, loanAdvanceType: type }
            });
        } catch (_) { }
    }

    async getHRUsers() {
        return this._getHRUsers();
    }

    private async _getHRUsers() {
        return await prisma.user.findMany({
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
    }

    private async _getFinanceUsers() {
        return await prisma.user.findMany({
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
    }

    private async _notifyHR(message: string, loanType: string, relatedId: number, metadata?: any) {
        try {
            const hrUsers = await this._getHRUsers();
            for (const hr of hrUsers) {
                await this._notify(hr.id, 'Loan/Advance Pending HR Review', message, loanType, relatedId, metadata);
            }
        } catch (_) { }
    }

    private async _notifyFinance(message: string, loanType: string, relatedId: number, metadata?: any) {
        try {
            const financeUsers = await this._getFinanceUsers();
            for (const f of financeUsers) {
                await this._notify(f.id, 'Loan/Advance Pending Finance Approval', message, loanType, relatedId, metadata);
            }
        } catch (_) { }
    }

    private async _hasRole(userId: number, roleNames: string[]): Promise<boolean> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: { include: { role: true } },
                details: { include: { role: true } }
            }
        });
        if (!user) return false;
        const allRoles = [
            (user as any).role || '',
            user.details?.role?.role_name || '',
            ...(user.roles || []).map(ur => ur.role?.role_name || (ur as any).role_name || '')
        ].map(r => r.toUpperCase());

        return roleNames.some(target => allRoles.some(userRole => userRole.includes(target.toUpperCase())));
    }

    private async _isSuperAdmin(userId: number): Promise<boolean> {
        return this._hasRole(userId, ['SUPER ADMIN', 'SUPER_ADMIN', 'CEO']);
    }

    async getSettings() {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: 'loanadv_settings' }
        });
        if (setting) {
            return JSON.parse(setting.value);
        }
        // Return defaults
        return {
            autoRequestNumberPrefix: 'LA-',
            financialYear: '2026-2027',
            maxLoanAmount: 1000000,
            maxAdvanceAmount: 100000,
            maxLoanTenure: 60,
            defaultInterestRate: 8.5,
            defaultCurrency: 'INR',
            approvalWorkflow: ['MANAGER', 'HR', 'FINANCE'],
        };
    }

    async saveSettings(data: any) {
        return await prisma.systemSetting.upsert({
            where: { key: 'loanadv_settings' },
            update: { value: JSON.stringify(data) },
            create: { key: 'loanadv_settings', value: JSON.stringify(data) }
        });
    }
}
