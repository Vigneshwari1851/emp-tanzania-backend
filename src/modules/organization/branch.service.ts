import prisma from '../../shared/prisma/client';
import { Prisma } from '@prisma/client';
import { AppError } from '../../middlewares/error.middleware';

export class BranchService {
    async getAll(orgId?: number) {
        const where: any = { is_deleted: false };
        if (orgId) where.organization_id = orgId;
        const branches = await prisma.branch.findMany({
            where,
            include: {
                organization: {
                    select: {
                        id: true,
                        entity_name: true
                    }
                },
                _count: { select: { department: true } }
            }
        });
        return branches;
    }

    async getById(id: number) {
        const branch = await prisma.branch.findFirst({
            where: { id, is_deleted: false },
            include: {
                organization: {
                    select: {
                        id: true,
                        entity_name: true
                    }
                },
                _count: { select: { department: true } }
            }
        });

        if (!branch) {
            throw new AppError('Branch not found', 404);
        }

        return branch;
    }

    async create(data: Prisma.BranchUncheckedCreateInput) {
        // Validate Organization
        const organizationExists = await prisma.organization.findUnique({
            where: { id: data.organization_id }
        });

        if (!organizationExists) {
            throw new AppError('Invalid organization_id. The specified organization does not exist.', 400);
        }

        const branch = await prisma.branch.create({
            data
        });

        return branch;
    }

    async update(id: number, data: Prisma.BranchUncheckedUpdateInput) {
        const branchExists = await prisma.branch.findFirst({
            where: { id, is_deleted: false }
        });

        if (!branchExists) {
            throw new AppError('Branch not found', 404);
        }

        if (data.organization_id) {
            const organizationExists = await prisma.organization.findUnique({
                where: { id: Number(data.organization_id) }
            });

            if (!organizationExists) {
                throw new AppError('Invalid organization_id. The specified organization does not exist.', 400);
            }
        }

        const updatedBranch = await prisma.branch.update({
            where: { id },
            data
        });

        return updatedBranch;
    }

    async delete(id: number) {
        const branchExists = await prisma.branch.findFirst({
            where: { id, is_deleted: false }
        });

        if (!branchExists) {
            throw new AppError('Branch not found', 404);
        }

        // Soft delete
        await prisma.branch.update({
            where: { id },
            data: { 
                is_deleted: true,
                deleted_at: new Date()
            }
        });

        // Cascade soft delete departments
        await prisma.department.updateMany({
            where: { branch_id: id, is_deleted: false },
            data: { 
                is_deleted: true,
                deleted_at: new Date()
            }
        });

        return { message: 'Branch deleted successfully' };
    }
}

export const branchService = new BranchService();
