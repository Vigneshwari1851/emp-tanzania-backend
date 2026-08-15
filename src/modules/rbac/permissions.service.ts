import prisma from '../../shared/prisma/client';
import { AppError } from '../../middlewares/error.middleware';

export class PermissionsService {
    async listPermissionsGrouped() {
        const modules = await prisma.module.findMany({
            include: {
                permissions: true
            }
        });

        return modules.map((mod: any) => ({
            module: mod.id,
            label: mod.label,
            actions: mod.permissions.map((perm: any) => ({
                id: perm.id,
                action: perm.permission_name,
                key_name: perm.key_name,
                description: perm.description
            }))
        }));
    }

    async getMyPermissions(userId: number) {
        const userRoles = await prisma.userRole.findMany({
            where: { user_id: userId },
            include: {
                role: {
                    include: {
                        permissions: {
                            include: {
                                permission: true
                            }
                        }
                    }
                }
            }
        });

        const permissions = new Set<string>();
        userRoles.forEach(ur => {
            ur.role.permissions.forEach(rp => {
                if (rp.permission?.key_name) {
                    permissions.add(rp.permission.key_name);
                }
            });
        });

        return Array.from(permissions);
    }

    // Module CRUD
    async createModule(data: { id: string; label: string }) {
        return await prisma.module.create({ data });
    }

    async updateModule(id: string, data: { label: string }) {
        return await prisma.module.update({
            where: { id },
            data
        });
    }

    async deleteModule(id: string) {
        // Note: This will delete all permissions in the module due to relation
        return await prisma.module.delete({
            where: { id }
        });
    }

    // Permission CRUD
    async createPermission(data: { permission_name: string; key_name: string; moduleId: string; description?: string }) {
        return await prisma.permission.create({ data });
    }

    async updatePermission(id: number, data: { permission_name?: string; key_name?: string; description?: string }) {
        return await prisma.permission.update({
            where: { id },
            data
        });
    }

    async deletePermission(id: number) {
        return await prisma.permission.delete({
            where: { id }
        });
    }

    async seedRequestedHierarchy() {
        const hierarchy = [
            { id: 'dashboard', label: 'Dashboard', actions: ['view'] },
            { id: 'company_structure', label: 'Company Structure', actions: ['view', 'create', 'edit'] },
            { id: 'employee_management', label: 'Employee Management', actions: ['view', 'create', 'edit', 'delete', 'import', 'export'] },
            { id: 'department', label: 'Department', actions: ['view', 'create', 'edit', 'delete'] },
            { id: 'leave_request_pending', label: 'Leave Request - Pending', actions: ['view', 'edit'] },
            { id: 'leave_history', label: 'Leave History', actions: ['view'] },
            { id: 'leave_policies', label: 'Leave Policies', actions: ['view', 'create', 'edit', 'delete'] },
            { id: 'statistics', label: 'Statistics', actions: ['view'] },
            { id: 'attendance_tracking', label: 'Attendance Tracking', actions: ['view'] },
            { id: 'leave_request', label: 'Leave Request', actions: ['view', 'create', 'edit', 'delete'] },
            { id: 'holidays', label: 'Holidays', actions: ['view', 'create', 'edit', 'delete'] },
            { id: 'payroll', label: 'Payroll', actions: ['view', 'manage', 'process'] },
            { id: 'loans-advances', label: 'Loans & Advances', actions: ['view', 'manage'] },
            { id: 'news', label: 'Company News', actions: ['view', 'manage'] },
        ];

        for (const item of hierarchy) {
            // Upsert Module
            await prisma.module.upsert({
                where: { id: item.id },
                update: { label: item.label },
                create: { id: item.id, label: item.label }
            });

            // Upsert Permissions for this module
            for (const action of item.actions) {
                const key_name = `${item.id}.${action}`;
                await prisma.permission.upsert({
                    where: { key_name },
                    update: {
                        permission_name: action.charAt(0).toUpperCase() + action.slice(1),
                        moduleId: item.id
                    },
                    create: {
                        permission_name: action.charAt(0).toUpperCase() + action.slice(1),
                        key_name,
                        moduleId: item.id,
                        description: `Can ${action} ${item.label}`
                    }
                });
            }
        }
        return { message: 'Hierarchy seeded successfully' };
    }
}
