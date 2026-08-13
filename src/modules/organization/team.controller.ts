import { Request, Response, NextFunction } from 'express';
import { sendResponse } from '../../utils/response.util';
import { teamService } from './team.service';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { auditService } from '../audit/audit.service';

function _audit(req: any, action: string, entityId: string | number, newValue?: any, oldValue?: any) {
    auditService.log({
        module: 'ORGANIZATION',
        action,
        entityId: entityId.toString(),
        actorId: req.user?.id || 0,
        newValue,
        oldValue,
        ipAddress: req.ip
    }).catch(() => { });
}

export const createTeam = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const team = await teamService.create(req.body);
        _audit(req, 'TEAM_CREATED', team.id, team);
        sendResponse(res, 201, true, 'Team created successfully', team);
    } catch (error) {
        next(error);
    }
};

export const getAllTeams = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orgId = (req as AuthRequest).user?.orgId || undefined;
        const teams = await teamService.getAll(orgId);
        sendResponse(res, 200, true, 'Teams fetched successfully', teams);
    } catch (error) {
        next(error);
    }
};

export const getTeamById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const team = await teamService.getById(Number(req.params.id));
        if (!team) {
            return sendResponse(res, 404, false, 'Team not found');
        }
        sendResponse(res, 200, true, 'Team fetched successfully', team);
    } catch (error) {
        next(error);
    }
};

export const updateTeam = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const oldEntity = await teamService.getById(Number(req.params.id));
        const team = await teamService.update(Number(req.params.id), req.body);
        _audit(req, 'TEAM_UPDATED', String(req.params.id), team, oldEntity);
        sendResponse(res, 200, true, 'Team updated successfully', team);
    } catch (error) {
        next(error);
    }
};

export const deleteTeam = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const oldEntity = await teamService.getById(Number(req.params.id));
        await teamService.delete(Number(req.params.id));
        _audit(req, 'TEAM_DELETED', String(req.params.id), undefined, oldEntity);
        sendResponse(res, 200, true, 'Team deleted successfully');
    } catch (error) {
        next(error);
    }
};

export const getTeamsByDepartment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const teams = await teamService.getByDepartment(Number(req.params.departmentId));
        sendResponse(res, 200, true, 'Teams fetched successfully', teams);
    } catch (error) {
        next(error);
    }
};
