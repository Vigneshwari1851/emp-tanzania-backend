import prisma from '../../shared/prisma/client';
import { AppError } from '../../middlewares/error.middleware';

export class UserTypeService {
  async create(data: { name: string; system_key: string; description?: string; organization_id: number }) {
    const existing = await prisma.user_types.findFirst({
      where: { organization_id: data.organization_id, name: data.name },
    });
    if (existing) throw new AppError('User type with this name already exists in this organization', 409);

    return await prisma.user_types.create({
      data: {
        name: data.name,
        system_key: data.system_key,
        description: data.description || null,
        organization_id: data.organization_id,
      },
    });
  }

  async getAll(organizationId: number) {
    return await prisma.user_types.findMany({
      where: { organization_id: organizationId },
      include: { _count: { select: { user_details: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: number) {
    const ut = await prisma.user_types.findUnique({
      where: { id },
      include: {
        _count: { select: { user_details: true } },
        user_type_permissions: {
          include: { permissions: { include: { module: true } } },
        },
      },
    });
    if (!ut) throw new AppError('User type not found', 404);
    return ut;
  }

  async update(id: number, data: { name?: string; system_key?: string; description?: string }) {
    await this.getById(id);
    return await prisma.user_types.update({ where: { id }, data });
  }

  async delete(id: number) {
    await this.getById(id);
    const count = await prisma.userDetail.count({ where: { user_type_id: id } });
    if (count > 0) throw new AppError(`Cannot delete user type: ${count} users are assigned to it`, 400);

    await prisma.user_type_permissions.deleteMany({ where: { user_type_id: id } });
    await prisma.user_types.delete({ where: { id } });
    return { message: 'User type deleted successfully' };
  }

  async getModules() {
    return await prisma.module.findMany({
      include: {
        permissions: { select: { id: true, permission_name: true, key_name: true } },
      },
      orderBy: { label: 'asc' },
    });
  }

  async getAssignedModules(userTypeId: number) {
    await this.getById(userTypeId);
    const assignments = await prisma.user_type_permissions.findMany({
      where: { user_type_id: userTypeId },
      include: {
        permissions: { select: { id: true, moduleId: true } },
      },
    });

    const moduleIds = [...new Set(assignments.map(a => a.permissions.moduleId).filter(Boolean))] as string[];
    return moduleIds;
  }

  async updateAssignedModules(userTypeId: number, moduleIds: string[]) {
    await this.getById(userTypeId);

    const allPermissions = await prisma.permission.findMany({
      where: { moduleId: { in: moduleIds } },
      select: { id: true },
    });

    const targetPermissionIds = allPermissions.map(p => p.id);

    await prisma.$transaction(async (tx: any) => {
      await tx.user_type_permissions.deleteMany({ where: { user_type_id: userTypeId } });
      if (targetPermissionIds.length > 0) {
        await tx.user_type_permissions.createMany({
          data: targetPermissionIds.map(permission_id => ({
            user_type_id: userTypeId,
            permission_id,
          })),
        });
      }
    });

    return moduleIds;
  }
}

export const userTypeService = new UserTypeService();
