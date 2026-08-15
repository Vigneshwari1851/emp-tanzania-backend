import prisma from '../../shared/prisma/client';
import { Prisma } from '@prisma/client';
import { AppError } from '../../middlewares/error.middleware';
import bcrypt from 'bcrypt';

export class OrganizationService {
    async create(data: any) {
        const { branch, org_config, ...rest } = data;

        // Generate unique slug
        let slug = rest.slug || rest.entity_name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');

        let originalSlug = slug;
        let suffix = 1;
        while (true) {
            const existing = await prisma.organization.findUnique({
                where: { slug }
            });
            if (!existing) break;
            slug = `${originalSlug}-${suffix}`;
            suffix++;
        }

        return await prisma.$transaction(async (tx) => {
            // 1. Create Organization
            const org = await tx.organization.create({
                data: {
                    ...rest as Omit<Prisma.OrganizationCreateInput, 'branches'>,
                    slug,
                    branches: {
                        create: branch.map((b) => ({
                            ...b as Prisma.BranchCreateWithoutOrganizationInput,
                        }))
                    }
                },
                include: {
                    branches: true
                }
            });

            const branchRecords = org.branches;
            if (branchRecords.length === 0) {
                throw new AppError('At least one branch must be created', 400);
            }

            // 2. Fetch all system permissions to assign to admin
            const allPermissions = await tx.permission.findMany();

            // 3. Create Admin role for the organization
            const adminRole = await tx.role.create({
                data: {
                    role_name: 'admin',
                    organization_id: org.id,
                    description: `Administrator for ${org.entity_name}`,
                }
            });

            // 4. Link all permissions to the admin role
            if (allPermissions.length > 0) {
                await tx.rolePermission.createMany({
                    data: allPermissions.map(p => ({
                        role_id: adminRole.id,
                        permission_id: p.id,
                        scope: 'GLOBAL'
                    }))
                });
            }

            // 5. Seed standard roles (employee, manager, hr, finance)
            const standardRoles = ['employee', 'manager', 'hr', 'finance'];
            for (const rName of standardRoles) {
                await tx.role.create({
                    data: {
                        role_name: rName,
                        organization_id: org.id,
                        description: `${rName.toUpperCase()} role for ${org.entity_name}`
                    }
                });
            }

            // 6. Create default Administration department
            const deptAdmin = await tx.department.create({
                data: {
                    department_name: 'Administration',
                    department_code: 'ADMIN',
                    branch_id: branchRecords[0].id,
                    description: 'Corporate Administration'
                }
            });

            // 7. Create default Administrator designation
            const desigAdmin = await tx.designation.create({
                data: {
                    designation_name: 'System Administrator',
                    designation_code: 'SYSADMIN',
                    department_id: deptAdmin.id,
                    organization_id: org.id
                }
            });

            // 7.5 Create standard User Types for this organization
            const userTypesData = [
                { name: 'Admin', system_key: 'ADMIN', description: 'Administrative access' },
                { name: 'Employee', system_key: 'EMPLOYEE', description: 'Standard employee access' },
                { name: 'HR Head', system_key: 'HR_HEAD', description: 'HR department head' },
                { name: 'Finance Manager', system_key: 'FINANCE_MANAGER', description: 'Finance department manager' },
                { name: 'Manager', system_key: 'MANAGER', description: 'Reporting manager access' }
            ];

            const createdUserTypes = [];
            for (const ut of userTypesData) {
                const typeRecord = await tx.user_types.create({
                    data: {
                        organization_id: org.id,
                        name: ut.name,
                        system_key: ut.system_key,
                        description: ut.description
                    }
                });
                createdUserTypes.push(typeRecord);
            }
            const adminUserType = createdUserTypes.find(ut => ut.system_key === 'ADMIN')!;

            let adminUserId = data.user_id;
            let adminEmail = `admin@${slug}.com`;
            let adminUsername = `${slug}_admin`;

            if (adminUserId) {
                const existingUser = await tx.user.findUnique({
                    where: { id: adminUserId }
                });
                if (existingUser) {
                    adminEmail = existingUser.email;
                    adminUsername = existingUser.username || existingUser.email;
                }

                await tx.userDetail.upsert({
                    where: { user_id: adminUserId },
                    update: {
                        department_id: deptAdmin.id,
                        designation_id: desigAdmin.id,
                        role_id: adminRole.id,
                        user_type_id: adminUserType.id,
                        country: org.country || 'India',
                        employment_type: 'full-time',
                        employee_id: `${org.company_code || org.slug.toUpperCase()}-001`,
                    },
                    create: {
                        user_id: adminUserId,
                        first_name: org.entity_name,
                        last_name: 'Admin',
                        employee_id: `${org.company_code || org.slug.toUpperCase()}-001`,
                        department_id: deptAdmin.id,
                        designation_id: desigAdmin.id,
                        role_id: adminRole.id,
                        user_type_id: adminUserType.id,
                        country: org.country || 'India',
                        employment_type: 'full-time',
                        start_date: new Date(),
                        joining_date: new Date()
                    }
                });

                await tx.userRole.upsert({
                    where: { user_id_role_id: { user_id: adminUserId, role_id: adminRole.id } },
                    update: {},
                    create: {
                        user_id: adminUserId,
                        role_id: adminRole.id
                    }
                });
            } else {
                // 8. Create default Admin User
                const hashedPassword = await bcrypt.hash('admin1234', 10);
                const adminUser = await tx.user.create({
                    data: {
                        email: adminEmail,
                        username: adminUsername,
                        password: hashedPassword,
                        status: true
                    }
                });
                adminUserId = adminUser.id;

                // 9. Create UserDetail for Admin
                await tx.userDetail.create({
                    data: {
                        user_id: adminUser.id,
                        first_name: org.entity_name,
                        last_name: 'Admin',
                        employee_id: `${org.company_code || org.slug.toUpperCase()}-001`,
                        department_id: deptAdmin.id,
                        designation_id: desigAdmin.id,
                        role_id: adminRole.id,
                        user_type_id: adminUserType.id,
                        country: org.country || 'India',
                        employment_type: 'full-time',
                        start_date: new Date(),
                        joining_date: new Date()
                    }
                });

                // 10. Assign Admin role to User
                await tx.userRole.create({
                    data: {
                        user_id: adminUser.id,
                        role_id: adminRole.id
                    }
                });
            }

            // 11. Create OrganizationConfig (platform-admin settings)
            await tx.organizationConfig.create({
                data: {
                    organization_id: org.id,
                    primary_color: org_config?.primary_color ?? '#3B82F6',
                    secondary_color: org_config?.secondary_color ?? '#1E40AF',
                    custom_domain: org_config?.custom_domain ?? null,
                    sso_provider: org_config?.sso_provider ?? 'local',
                    mfa_policy: org_config?.mfa_policy ?? 'email_otp',
                    mfa_required_admins: org_config?.mfa_required_admins ?? true,
                    billing_contact: org_config?.billing_contact ?? null,
                    finance_contact: org_config?.finance_contact ?? null,
                    technical_contact: org_config?.technical_contact ?? null,
                    legal_contact: org_config?.legal_contact ?? null,
                    theme: org_config?.theme ?? 'light',
                    language: org_config?.language ?? 'en-IN',
                    date_format: org_config?.date_format ?? 'DD/MM/YYYY',
                    week_start_day: org_config?.week_start_day ?? 'monday',
                    default_landing_page: org_config?.default_landing_page ?? 'dashboard',
                    email_notifications: org_config?.email_notifications ?? true,
                    sms_notifications: org_config?.sms_notifications ?? false,
                    in_app_notifications: org_config?.in_app_notifications ?? true,
                    webhooks_enabled: org_config?.webhooks_enabled ?? false,
                    notification_frequency: org_config?.notification_frequency ?? 'daily',
                    maintenance_day: org_config?.maintenance_day ?? 'Saturday',
                    maintenance_start: org_config?.maintenance_start ?? '02:00',
                    maintenance_end: org_config?.maintenance_end ?? '06:00',
                    backup_frequency: org_config?.backup_frequency ?? 'daily',
                    backup_retention_days: org_config?.backup_retention_days ?? 30,
                    rpo_minutes: org_config?.rpo_minutes ?? 60,
                    rto_minutes: org_config?.rto_minutes ?? 240,
                }
            });

            return {
                ...org,
                admin_credentials: {
                    email: adminEmail,
                    password: 'admin1234',
                    username: `${slug}_admin`,
                }
            };
        });
    }

    // FIX: Changed from findFirst to findMany to return all organizations as an array.
    // Previously findFirst returned a single object/null causing frontend crash (null.length).
    async getAll() {
        const organizations = await prisma.organization.findMany({
            where: { is_deleted: false },
            include: {
                config: true,
                branches: {
                    where: { is_deleted: false },
                    select: {
                        id: true,
                        organization_id: true,
                        branch_name: true,
                        branch_code: true,
                        address: true,
                        city: true,
                        state: true,
                        country: true,
                        zip: true,
                        time_zone: true,
                        tax_location: true,
                        gst: true,
                        created_at: true,
                        updated_at: true,
                        department: {
                            where: { is_deleted: false },
                            select: {
                                id: true,
                                department_name: true,
                                department_code: true,
                                description: true,
                                parent_department_id: true,
                                annual_budget: true,
                                manager_id: true,
                                cost_center: true,
                                created_at: true,
                                updated_at: true,
                                team: {
                                    where: { is_deleted: false },
                                    select: {
                                        id: true,
                                        team_name: true,
                                        description: true,
                                        team_lead_id: true,
                                        users: {
                                            select: { username: true }
                                        },
                                        userDetails: {
                                            select: {
                                                user_id: true,
                                                first_name: true,
                                                last_name: true,
                                                profile_picture: true,
                                                role: {
                                                    select: { role_name: true }
                                                }
                                            }
                                        }
                                    }
                                },
                                users: {
                                    select: { 
                                        id: true, 
                                        username: true, 
                                        is_deleted: true,
                                        details: {
                                            select: {
                                                first_name: true,
                                                last_name: true
                                            }
                                        }
                                    }
                                },
                                userDetails: {
                                    include: { user: { select: { id: true, is_deleted: true } } }
                                },
                                _count: {
                                    select: {
                                        userDetails: { where: { user: { is_deleted: false } } }
                                    }
                                }
                            }
                        }
                    }
                },
                _count: {
                    select: { branches: true }
                }
            }
        });

        if (!organizations || organizations.length === 0) return [];

        return organizations.map((organization: any) => {
            const organizationUserIds = new Set<number>();
            const org = organization as any;
            const branches_count = org.branches.length;

            const mappedBranches = org.branches.map((branch: any) => {
                const branchUserIds = new Set<number>();

                const mappedDepartments = branch.department.map((dept: any) => {
                    const uniqueUserIds = new Set<number>();

                    if ((dept as any).userDetails) {
                        (dept as any).userDetails.forEach((ud: any) => {
                            if (ud.user && !ud.user.is_deleted) {
                                uniqueUserIds.add(ud.user.id);
                            }
                        });
                    }

                    uniqueUserIds.forEach(id => branchUserIds.add(id));

                    return {
                        id: dept.id,
                        department_name: dept.department_name,
                        department_code: dept.department_code,
                        description: dept.description,
                        parent_department_id: dept.parent_department_id,
                        annual_budget: dept.annual_budget,
                        manager_id: dept.manager_id,
                        cost_center: dept.cost_center,
                        manager: dept.users ? {
                            id: dept.users.id,
                            username: dept.users.username,
                            full_name: dept.users.details 
                                ? `${dept.users.details.first_name || ""} ${dept.users.details.last_name || ""}`.trim() 
                                : dept.users.username
                        } : null,
                        created_at: dept.created_at,
                        updated_at: dept.updated_at,
                        department_employee_count: uniqueUserIds.size,
                        userDetails: dept.userDetails || [],
                        teams: dept.team.map((team: any) => {
                            return {
                                id: team.id,
                                team_name: team.team_name,
                                description: team.description,
                                team_lead_id: team.team_lead_id,
                                team_lead: team.users ? { username: team.users.username } : null,
                                team_members: (team as any).userDetails || []
                            };
                        }),
                    };
                });

                const departmentMap = new Map<number, any>();
                mappedDepartments.forEach((dept: any) => {
                    departmentMap.set(dept.id, { ...dept, sub_departments: [] });
                });

                const structuredDepartments: any[] = [];
                departmentMap.forEach((dept: any) => {
                    if (dept.parent_department_id) {
                        const parent = departmentMap.get(dept.parent_department_id);
                        if (parent) {
                            parent.sub_departments.push(dept);
                        } else {
                            structuredDepartments.push(dept);
                        }
                    } else {
                        structuredDepartments.push(dept);
                    }
                });

                branchUserIds.forEach(id => organizationUserIds.add(id));

                const { department: _, ...branchData } = branch;

                return {
                    ...branchData,
                    departments: structuredDepartments,
                    branch_employee_count: branchUserIds.size,
                };
            });

            const { _count, branches, ...orgDetails } = org;

            return {
                ...orgDetails,
                branches: mappedBranches,
                branches_count: branches_count,
                total_employees: organizationUserIds.size,
            };
        });
    }


    async getById(id: number) {
        const organization = await prisma.organization.findFirst({
            where: { id, is_deleted: false },
            include: {
                branches: {
                    where: { is_deleted: false }
                }
            }
        });

        if (!organization) {
            throw new AppError('Organization not found', 404);
        }

        return organization;
    }

    async getBySlug(slug: string) {
        const organization = await prisma.organization.findFirst({
            where: { slug, is_deleted: false },
            include: {
                config: true
            }
        });

        if (!organization) {
            throw new AppError('Organization not found', 404);
        }

        return organization;
    }

    async update(id: number, data: Partial<Prisma.OrganizationUncheckedCreateInput> & { branch?: (Prisma.BranchCreateWithoutOrganizationInput & { id?: number })[] }) {
        const { branch, org_config, ...rest } = data as any;

        // Verify existence
        await this.getById(id);

        if (rest.company_code && !rest.slug) {
            rest.slug = rest.company_code.toLowerCase().replace(/[^a-z0-9.-]/g, '-');
        }

        if (branch) {
            const branchIds = branch.map(b => b.id).filter(val => val !== undefined) as number[];
           
            // Soft delete branches not in the payload
            await prisma.branch.updateMany({
                where: {
                    organization_id: id,
                    id: { notIn: branchIds },
                    is_deleted: false
                },
                data: {
                    is_deleted: true,
                    deleted_at: new Date()
                }
            });
        }

        if (org_config) {
            await prisma.organizationConfig.upsert({
                where: { organization_id: id },
                update: {
                    primary_color: org_config.primary_color,
                    secondary_color: org_config.secondary_color,
                    custom_domain: org_config.custom_domain,
                    sso_provider: org_config.sso_provider,
                    mfa_policy: org_config.mfa_policy,
                    mfa_required_admins: org_config.mfa_required_admins,
                    billing_contact: org_config.billing_contact,
                    finance_contact: org_config.finance_contact,
                    technical_contact: org_config.technical_contact,
                    legal_contact: org_config.legal_contact,
                    theme: org_config.theme,
                    language: org_config.language,
                    date_format: org_config.date_format,
                    week_start_day: org_config.week_start_day,
                    default_landing_page: org_config.default_landing_page,
                    email_notifications: org_config.email_notifications,
                    sms_notifications: org_config.sms_notifications,
                    in_app_notifications: org_config.in_app_notifications,
                    webhooks_enabled: org_config.webhooks_enabled,
                    notification_frequency: org_config.notification_frequency,
                    maintenance_day: org_config.maintenance_day,
                    maintenance_start: org_config.maintenance_start,
                    maintenance_end: org_config.maintenance_end,
                    backup_frequency: org_config.backup_frequency,
                    backup_retention_days: org_config.backup_retention_days,
                    rpo_minutes: org_config.rpo_minutes,
                    rto_minutes: org_config.rto_minutes,
                },
                create: {
                    organization_id: id,
                    primary_color: org_config.primary_color ?? '#3B82F6',
                    secondary_color: org_config.secondary_color ?? '#1E40AF',
                    custom_domain: org_config.custom_domain ?? null,
                    sso_provider: org_config.sso_provider ?? 'local',
                    mfa_policy: org_config.mfa_policy ?? 'email_otp',
                    mfa_required_admins: org_config.mfa_required_admins ?? true,
                    billing_contact: org_config.billing_contact ?? null,
                    finance_contact: org_config.finance_contact ?? null,
                    technical_contact: org_config.technical_contact ?? null,
                    legal_contact: org_config.legal_contact ?? null,
                    theme: org_config.theme ?? 'light',
                    language: org_config.language ?? 'en-IN',
                    date_format: org_config.date_format ?? 'DD/MM/YYYY',
                    week_start_day: org_config.week_start_day ?? 'monday',
                    default_landing_page: org_config.default_landing_page ?? 'dashboard',
                    email_notifications: org_config.email_notifications ?? true,
                    sms_notifications: org_config.sms_notifications ?? false,
                    in_app_notifications: org_config.in_app_notifications ?? true,
                    webhooks_enabled: org_config.webhooks_enabled ?? false,
                    notification_frequency: org_config.notification_frequency ?? 'daily',
                    maintenance_day: org_config.maintenance_day ?? 'Saturday',
                    maintenance_start: org_config.maintenance_start ?? '02:00',
                    maintenance_end: org_config.maintenance_end ?? '06:00',
                    backup_frequency: org_config.backup_frequency ?? 'daily',
                    backup_retention_days: org_config.backup_retention_days ?? 30,
                    rpo_minutes: org_config.rpo_minutes ?? 60,
                    rto_minutes: org_config.rto_minutes ?? 240,
                }
            });
        }

        return await prisma.organization.update({
            where: { id },
            data: {
                ...rest as any,
                branches: branch ? {
                    upsert: branch.map((b) => ({
                        where: { id: b.id || 0 },
                        update: {
                            branch_name: b.branch_name,
                            branch_code: b.branch_code,
                            address: b.address,
                            city: b.city,
                            state: b.state,
                            zip: b.zip,
                            country: b.country,
                            time_zone: b.time_zone,
                            tax_location: b.tax_location,
                            gst: b.gst,
                            is_deleted: false, // Ensure it's not deleted if being upserted
                        },
                        create: {
                            branch_name: b.branch_name,
                            branch_code: b.branch_code,
                            address: b.address,
                            city: b.city,
                            state: b.state,
                            zip: b.zip,
                            country: b.country,
                            time_zone: b.time_zone,
                            tax_location: b.tax_location,
                            gst: b.gst,
                        }
                    }))
                } : undefined
            },
            include: {
                config: true,
                branches: {
                    where: { is_deleted: false }
                }
            }
        });
    }

    async delete(id: number) {
        await this.getById(id);

        await prisma.organization.update({
            where: { id },
            data: {
                is_deleted: true,
                deleted_at: new Date()
            }
        });

        // Cascading Soft Delete branches
        await prisma.branch.updateMany({
            where: { organization_id: id },
            data: { is_deleted: true, deleted_at: new Date() }
        });

        return { message: 'Organization deleted successfully' };
    }

    async getShifts(id: number) {
        const organization = await prisma.organization.findFirst({
            where: { id, is_deleted: false },
            select: { shifts: true }
        });

        if (!organization) {
            throw new AppError('Organization not found', 404);
        }

        // Shifts is stored as JSON in Prisma, we return it as an array
        return (organization.shifts as any) || [];
    }

    async updateShift(id: number, shiftId: string, shiftData: any) {
        const organization = await prisma.organization.findFirst({
            where: { id, is_deleted: false },
            select: { shifts: true }
        });

        if (!organization) {
            throw new AppError('Organization not found', 404);
        }

        let shifts = (organization.shifts as any[]) || [];
        const shiftIndex = shifts.findIndex(s => s.id === shiftId);
        if (shiftIndex === -1) {
            throw new AppError('Shift not found', 404);
        }

        const { name, startTime, endTime, breakTime, icon, color } = shiftData;

        const [sH, sM] = startTime.split(':').map(Number);
        const [eH, eM] = endTime.split(':').map(Number);
        let startTotal = sH * 60 + sM;
        let endTotal = eH * 60 + eM;
        if (endTotal <= startTotal) endTotal += 1440;
        const totalMins = endTotal - startTotal - (breakTime || 0);

        if (totalMins <= 0) {
            throw new AppError('Invalid shift time range. Total duration must be positive.', 400);
        }

        const totalHours = totalMins / 60;

        const updatedShift = {
            ...shifts[shiftIndex],
            name,
            startTime,
            endTime,
            breakTime: breakTime ?? shifts[shiftIndex].breakTime,
            totalHours,
            icon: icon ?? shifts[shiftIndex].icon,
            color: color ?? shifts[shiftIndex].color
        };

        shifts[shiftIndex] = updatedShift;

        await prisma.organization.update({
            where: { id },
            data: { shifts: shifts as any }
        });

        return updatedShift;
    }
}

export const organizationService = new OrganizationService();
