import prisma from '../../shared/prisma/client';
import { AppError } from '../../middlewares/error.middleware';
import { notificationService } from '../notifications/notification.service';
import { Prisma } from '@prisma/client';

const ALLOWED_CHANGE_FIELDS = new Set([
    // User table
    'email',
    // Personal
    'first_name',
    'middle_name',
    'last_name',
    'date_of_birth',
    'gender',
    'nationality',
    'marital_status',
    'blood_group',
    // Contact
    'phone',
    'secondary_phone',
    'secondary_email',
    // Address
    'address',
    'city',
    'state',
    'zip',
    'country',
    'secondary_address',
    'secondary_city',
    'secondary_state',
    'secondary_zip',
    'secondary_country',
    // Emergency
    'emergency_contact',
    'emergency_relationship',
    'emergency_phone',
    'emergency_email',
    // Identity
    'passport_number',
    'passport_expiry_date',
    'driving_license_number',
    'license_expiry_date',
    'pan_number',
    'aadhaar_number',
    // Bank
    'bank_name',
    'branch_name',
    'account_holder_name',
    'account_number',
    'ifsc_code',
    // Work / self-managed details
    'work_location',
    'work_schedule',
    'skills',
    'languages',
    'certifications',
    'education',
    'employment_history',
]);

const EMPLOYEE_STATUSES = ['PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED'];

const sanitizeValue = (value: any): any => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.map(sanitizeValue);
    if (typeof value === 'object') {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(value)) out[k] = sanitizeValue(v);
        return out;
    }
    return String(value);
};

const sanitizeChanges = (changes: Record<string, any>): Record<string, any> => {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(changes)) {
        if (!ALLOWED_CHANGE_FIELDS.has(key)) continue;
        const cleaned = sanitizeValue(value);
        if (cleaned === '' || cleaned === null) continue;
        out[key] = cleaned;
    }
    return out;
};

const getUserRoleNames = async (userId: number): Promise<string> => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            roles: { include: { role: true } },
            details: { include: { role: true } }
        }
    });
    if (!user) return '';
    return [
        (user as any).role || '',
        user.details?.role?.role_name || '',
        ...(user.roles || []).map(r => r.role?.role_name || (r as any).role_name || '')
    ].join(' ').toUpperCase();
};

const isHR = (roleNames: string): boolean =>
    roleNames.includes('HR') ||
    roleNames.includes('HUMAN') ||
    roleNames.includes('ADMIN') ||
    roleNames.includes('SUPER') ||
    roleNames.includes('CEO');

const findHRUserIds = async (excludeUserId?: number): Promise<number[]> => {
    const users = await prisma.user.findMany({
        where: {
            is_deleted: false,
            status: true
        },
        include: {
            roles: { include: { role: true } },
            details: { include: { role: true } }
        }
    });

    return users.filter(u => {
        if (excludeUserId && u.id === excludeUserId) return false;
        const email = u.email || '';
        const roleNames = [
            (u as any).role || '',
            u.details?.role?.role_name || '',
            ...(u.roles || []).map(r => r.role?.role_name || (r as any).role_name || '')
        ].join(' ').toUpperCase();

        const isSuperAdmin = email.toLowerCase().includes('superadmin') || roleNames.includes('SUPER');
        const isHR = email.toLowerCase().includes('hr') || roleNames.includes('HR') || isSuperAdmin;
        
        if (email.toLowerCase().includes('finance') && !isSuperAdmin) {
            return false;
        }

        return isHR;
    }).map(u => u.id);
};

const findFinanceUserIds = async (excludeUserId?: number): Promise<number[]> => {
    const users = await prisma.user.findMany({
        where: {
            is_deleted: false,
            status: true
        },
        include: {
            roles: { include: { role: true } },
            details: { include: { role: true } }
        }
    });

    return users.filter(u => {
        if (excludeUserId && u.id === excludeUserId) return false;
        const email = u.email || '';
        const roleNames = [
            (u as any).role || '',
            u.details?.role?.role_name || '',
            ...(u.roles || []).map(r => r.role?.role_name || (r as any).role_name || '')
        ].join(' ').toUpperCase();

        const isSuperAdmin = email.toLowerCase().includes('superadmin') || roleNames.includes('SUPER');
        const isFinance = email.toLowerCase().includes('finance') || email.toLowerCase().includes('account') || roleNames.includes('FINANCE') || roleNames.includes('ACCOUNT') || isSuperAdmin;

        if (email.toLowerCase().includes('hr') && !isSuperAdmin) {
            return false;
        }

        return isFinance;
    }).map(u => u.id);
};

const AUTO_APPLY_FIELDS = new Set([
    'first_name',
    'middle_name',
    'last_name',
    'date_of_birth',
    'gender',
    'nationality',
    'marital_status',
    'blood_group'
]);

const PAYROLL_FIELDS = new Set([
    'bank_name',
    'branch_name',
    'account_holder_name',
    'account_number',
    'ifsc_code',
    'pan_number',
    'aadhaar_number',
    'passport_number',
    'passport_expiry_date',
    'driving_license_number',
    'license_expiry_date'
]);

const applyChangesDirectly = async (userId: number, changes: Record<string, any>) => {
    return prisma.$transaction(async (tx) => {
        const { email, _previous, ...detailsChanges } = changes;
        if (email) {
            await tx.user.update({
                where: { id: userId },
                data: { email }
            });
        }
        if (Object.keys(detailsChanges).length > 0) {
            const casted: Record<string, any> = { ...detailsChanges };
            if (casted.date_of_birth) casted.date_of_birth = new Date(casted.date_of_birth);
            if (casted.passport_expiry_date) casted.passport_expiry_date = new Date(casted.passport_expiry_date);
            if (casted.license_expiry_date) casted.license_expiry_date = new Date(casted.license_expiry_date);

            for (const [key, value] of Object.entries(casted)) {
                if (Array.isArray(value) || (value && typeof value === 'object')) {
                    casted[key] = JSON.stringify(value);
                }
            }

            await tx.userDetail.update({
                where: { user_id: userId },
                data: casted as Prisma.UserDetailUpdateInput
            });
        }
    });
};

const getEmployeeName = (user: any): string => {
    if (user?.details) {
        const name = `${user.details.first_name || ''} ${user.details.last_name || ''}`.trim();
        if (name) return name;
    }
    return user?.username || `Employee #${user?.id ?? ''}`;
};

const capturePreviousValues = (user: any, changes: Record<string, any>): Record<string, any> => {
    const previous: Record<string, any> = {};
    const details = user.details || {};
    for (const key of Object.keys(changes)) {
        let current = key === 'email' ? user.email : (details as any)[key];
        if (current === null || current === undefined) {
            current = null;
        } else if (current instanceof Date) {
            current = current.toISOString();
        }
        previous[key] = current;
    }
    return previous;
};

const normalizeForCompare = (key: string, value: any): string => {
    if (value === null || value === undefined || value === '') return '';
    if (key === 'email') return String(value).trim().toLowerCase();
    if (typeof value === 'string') {
        const datePart = value.match(/^\d{4}-\d{2}-\d{2}/);
        if (datePart) return datePart[0];
        return value.trim();
    }
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

const areValuesEqual = (key: string, a: any, b: any): boolean =>
    normalizeForCompare(key, a) === normalizeForCompare(key, b);

const requestWithUser = (id: number) =>
    prisma.employeeChangeRequest.findUnique({
        where: { id },
        include: {
            user: {
                include: {
                    details: {
                        select: {
                            first_name: true,
                            last_name: true,
                            profile_picture: true,
                            department: { select: { department_name: true } },
                            role: { select: { role_name: true } }
                        }
                    }
                }
            }
        }
    });

export class ChangeRequestService {
    async create(userId: number, changes: Record<string, any>) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { details: true }
        });
        if (!user || user.is_deleted) throw new AppError('Employee not found', 404);

        const cleanChanges = sanitizeChanges(changes);
        if (Object.keys(cleanChanges).length === 0) {
            throw new AppError('No valid field changes to submit', 400);
        }

        if (cleanChanges.email && cleanChanges.email.toLowerCase() !== (user.email || '').toLowerCase()) {
            const emailExists = await prisma.user.findFirst({
                where: { email: cleanChanges.email, id: { not: userId }, is_deleted: false }
            });
            if (emailExists) throw new AppError('Email is already in use by another employee', 400);
        }

        const previousValues = capturePreviousValues(user, cleanChanges);
        const changedOnly: Record<string, any> = {};
        for (const [key, newValue] of Object.entries(cleanChanges)) {
            if (!areValuesEqual(key, previousValues[key], newValue)) {
                changedOnly[key] = newValue;
            }
        }
        if (Object.keys(changedOnly).length === 0) {
            throw new AppError('No changes detected - the submitted values match your current profile', 400);
        }

        const autoChanges: Record<string, any> = {};
        const approvalChanges: Record<string, any> = {};
        for (const [key, value] of Object.entries(changedOnly)) {
            if (AUTO_APPLY_FIELDS.has(key)) {
                autoChanges[key] = value;
            } else {
                approvalChanges[key] = value;
            }
        }

        // Apply autoChanges immediately if any exist
        if (Object.keys(autoChanges).length > 0) {
            await applyChangesDirectly(userId, autoChanges);
        }

        // If there are no approval-required changes, log the change request as APPROVED and return
        if (Object.keys(approvalChanges).length === 0) {
            const finalPrevious: Record<string, any> = {};
            for (const key of Object.keys(autoChanges)) finalPrevious[key] = previousValues[key];

            return prisma.employeeChangeRequest.create({
                data: {
                    user_id: userId,
                    requested_changes: { ...autoChanges, _previous: finalPrevious },
                    status: 'APPROVED',
                    category: 'GENERAL',
                    applied_at: new Date()
                }
            });
        }

        // Handle approval-required changes
        const hasPayroll = Object.keys(approvalChanges).some(key => PAYROLL_FIELDS.has(key));
        const category = hasPayroll ? 'PAYROLL' : 'GENERAL';
        const status = hasPayroll ? 'PENDING_FINANCE_APPROVAL' : 'PENDING_HR_APPROVAL';

        const finalPrevious: Record<string, any> = {};
        for (const key of Object.keys(approvalChanges)) finalPrevious[key] = previousValues[key];

        const request = await prisma.employeeChangeRequest.create({
            data: {
                user_id: userId,
                requested_changes: { ...approvalChanges, _previous: finalPrevious },
                status,
                category
            }
        });

        const employeeName = getEmployeeName(user);
        const fieldCount = Object.keys(approvalChanges).length;

        if (category === 'PAYROLL') {
            const financeIds = await findFinanceUserIds();
            const hrIds = await findHRUserIds();
            const recipientIds = Array.from(new Set([...financeIds, ...hrIds]));
            for (const fId of recipientIds) {
                await notificationService.create({
                    user_id: fId,
                    title: 'Payroll Change Request',
                    message: `${employeeName} submitted ${fieldCount} payroll change${fieldCount > 1 ? 's' : ''} awaiting HR & Finance approval.`,
                    type: 'PROFILE_CHANGE',
                    related_module: 'profile-change',
                    related_id: request.id,
                    metadata: { requestId: request.id, employeeId: userId }
                });
            }
        } else {
            const hrIds = await findHRUserIds();
            for (const hrId of hrIds) {
                await notificationService.create({
                    user_id: hrId,
                    title: 'Profile Change Request',
                    message: `${employeeName} submitted ${fieldCount} contact change${fieldCount > 1 ? 's' : ''} awaiting HR approval.`,
                    type: 'PROFILE_CHANGE',
                    related_module: 'profile-change',
                    related_id: request.id,
                    metadata: { requestId: request.id, employeeId: userId }
                });
            }
        }

        return request;
    }

    async getMyRequests(userId: number, status?: string) {
        return prisma.employeeChangeRequest.findMany({
            where: {
                user_id: userId,
                ...(status ? { status } : {})
            },
            orderBy: { created_at: 'desc' },
            include: {
                user: {
                    include: {
                        details: {
                            select: {
                                first_name: true,
                                last_name: true,
                                profile_picture: true
                            }
                        }
                    }
                }
            }
        });
    }

    async getInbox(userId: number) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: { include: { role: true } },
                details: { include: { role: true } }
            }
        });
        if (!user) return [];

        const email = user.email || '';
        const roleNames = [
            (user as any).role || '',
            user.details?.role?.role_name || '',
            ...(user.roles || []).map(r => r.role?.role_name || (r as any).role_name || '')
        ].join(' ').toUpperCase();

        const isSuperAdmin = email.toLowerCase().includes('superadmin') || roleNames.includes('SUPER');
        const isHRUser = email.toLowerCase().includes('hr') || roleNames.includes('HR') || isSuperAdmin;
        const isFinanceUser = email.toLowerCase().includes('finance') || email.toLowerCase().includes('account') || roleNames.includes('FINANCE') || roleNames.includes('ACCOUNT') || isSuperAdmin;

        const statusFilter: string[] = [];
        if (isHRUser) statusFilter.push('PENDING_HR_APPROVAL');
        if (isFinanceUser) statusFilter.push('PENDING_FINANCE_APPROVAL');

        if (statusFilter.length === 0) {
            return [];
        }

        const pending = await prisma.employeeChangeRequest.findMany({
            where: {
                user_id: { not: userId },
                status: { in: statusFilter }
            },
            orderBy: { created_at: 'asc' },
            include: {
                user: {
                    include: {
                        details: {
                            select: {
                                first_name: true,
                                last_name: true,
                                profile_picture: true,
                                department: { select: { department_name: true } },
                                role: { select: { role_name: true } }
                            }
                        }
                    }
                }
            }
        });

        return pending.filter((r) => {
            if (isSuperAdmin) return true;
            
            if (r.status === 'PENDING_HR_APPROVAL' && isHRUser && (r.category === 'GENERAL' || !r.category)) {
                if (email.toLowerCase().includes('finance')) return false;
                return true;
            }
            if (r.status === 'PENDING_FINANCE_APPROVAL' && (isFinanceUser || isHRUser) && r.category === 'PAYROLL') {
                return true;
            }
            return false;
        });
    }

    async decide(
        requestId: number,
        actorId: number,
        action: 'approve' | 'reject',
        roleParam: 'manager' | 'hr' | 'finance',
        note?: string
    ) {
        const request = await requestWithUser(requestId);
        if (!request) throw new AppError('Change request not found', 404);
        if (request.status === 'APPROVED' || request.status === 'REJECTED') {
            throw new AppError('This change request has already been decided', 400);
        }

        const employeeName = getEmployeeName(request.user);
        const roleNames = (await getUserRoleNames(actorId)).toUpperCase();
        const isSuperAdmin = roleNames.includes('SUPER');
        const isHRUser = roleNames.includes('HR') || roleNames.includes('ADMIN') || roleNames.includes('SYSTEM_ADMIN') || isSuperAdmin;
        const isFinanceUser = roleNames.includes('FINANCE') || roleNames.includes('ACCOUNT') || roleNames.includes('PAYROLL') || roleNames.includes('ADMIN') || roleNames.includes('SYSTEM_ADMIN') || isSuperAdmin;

        if (request.status === 'PENDING_FINANCE_APPROVAL') {
            if (!isFinanceUser && !isHRUser) {
                throw new AppError('Only HR, Finance or admin users can approve payroll change requests', 403);
            }

            if (action === 'reject') {
                const updated = await prisma.employeeChangeRequest.update({
                    where: { id: requestId },
                    data: {
                        status: 'REJECTED',
                        hr_id: actorId,
                        hr_status: 'REJECTED',
                        hr_note: note || null,
                        hr_actioned_at: new Date()
                    }
                });
                await notificationService.create({
                    user_id: request.user_id,
                    title: 'Profile Change Request Rejected',
                    message: `Your payroll profile change request was rejected by Finance${note ? `: ${note}` : '.'}`,
                    type: 'PROFILE_CHANGE',
                    related_module: 'profile-change',
                    related_id: requestId,
                    metadata: { requestId, status: 'REJECTED', stage: 'finance' }
                });
                return updated;
            }

            await this.applyChanges(request);
            const updated = await prisma.employeeChangeRequest.update({
                where: { id: requestId },
                data: {
                    status: 'APPROVED',
                    hr_id: actorId,
                    hr_status: 'APPROVED',
                    hr_note: note || null,
                    hr_actioned_at: new Date(),
                    applied_at: new Date()
                }
            });
            await notificationService.create({
                user_id: request.user_id,
                title: 'Profile Change Request Approved',
                message: 'Your payroll profile change request was approved and your profile has been updated.',
                type: 'PROFILE_CHANGE',
                related_module: 'profile-change',
                related_id: requestId,
                metadata: { requestId, status: 'APPROVED' }
            });
            return updated;
        }

        // Default: GENERAL changes
        if (request.status === 'PENDING_HR_APPROVAL' || request.status === 'PENDING_MANAGER' || request.status === 'PENDING_HR') {
            if (!isHRUser) {
                throw new AppError('Only HR or admin users can approve profile change requests', 403);
            }

            if (action === 'reject') {
                const updated = await prisma.employeeChangeRequest.update({
                    where: { id: requestId },
                    data: {
                        status: 'REJECTED',
                        hr_id: actorId,
                        hr_status: 'REJECTED',
                        hr_note: note || null,
                        hr_actioned_at: new Date()
                    }
                });
                await notificationService.create({
                    user_id: request.user_id,
                    title: 'Profile Change Request Rejected',
                    message: `Your profile change request was rejected by HR${note ? `: ${note}` : '.'}`,
                    type: 'PROFILE_CHANGE',
                    related_module: 'profile-change',
                    related_id: requestId,
                    metadata: { requestId, status: 'REJECTED', stage: 'hr' }
                });
                return updated;
            }

            await this.applyChanges(request);
            const updated = await prisma.employeeChangeRequest.update({
                where: { id: requestId },
                data: {
                    status: 'APPROVED',
                    hr_id: actorId,
                    hr_status: 'APPROVED',
                    hr_note: note || null,
                    hr_actioned_at: new Date(),
                    applied_at: new Date()
                }
            });
            await notificationService.create({
                user_id: request.user_id,
                title: 'Profile Change Request Approved',
                message: 'Your profile change request was approved and your profile has been updated.',
                type: 'PROFILE_CHANGE',
                related_module: 'profile-change',
                related_id: requestId,
                metadata: { requestId, status: 'APPROVED' }
            });
            return updated;
        }

        throw new AppError('Invalid request status or unauthorized role', 400);
    }

    private async applyChanges(request: any) {
        const changes = request.requested_changes as Record<string, any>;
        if (!changes || Object.keys(changes).length === 0) return;

        return prisma.$transaction(async (tx) => {
            const { email, _previous, ...detailsChanges } = changes;

            if (email) {
                await tx.user.update({
                    where: { id: request.user_id },
                    data: { email }
                });
            }

            if (Object.keys(detailsChanges).length === 0) return;

            const casted: Record<string, any> = { ...detailsChanges };
            if (casted.date_of_birth) casted.date_of_birth = new Date(casted.date_of_birth);
            if (casted.passport_expiry_date) casted.passport_expiry_date = new Date(casted.passport_expiry_date);
            if (casted.license_expiry_date) casted.license_expiry_date = new Date(casted.license_expiry_date);

            for (const [key, value] of Object.entries(casted)) {
                if (Array.isArray(value) || (value && typeof value === 'object')) {
                    casted[key] = JSON.stringify(value);
                }
            }

            await tx.userDetail.update({
                where: { user_id: request.user_id },
                data: casted as Prisma.UserDetailUpdateInput
            });
        });
    }
}

export const changeRequestService = new ChangeRequestService();