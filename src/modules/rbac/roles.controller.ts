import { Request, Response, NextFunction } from 'express';
import { RolesService } from './roles.service';
import { sendResponse } from '../../utils/response.util';
import { auditService } from '../audit/audit.service';

const rolesService = new RolesService();

function _audit(req: any, action: string, entityId: string | number, newValue?: any, oldValue?: any) {
    auditService.log({
        module: 'SETTINGS',
        action,
        entityId: entityId.toString(),
        actorId: req.user?.id || 0,
        newValue,
        oldValue,
        ipAddress: req.ip
    }).catch(() => { });
}

export const createRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orgId = (req as any).user?.orgId;
        const { name, description, status, permission_ids } = req.body;
        const role = await rolesService.createRole({ name, description, status, permission_ids, orgId });
        _audit(req, 'ROLE_CREATED', role.id, role);
        return sendResponse(res, 201, true, 'Role created successfully', role);
    } catch (error) {
        next(error);
    }
};

export const listRoles = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orgId = (req as any).user?.orgId;
        const { search, status } = req.query;
        const roles = await rolesService.listRoles({
            search: search as string,
            status: status === 'true' ? true : status === 'false' ? false : undefined,
            orgId
        });
        return sendResponse(res, 200, true, 'Roles fetched successfully', roles);
    } catch (error) {
        next(error);
    }
};

export const getRoleById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orgId = (req as any).user?.orgId;
        const role = await rolesService.getRoleById(parseInt(req.params.id as string), orgId);
        return sendResponse(res, 200, true, 'Role fetched successfully', role);
    } catch (error) {
        next(error);
    }
};

export const updateRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orgId = (req as any).user?.orgId;
        const id = parseInt(req.params.id as string);
        const oldEntity = await rolesService.getRoleById(id, orgId);
        const { name, description, status } = req.body;
        const role = await rolesService.updateRole(id, { name, description, status }, orgId);
        _audit(req, 'ROLE_UPDATED', id, role, oldEntity);
        return sendResponse(res, 200, true, 'Role updated successfully', role);
    } catch (error) {
        next(error);
    }
};

export const deleteRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orgId = (req as any).user?.orgId;
        const id = parseInt(req.params.id as string);
        const oldEntity = await rolesService.getRoleById(id, orgId);
        const result = await rolesService.deleteRole(id, orgId);
        _audit(req, 'ROLE_DELETED', id, undefined, oldEntity);
        return sendResponse(res, 200, true, result.message, null);
    } catch (error) {
        next(error);
    }
};

export const updateRolePermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orgId = (req as any).user?.orgId;
        const { id } = req.params;
        const { permissions } = req.body;
        const roleId = parseInt(id as string);
        const oldPermissions = await rolesService.getRolePermissions(roleId);
        const result = await rolesService.updateRolePermissions(roleId, permissions, orgId);
        const newPermissions = await rolesService.getRolePermissions(roleId);
        _audit(req, 'ROLE_PERMISSIONS_UPDATED', roleId, newPermissions, oldPermissions);
        return sendResponse(res, 200, true, result.message, null);
    } catch (error) {
        next(error);
    }
};

export const listAllPermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const permissions = await rolesService.listAllPermissions();
        return sendResponse(res, 200, true, 'Permissions fetched successfully', permissions);
    } catch (error) {
        next(error);
    }
};

export const getRolePermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const permissions = await rolesService.getRolePermissions(parseInt(req.params.id as string));
        return sendResponse(res, 200, true, 'Role permissions fetched successfully', permissions);
    } catch (error) {
        next(error);
    }
};
