import prisma from '../../shared/prisma/client';
import { AppError } from '../../middlewares/error.middleware';

import { Prisma } from '@prisma/client';

export class TeamService {
    async create(data: Prisma.teamUncheckedCreateInput, tx?: Prisma.TransactionClient) {
        const teamData = data;
        const prismaClient = tx || prisma;
        
        // FK Validations
        if (teamData.department_id) {
            const departmentExists = await prismaClient.department.findUnique({ where: { id: teamData.department_id } });
            if (!departmentExists) throw new AppError('Invalid department_id. The specified department does not exist.', 400);
        }

        if (teamData.team_lead_id) {
            const teamLeadExists = await prismaClient.user.findUnique({ where: { id: teamData.team_lead_id } });
            if (!teamLeadExists) throw new AppError('Invalid team_lead_id. The specified user does not exist.', 400);
        }

        const execute = async (client: Prisma.TransactionClient) => {
            const team = await client.team.create({
                data: teamData as Prisma.teamUncheckedCreateInput
            });

            const result = await client.team.findUnique({
                where: { id: team.id },
                include: {
                    department: { select: { department_name: true } },
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
                    _count: {
                        select: { userDetails: true }
                    }
                }
            });
            return this._formatTeam(result);
        };

        return tx ? execute(tx) : prisma.$transaction(execute);
    }

    async getAll(orgId?: number) {
        const where: any = { is_deleted: false };
        if (orgId) {
            where.department = { branches: { organization_id: orgId } };
        }
        const teams = await prisma.team.findMany({
            where,
            include: {
                department: { select: { department_name: true } },
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
                _count: {
                    select: { userDetails: true }
                }
            }
        });
        return teams.map(team => this._formatTeam(team));
    }

    async getById(id: number) {
        const team = await prisma.team.findFirst({
            where: { id, is_deleted: false },
            include: {
                department: { select: { department_name: true } },
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
                _count: {
                    select: { userDetails: true }
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
        });
        return this._formatTeam(team);
    }

    async getByDepartment(departmentId: number) {
        return await prisma.team.findMany({
            where: { department_id: departmentId, is_deleted: false },
            include: {
                department: { select: { department_name: true } },
                _count: {
                    select: { userDetails: true }
                }
            }
        });
    }

    async update(id: number, data: Partial<Prisma.teamUncheckedCreateInput>, tx?: Prisma.TransactionClient) {
        const teamData = data;
        const prismaClient = tx || prisma;
        
        // FK Validations
        if (teamData.department_id) {
            const departmentExists = await prismaClient.department.findUnique({ where: { id: teamData.department_id } });
            if (!departmentExists) throw new AppError('Invalid department_id. The specified department does not exist.', 400);
        }

        if (teamData.team_lead_id) {
            const teamLeadExists = await prismaClient.user.findUnique({ where: { id: teamData.team_lead_id } });
            if (!teamLeadExists) throw new AppError('Invalid team_lead_id. The specified user does not exist.', 400);
        }

        const execute = async (client: Prisma.TransactionClient) => {
            await client.team.update({
                where: { id },
                data: teamData as Prisma.teamUncheckedUpdateInput
            });

            const result = await client.team.findUnique({
                where: { id },
                include: {
                    department: { select: { department_name: true } },
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
                    _count: {
                        select: { userDetails: true }
                    }
                }
            });
            return this._formatTeam(result);
        };

        return tx ? execute(tx) : prisma.$transaction(execute);
    }

    async delete(id: number, tx?: Prisma.TransactionClient) {
        const prismaClient = tx || prisma;
        
        // Check if team exists
        const team = await prismaClient.team.findUnique({
            where: { id }
        });

        if (!team) {
            throw new AppError('Team not found', 404);
        }

        return await prismaClient.team.update({
            where: { id },
            data: { is_deleted: true, deleted_at: new Date() }
        });
    }

    private _formatTeam(team: any) {
        if (!team) return null;

        return {
            ...team,
            members_count: team._count?.userDetails || 0,
            members: team.userDetails || []
        };
    }
}

export const teamService = new TeamService();
