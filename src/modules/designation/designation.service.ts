import prisma from '../../shared/prisma/client';
import { Prisma } from '@prisma/client';
import { AppError } from '../../middlewares/error.middleware';

export class DesignationService {
    async create(data: Prisma.DesignationUncheckedCreateInput | any) {
        if (data.organization_id === null || data.organization_id === undefined) {
            if (typeof data.department_id === 'number' && data.department_id > 0) {
                const department = await prisma.department.findUnique({
                    where: { id: data.department_id },
                    select: {
                        branches: {
                            select: {
                                organization_id: true
                            }
                        }
                    }
                });
                if (department?.branches?.organization_id) {
                    data.organization_id = department.branches.organization_id;
                }
            }
        }

        try {
            return await prisma.designation.create({
                data,
                include: {
                    department: {
                        select: { id: true, department_name: true }
                    }
                }
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new AppError('Designation code is already used for this organization.', 400);
            }
            throw error;
        }
    }

    async getAll(departmentId?: number, orgId?: number) {
        const where: any = { is_deleted: false };
        if (departmentId) {
            where.department_id = departmentId;
        }
        if (orgId) {
            where.organization_id = orgId;
        }

        const designations = await prisma.designation.findMany({
            where,
            include: {
                parent: {
                    select: {
                        id: true,
                        designation_name: true,
                        designation_code: true
                    }
                },
                secondary_parent: {
                    select: {
                        id: true,
                        designation_name: true,
                        designation_code: true
                    }
                },
                secondary_reporting_employee: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        employee_id: true,
                        user: { select: { email: true } }
                    }
                },
                department: {
                    select: {
                        id: true,
                        department_name: true
                    }
                },
                userDetails: {
                    where: { user: { is_deleted: false } },
                    select: {
                        user_id: true,
                        first_name: true,
                        last_name: true,
                        profile_picture: true,
                        employee_id: true,
                        employment_type: true,
                        joining_date: true,
                        start_date: true,
                        date_of_birth: true,
                        user: {
                            select: {
                                email: true
                            }
                        },
                        department: {
                            select: {
                                id: true,
                                department_name: true,
                                branches: {
                                    select: {
                                        id: true,
                                        branch_name: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        // Build hierarchical tree
        const designationMap = new Map<number, any>();
        designations.forEach((d: any) => {
            designationMap.set(d.id, {
                ...d,
                headcount: d.userDetails ? d.userDetails.length : 0,
                sub_designations: [],
            });
        });

        const structuredDesignations: any[] = [];
        designationMap.forEach((d: any) => {
            if (d.parent_designation_id) {
                const parent = designationMap.get(d.parent_designation_id);
                if (parent) {
                    parent.sub_designations.push(d);
                } else {
                    // Parent is in a different dept or not loaded — treat as root
                    structuredDesignations.push(d);
                }
            } else {
                structuredDesignations.push(d);
            }
        });

        return structuredDesignations;
    }

    async getById(id: number) {
        const designation = await prisma.designation.findFirst({
            where: { id, is_deleted: false },
            include: {
                parent: true,
                secondary_parent: {
                    select: {
                        id: true,
                        designation_name: true,
                        designation_code: true
                    }
                },
                secondary_reporting_employee: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        employee_id: true,
                        user: { select: { email: true } }
                    }
                },
                children: {
                    where: { is_deleted: false }
                },
                secondary_children: {
                    where: { is_deleted: false },
                    select: {
                        id: true,
                        designation_name: true,
                        designation_code: true
                    }
                },
                department: {
                    select: { id: true, department_name: true }
                },
                userDetails: {
                    where: { user: { is_deleted: false } },
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                status: true
                            }
                        },
                        department: {
                            select: {
                                id: true,
                                department_name: true,
                                branches: {
                                    select: {
                                        id: true,
                                        branch_name: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!designation) {
            throw new AppError('Designation not found', 404);
        }

        return designation;
    }

    async update(id: number, data: Prisma.DesignationUncheckedUpdateInput | any) {
        await this.getById(id);

        try {
            return await prisma.designation.update({
                where: { id },
                data,
                include: {
                    department: {
                        select: { id: true, department_name: true }
                    }
                }
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new AppError('Designation code is already used for this organization.', 400);
            }
            throw error;
        }
    }

    async delete(id: number) {
        await this.getById(id);

        // Detach primary children
        await prisma.designation.updateMany({
            where: { parent_designation_id: id },
            data: { parent_designation_id: null }
        });

        // Detach secondary children
        await prisma.designation.updateMany({
            where: { secondary_parent_designation_id: id },
            data: { secondary_parent_designation_id: null }
        });

        // Update userDetails to set designation_id to null for members of this designation
        await prisma.userDetail.updateMany({
            where: { designation_id: id },
            data: { designation_id: null }
        });

        await prisma.designation.update({
            where: { id },
            data: {
                is_deleted: true,
                deleted_at: new Date()
            }
        });

        return { message: 'Designation deleted successfully' };
    }

    async getEmployees(id: number) {
        await this.getById(id);
        return await prisma.userDetail.findMany({
            where: { designation_id: id, user: { is_deleted: false } },
            select: {
                id: true,
                user_id: true,
                first_name: true,
                last_name: true,
                employee_id: true,
                profile_picture: true,
                user: { select: { email: true } }
            }
        });
    }
}

export const designationService = new DesignationService();
