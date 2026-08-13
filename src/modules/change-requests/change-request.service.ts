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
            status: true,
            ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
            OR: [
                { roles: { some: { role: { role_name: { contains: 'HR' } } } } },
                { roles: { some: { role: { role_name: { contains: 'ADMIN' } } } } },
                { details: { role: { role_name: { contains: 'HR' } } } },
                { details: { role: { role_name: { contains: 'ADMIN' } } } }
            ]
        },
        select: { id: true }
    });
    return users.map(u => u.id);
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

        const reportingManagerId = user.details?.reporting_manager_id ?? null;
        const hasManager = !!reportingManagerId;

        const previousValues = capturePreviousValues(user, cleanChanges);
        const changedOnly: Record<string, any> = {};
        for (const [key, newValue] of Object.entries(cleanChanges)) {
            if (!areValuesEqual(key, previousValues[key], newValue)) {
                changedOnly[key] = newValue;
            }
        }
        if (Object.keys(changedOnly).length === 0) {
            throw new AppError('No changes detected — the submitted values match your current profile', 400);
        }

        const finalPrevious: Record<string, any> = {};
        for (const key of Object.keys(changedOnly)) finalPrevious[key] = previousValues[key];

        const request = await prisma.employeeChangeRequest.create({
            data: {
                user_id: userId,
                requested_changes: { ...changedOnly, _previous: finalPrevious },
                status: hasManager ? 'PENDING_MANAGER' : 'PENDING_HR',
                manager_id: hasManager ? reportingManagerId : null
            }
        });

        const employeeName = getEmployeeName(user);
        const fieldCount = Object.keys(changedOnly).length;

        if (hasManager) {
            await notificationService.create({
                user_id: reportingManagerId as number,
                title: 'Profile Change Request',
                message: `${employeeName} submitted ${fieldCount} profile change${fieldCount > 1 ? 's' : ''} awaiting your approval.`,
                type: 'PROFILE_CHANGE',
                related_module: 'profile-change',
                related_id: request.id,
                metadata: { requestId: request.id, employeeId: userId }
            });
        } else {
            const hrIds = await findHRUserIds();
            for (const hrId of hrIds) {
                await notificationService.create({
                    user_id: hrId,
                    title: 'Profile Change Request',
                    message: `${employeeName} submitted ${fieldCount} profile change${fieldCount > 1 ? 's' : ''} awaiting HR approval.`,
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
        const roleNames = await getUserRoleNames(userId);
        const isHRUser = isHR(roleNames);

        const pending = await prisma.employeeChangeRequest.findMany({
            where: {
                user_id: { not: userId },
                status: { in: ['PENDING_MANAGER', 'PENDING_HR'] }
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

        const reportingEmployees = await prisma.userDetail.findMany({
            where: { reporting_manager_id: userId },
            select: { user_id: true }
        });
        const reportingUserIds = new Set(reportingEmployees.map(e => e.user_id));

        return pending.filter((r) => {
            if (isHRUser) return true;
            return r.status === 'PENDING_MANAGER' && (r.manager_id === userId || reportingUserIds.has(r.user_id));
        });
    }

    async decide(
        requestId: number,
        actorId: number,
        action: 'approve' | 'reject',
        roleParam: 'manager' | 'hr',
        note?: string
    ) {
        const request = await requestWithUser(requestId);
        if (!request) throw new AppError('Change request not found', 404);
        if (request.status === 'APPROVED' || request.status === 'REJECTED') {
            throw new AppError('This change request has already been decided', 400);
        }

        const employeeName = getEmployeeName(request.user);
        const role = request.status === 'PENDING_HR' ? 'hr' : 'manager';

        if (role === 'manager') {
            if (request.status !== 'PENDING_MANAGER') {
                throw new AppError('This request is no longer pending manager approval', 400);
            }
            if (request.manager_id !== actorId) {
                const userDetail = await prisma.userDetail.findUnique({
                    where: { user_id: request.user_id },
                    select: { reporting_manager_id: true }
                });
                const isReportingManager = userDetail?.reporting_manager_id === actorId;
                const roleNames = await getUserRoleNames(actorId);
                if (!isReportingManager && !isHR(roleNames)) {
                    throw new AppError('You are not the assigned manager for this request', 403);
                }
            }

            if (action === 'reject') {
                const updated = await prisma.employeeChangeRequest.update({
                    where: { id: requestId },
                    data: {
                        status: 'REJECTED',
                        manager_status: 'REJECTED',
                        manager_note: note || null,
                        manager_actioned_at: new Date()
                    }
                });
                await notificationService.create({
                    user_id: request.user_id,
                    title: 'Profile Change Request Rejected',
                    message: `Your profile change request was rejected by your manager${note ? `: ${note}` : '.'}`,
                    type: 'PROFILE_CHANGE',
                    related_module: 'profile-change',
                    related_id: requestId,
                    metadata: { requestId, status: 'REJECTED', stage: 'manager' }
                });
                return updated;
            }

            const updated = await prisma.employeeChangeRequest.update({
                where: { id: requestId },
                data: {
                    status: 'PENDING_HR',
                    manager_status: 'APPROVED',
                    manager_note: note || null,
                    manager_actioned_at: new Date()
                }
            });
            await notificationService.create({
                user_id: request.user_id,
                title: 'Profile Change Request Approved by Manager',
                message: 'Your profile change request was approved by your manager and is now awaiting HR approval.',
                type: 'PROFILE_CHANGE',
                related_module: 'profile-change',
                related_id: requestId,
                metadata: { requestId, status: 'PENDING_HR', stage: 'manager' }
            });
            const hrIds = await findHRUserIds(actorId);
            for (const hrId of hrIds) {
                await notificationService.create({
                    user_id: hrId,
                    title: 'Profile Change Request Awaiting HR Approval',
                    message: `${employeeName}'s profile change request was approved by their manager and is now awaiting HR approval.`,
                    type: 'PROFILE_CHANGE',
                    related_module: 'profile-change',
                    related_id: requestId,
                    metadata: { requestId, employeeId: request.user_id, status: 'PENDING_HR', stage: 'hr' }
                });
            }
            return updated;
        }

        if (role === 'hr') {
            if (request.status !== 'PENDING_HR') {
                throw new AppError('This request is not pending HR approval', 400);
            }
            const roleNames = await getUserRoleNames(actorId);
            if (!isHR(roleNames)) {
                throw new AppError('Only HR or admin users can approve at this stage', 403);
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

        throw new AppError('Invalid approval role', 400);
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
