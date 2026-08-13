import { Request, Response, NextFunction } from 'express';
import { CustomFieldService } from './custom-field.service';
import { sendResponse } from '../../utils/response.util';
import { auditService } from '../audit/audit.service';

const customFieldService = new CustomFieldService();

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

export const listFields = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { module } = req.query;
        const fields = await customFieldService.listFields(module as string);
        return sendResponse(res, 200, true, 'Custom fields fetched successfully', fields);
    } catch (error) {
        next(error);
    }
};

export const createField = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const field = await customFieldService.createField(req.body);
        _audit(req, 'CUSTOM_FIELD_CREATED', field.id, field);
        return sendResponse(res, 201, true, 'Custom field created successfully', field);
    } catch (error) {
        next(error);
    }
};

export const updateField = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id as string);
        const oldEntity = await customFieldService.getById(id);
        const field = await customFieldService.updateField(id, req.body);
        _audit(req, 'CUSTOM_FIELD_UPDATED', id, field, oldEntity);
        return sendResponse(res, 200, true, 'Custom field updated successfully', field);
    } catch (error) {
        next(error);
    }
};

export const deleteField = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id as string);
        const oldEntity = await customFieldService.getById(id);
        await customFieldService.deleteField(id);
        _audit(req, 'CUSTOM_FIELD_DELETED', id, undefined, oldEntity);
        return sendResponse(res, 200, true, 'Custom field deleted successfully', null);
    } catch (error) {
        next(error);
    }
};
