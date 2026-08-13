import prisma from '../../shared/prisma/client';
import { Prisma } from '@prisma/client';
import { AppError } from '../../middlewares/error.middleware';

export class DepartmentService {
    async getAll(orgId?: number) {
        const where: any = { is_deleted: false };
        if (orgId) {
            where.branches = { organization_id: orgId };
        }
        const departments = await prisma.department.findMany({
            where,
            include: {
                team: {
                    where: { is_deleted: false },
                    select: {
                        id: true,
                        team_name: true,
                        description: true,
                        team_lead_id: true,

                        users: {
                            select: { 
                                id: true, 
                                username: true,
                                details: {
                                    select: {
                                        first_name: true,
                                        last_name: true,
                                        profile_picture: true,
                                    }
                                }
                            }
                        },
                        userDetails: {
                            select: {
                                first_name: true,
                                last_name: true,
                                profile_picture: true,
                                user: { select: { username: true } }
                            }
                        },
                        _count: {
                            select: { userDetails: true }
                        }
                    }
                },
                users: {
                    select: {
                        username: true,
                        id: true,
                        is_deleted: true,
                        details: {
                            select: {
                                first_name: true,
                                last_name: true,
                                profile_picture: true
                            }
                        }
                    }
                },
                userDetails: {
                    include: { 
                        user: { select: { id: true, is_deleted: true } },
                        designation: { select: { id: true, designation_name: true, designation_code: true } }
                    }
                },
                _count: {
                    select: {
                        team: { where: { is_deleted: false } },
                        userDetails: { where: { user: { is_deleted: false } } }
                    }
                }
            }
        });

        return departments.map(dept => this._formatDepartment(dept));
    }

    private _formatDepartment(dept: any) {
        if (!dept) return null;

        const uniqueUserIds = new Set<number>();

        // Use userDetails (Employee Profiles) as the single source of truth for headcount
        if (dept.userDetails) {
            dept.userDetails.forEach((ud: any) => {
                const userId = ud.user_id || ud.user?.id;
                const isDeleted = ud.user ? ud.user.is_deleted : false; // Safe default
                if (userId && !isDeleted) {
                    uniqueUserIds.add(userId);
                }
            });
        }

        const count = uniqueUserIds.size;

        const managerObj = dept.users ? {
            id: dept.users.id,
            username: dept.users.username,
            name: dept.users.details 
                ? `${dept.users.details.first_name || ''} ${dept.users.details.last_name || ''}`.trim() || dept.users.username
                : dept.users.username,
            full_name: dept.users.details 
                ? `${dept.users.details.first_name || ''} ${dept.users.details.last_name || ''}`.trim() || dept.users.username
                : dept.users.username,
            profile_picture: dept.users.details?.profile_picture || null
        } : null;

        const formattedTeams = (dept.team || []).map((team: any) => ({
            id: team.id,
            team_name: team.team_name,
            description: team.description,
            team_lead_id: team.team_lead_id,
            members_count: team._count?.userDetails || 0,
            team_employee_count: team._count?.userDetails || team.userDetails?.length || 0,
            members: team.userDetails || [],
            team_lead: team.users
                ? { username: team.users.username }
                : null
        }));

        return {
            ...dept,
            headcount: count,
            people_count: count,
            department_employee_count: count,
            manager: managerObj,
            team: formattedTeams,
            teams: formattedTeams
        };
    }

    async getById(id: number) {
        const department = await prisma.department.findFirst({
            where: { id, is_deleted: false },
            include: {
                team: {
                    where: { is_deleted: false },
                    select: {
                        id: true,
                        team_name: true,
                        description: true,
                        team_lead_id: true,

                        users: {
                            select: { 
                                id: true, 
                                username: true,
                                details: {
                                    select: {
                                        first_name: true,
                                        last_name: true,
                                        profile_picture: true,
                                    }
                                }
                            }
                        },
                        userDetails: {
                            select: {
                                first_name: true,
                                last_name: true,
                                profile_picture: true,
                                user: { select: { username: true } }
                            }
                        },
                        _count: {
                            select: { userDetails: true }
                        }
                    }
                },
                users: {
                    select: {
                        username: true,
                        id: true,
                        is_deleted: true,
                        details: {
                            select: {
                                first_name: true,
                                last_name: true,
                                profile_picture: true
                            }
                        }
                    }
                },
                userDetails: {
                    include: { 
                        user: { select: { id: true, is_deleted: true } },
                        designation: { select: { id: true, designation_name: true, designation_code: true } }
                    }
                },
                _count: {
                    select: {
                        team: { where: { is_deleted: false } },
                        userDetails: { where: { user: { is_deleted: false } } }
                    }
                }
            }
        });

        return this._formatDepartment(department);
    }

    async create(data: Prisma.departmentUncheckedCreateInput & { teams?: any[] }) {
        const { teams, ...departmentData } = data;

        // FK Validations
        const branchExists = await prisma.branch.findUnique({ where: { id: departmentData.branch_id } });
        if (!branchExists) throw new AppError('Invalid branch_id. The specified branch does not exist.', 400);

        if (departmentData.manager_id) {
            const managerExists = await prisma.user.findUnique({ where: { id: departmentData.manager_id } });
            if (!managerExists) throw new AppError('Invalid manager_id. The specified user does not exist.', 400);
        }

        return await prisma.$transaction(async (tx) => {
            const department = await tx.department.create({
                data: departmentData as Prisma.departmentUncheckedCreateInput
            });

            if (teams && teams.length > 0) {
                const { teamService } = await import('./team.service');
                for (const team of teams) {
                    const teamName = team.team_name || team.team_details?.team_name;
                    const description = team.description || team.team_details?.description;
                    const teamLead = team.team_lead_id || team.team_details?.team_lead_user_id;

                    await teamService.create({
                        department_id: department.id,
                        team_name: teamName,
                        description: description,
                        team_lead_id: teamLead,
                        updated_at: new Date()
                    }, tx);
                }
            }

            const result = await tx.department.findUnique({
                where: { id: department.id },
                include: {
                    users: {
                        select: {
                            username: true,
                            id: true,
                            is_deleted: true,
                            details: {
                                select: {
                                    first_name: true,
                                    last_name: true,
                                    profile_picture: true
                                }
                            }
                        }
                    },
                    _count: {
                        select: {
                            team: { where: { is_deleted: false } },
                            userDetails: { where: { user: { is_deleted: false } } }
                        }
                    },
                    team: {
                        include: {
                            users: { 
                                select: { 
                                    id: true, 
                                    username: true,
                                    details: {
                                        select: {
                                            first_name: true,
                                            last_name: true,
                                            profile_picture: true,
                                        }
                                    }
                                } 
                            },
                            userDetails: {
                                select: {
                                    first_name: true,
                                    last_name: true,
                                    profile_picture: true,
                                    user: { select: { username: true } }
                                }
                            },
                            _count: {
                                select: { userDetails: true }
                            }
                        }
                    },
                    userDetails: { // Corrected nesting
                        include: { 
                            user: { select: { id: true, is_deleted: true } },
                            designation: { select: { id: true, designation_name: true, designation_code: true } }
                        }
                    }
                }
            });
            return this._formatDepartment(result);
        });
    }

    async update(id: number, data: Partial<Prisma.departmentUncheckedCreateInput> & { teams?: any[] }) {
        const { teams, ...departmentData } = data;

        // FK Validations
        if (departmentData.branch_id) {
            const branchExists = await prisma.branch.findUnique({ where: { id: departmentData.branch_id } });
            if (!branchExists) throw new AppError('Invalid branch_id. The specified branch does not exist.', 400);
        }

        if (departmentData.manager_id) {
            const managerExists = await prisma.user.findUnique({ where: { id: departmentData.manager_id } });
            if (!managerExists) throw new AppError('Invalid manager_id. The specified user does not exist.', 400);
        }

        return await prisma.$transaction(async (tx) => {
            // Update department
            await tx.department.update({
                where: { id },
                data: departmentData as Prisma.departmentUncheckedUpdateInput
            });

            if (teams && teams.length) {
                const { teamService } = await import('./team.service');
                for (const team of teams) {
                    const teamName = team.team_name || team.team_details?.team_name;
                    const description = team.description || team.team_details?.description;
                    const teamLead = team.team_lead_id || team.team_details?.team_lead_user_id;

                    if (team.id) {
                        // Update existing team
                        await teamService.update(team.id, {
                            team_name: teamName,
                            description: description,
                            team_lead_id: teamLead
                        }, tx);
                    } else {
                        // Create new team
                        await teamService.create({
                            department_id: id,
                            team_name: teamName,
                            description: description,
                            team_lead_id: teamLead,
                            updated_at: new Date()
                        }, tx);
                    }
                }
            }

            // Return updated department with relations
            const result = await tx.department.findUnique({
                where: { id },
                include: {
                    team: {
                        select: {
                            id: true,
                            team_name: true,
                            description: true,
                            team_lead_id: true,
                            users: {
                                select: { 
                                    id: true, 
                                    username: true, 
                                    is_deleted: true,
                                    details: {
                                        select: {
                                            first_name: true,
                                            last_name: true,
                                            profile_picture: true,
                                        }
                                    }
                                }
                            },
                            userDetails: {
                                select: {
                                    first_name: true,
                                    last_name: true,
                                    profile_picture: true,
                                    user: { select: { username: true } }
                                }
                            },
                            _count: {
                                select: { userDetails: true }
                            }
                        }
                    },
                    users: {
                        select: {
                            username: true,
                            id: true,
                            is_deleted: true,
                            details: {
                                select: {
                                    first_name: true,
                                    last_name: true,
                                    profile_picture: true
                                }
                            }
                        }
                    },
                    userDetails: {
                        include: { 
                            user: { select: { id: true, is_deleted: true } },
                            designation: { select: { id: true, designation_name: true, designation_code: true } }
                        }
                    },
                    _count: {
                        select: {
                            team: { where: { is_deleted: false } },
                            userDetails: { where: { user: { is_deleted: false } } }
                        }
                    }
                }
            });
            return this._formatDepartment(result);
        });
    }

    async delete(id: number) {
        // Check if department exists
        const department = await prisma.department.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        userDetails: true,
                        team: {
                            where: { is_deleted: false }
                        }
                    }
                }
            }
        });

        if (!department) {
            throw new AppError('Department not found', 404);
        }

        // Deletion Guard: Check for active employees
        if (department._count.userDetails > 0) {
            throw new AppError(`Cannot delete department. There are ${department._count.userDetails} active employees assigned to it.`, 400);
        }

        // Deletion Guard: Check for active teams
        if (department._count.team > 0) {
            throw new AppError(`Cannot delete department. It contains ${department._count.team} active teams. Please remove or reassign them first.`, 400);
        }

        // Perform soft delete
        await prisma.department.update({
            where: { id },
            data: { is_deleted: true, deleted_at: new Date() }
        });

        return { message: 'Department deleted successfully' };
    }
    async getDepartmentManager(departmentId: number) {
        const department = await prisma.department.findUnique({
            where: { id: departmentId, is_deleted: false },
            select: {
                users: {
                    select: {
                        id: true,
                        username: true,
                        details: {
                            select: {
                                first_name: true,
                                last_name: true
                            }
                        }
                    }
                }
            }
        });

        if (!department) {
            throw new AppError('Department not found', 404);
        }

        if (!department.users) {
            return null;
        }

        const firstName = department.users.details?.first_name || '';
        const lastName = department.users.details?.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim() || department.users.username || 'N/A';

        return {
            id: department.users.id,
            name: fullName,
            username: department.users.username
        };
    }

  async getEmployeesByDepartment(departmentId?: number) {

    const where: Prisma.UserWhereInput = {
      is_deleted: false,
      status: true
    };

    if (departmentId) {
      where.details = {
        department_id: departmentId,
        role_id: 4
      };
    }

    return await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        status: true,
        details: {
          select: {
            first_name: true,
            last_name: true,
            profile_picture: true,
            role: { select: { role_name: true } }
          }
        }
      }
    });
  }
}

export const departmentService = new DepartmentService();