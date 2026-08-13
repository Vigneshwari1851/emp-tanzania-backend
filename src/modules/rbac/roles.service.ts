import prisma from '../../shared/prisma/client';
import { AppError } from '../../middlewares/error.middleware';
import { PermissionScope } from '@prisma/client';

export class RolesService {
    // --- Role Management ---
    async createRole(data: { name: string, description?: string, status?: boolean, permission_ids?: { id: number, scope: PermissionScope }[], orgId?: number }) {
        const roleName = data.name.toLowerCase();
        const existingRole = await prisma.role.findFirst({
            where: {
                role_name: roleName,
                organization_id: data.orgId || null
            }
        });
        if (existingRole) {
            throw new AppError('Role already exists for this organization', 400);
        }

        return await prisma.$transaction(async (tx) => {
            const role = await tx.role.create({
                data: {
                    role_name: roleName,
                    description: data.description,
                    status: data.status ?? true,
                    organization_id: data.orgId || null,
                },
            });

            if (data.permission_ids && data.permission_ids.length > 0) {
                await tx.rolePermission.createMany({
                    data: data.permission_ids.map(p => ({
                        role_id: role.id,
                        permission_id: p.id,
                        scope: p.scope || 'GLOBAL',
                    })),
                });
            }

            return role;
        });
    }

    async listRoles(query: { search?: string, status?: boolean, orgId?: number }) {
        const where: any = {};
        if (query.search) {
            where.role_name = { contains: query.search };
        }
        if (query.status !== undefined) {
            where.status = query.status;
        }
        if (query.orgId) {
            where.OR = [
                { organization_id: query.orgId },
                { organization_id: null }
            ];
        }

        const roles = await prisma.role.findMany({
            where,
            include: {
                _count: {
                    select: { users: true }
                }
            },
            orderBy: {
                created_at: 'asc'
            }
        });

        return roles.map(role => ({
            id: role.id,
            name: role.role_name,
            description: role.description,
            status: role.status,
            user_count: role._count.users,
            created_at: role.created_at
        }));
    }

    async getRoleById(id: number, orgId?: number) {
        const role = await prisma.role.findUnique({
            where: { id },
            include: {
                permissions: {
                    include: {
                        permission: {
                            include: { module: true }
                        }
                    }
                }
            }
        });
        if (!role) throw new AppError('Role not found', 404);

        if (orgId && role.organization_id && role.organization_id !== orgId) {
            throw new AppError('Unauthorized: Access denied to this role', 403);
        }

        return {
            id: role.id,
            name: role.role_name,
            description: role.description,
            status: role.status,
            permissions: role.permissions.map(rp => ({
                id: rp.permission.id,
                module: rp.permission.module?.id || 'unknown',
                action: rp.permission.permission_name,
                key_name: rp.permission.key_name,
                scope: rp.scope
            }))
        };
    }

    async updateRole(id: number, data: { name?: string, description?: string, status?: boolean }, orgId?: number) {
        const existingRole = await prisma.role.findUnique({ where: { id } });
        if (!existingRole) throw new AppError('Role not found', 404);

        if (orgId && existingRole.organization_id && existingRole.organization_id !== orgId) {
            throw new AppError('Unauthorized: Access denied to this role', 403);
        }

        if (data.name) {
            const nameLower = data.name.toLowerCase();
            const existing = await prisma.role.findFirst({
                where: {
                    role_name: nameLower,
                    organization_id: orgId || null,
                    NOT: { id }
                }
            });
            if (existing) throw new AppError('Role name already in use', 400);
        }

        return await prisma.role.update({
            where: { id },
            data: {
                role_name: data.name?.toLowerCase(),
                description: data.description,
                status: data.status
            }
        });
    }

    async deleteRole(id: number, orgId?: number) {
        const role = await prisma.role.findUnique({ where: { id } });
        if (!role) throw new AppError('Role not found', 404);

        if (orgId && role.organization_id && role.organization_id !== orgId) {
            throw new AppError('Unauthorized: Access denied to this role', 403);
        }
        
        if (role.role_name === 'super admin') {
            throw new AppError('Cannot delete Super Admin role', 403);
        }

        // Optional: Check if users are assigned
        const userCount = await prisma.userRole.count({ where: { role_id: id } });
        if (userCount > 0) {
            throw new AppError('Cannot delete role with assigned users', 400);
        }

        await prisma.role.delete({ where: { id } });
        return { message: 'Role deleted successfully' };
    }

    // --- Bulk Permission Mapping ---
    async updateRolePermissions(roleId: number, permissions: { id: number, scope: PermissionScope }[], orgId?: number) {
        const role = await prisma.role.findUnique({ where: { id: roleId } });
        if (!role) throw new AppError('Role not found', 404);

        if (orgId && role.organization_id && role.organization_id !== orgId) {
            throw new AppError('Unauthorized: Access denied to this role', 403);
        }

        // Verify all permissions exist
        const permissionIds = permissions.map(p => p.id);
        const validPermissions = await prisma.permission.findMany({
            where: { id: { in: permissionIds } }
        });

        if (validPermissions.length !== permissions.length) {
            throw new AppError('One or more permission IDs are invalid', 400);
        }

        return await prisma.$transaction(async (tx) => {
            // Delete existing mappings
            await tx.rolePermission.deleteMany({ where: { role_id: roleId } });

            // Create new mappings
            await tx.rolePermission.createMany({
                data: permissions.map(p => ({
                    role_id: roleId,
                    permission_id: p.id,
                    scope: p.scope || 'GLOBAL'
                }))
            });

            return { success: true, message: 'Permissions updated successfully' };
        });
    }

    async listAllPermissions() {
        const permissions = await prisma.permission.findMany({
            orderBy: { id: 'asc' }
        });
        return permissions.map(p => ({
            id: p.id,
            permission_name: p.key_name || p.permission_name,
            description: p.description || '',
            created_at: p.created_at,
            updated_at: p.updated_at
        }));
    }

    async getRolePermissions(roleId: number) {
        const role = await prisma.role.findUnique({ where: { id: roleId } });
        if (!role) throw new AppError('Role not found', 404);

        const rolePermissions = await prisma.rolePermission.findMany({
            where: { role_id: roleId },
            include: { permission: true }
        });

        return rolePermissions.map(rp => ({
            id: rp.permission.id,
            permission_name: rp.permission.key_name || rp.permission.permission_name,
            description: rp.permission.description || '',
            scope: rp.scope
        }));
    }
}
