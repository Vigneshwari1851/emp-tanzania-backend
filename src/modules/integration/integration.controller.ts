import { Request, Response, NextFunction } from 'express';
import { IntegrationService } from './integration.service';
import { sendResponse } from '../../utils/response.util';
import { auditService } from '../audit/audit.service';

const integrationService = new IntegrationService();

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

export const listIntegrations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const integrations = await integrationService.listIntegrations();
        return sendResponse(res, 200, true, 'Integrations fetched successfully', integrations);
    } catch (error) {
        next(error);
    }
};

export const updateIntegration = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id as string);
        const oldEntity = await integrationService.getById(id);
        const integration = await integrationService.updateIntegration(id, req.body as any);
        _audit(req, 'INTEGRATION_UPDATED', id, integration, oldEntity);
        return sendResponse(res, 200, true, 'Integration updated successfully', integration);
    } catch (error) {
        next(error);
    }
};

export const seedIntegrations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await integrationService.seedIntegrations();
        _audit(req, 'INTEGRATIONS_SEEDED', 'bulk');
        return sendResponse(res, 200, true, 'Integrations seeded successfully', null);
    } catch (error) {
        next(error);
    }
};
