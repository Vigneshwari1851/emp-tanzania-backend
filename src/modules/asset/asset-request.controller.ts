import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { AssetRequestService } from './asset-request.service';

const requestService = new AssetRequestService();

export const createAssetRequest = async (req: AuthRequest, res: Response) => {
  try {
    const data = {
      organizationId: req.user?.orgId || 1,
      userId: req.user?.id || 1,
      ...req.body
    };
    const request = await requestService.createRequest(data);
    res.status(201).json({ success: true, data: request });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getAssetRequests = async (req: AuthRequest, res: Response) => {
  try {
    const filters = {
      organizationId: req.user?.orgId || 1,
      userId: req.query.employeeId ? Number(req.query.employeeId) : undefined,
      status: req.query.status as string
    };
    
    // If the user is an employee, they can only see their own requests
    // Unless they have an admin role
    const normalizedRoles = (req.user?.roles || []).map(r => r.toUpperCase());
    const isEmployee = !normalizedRoles.some(r => ['SUPER ADMIN', 'SUPER_ADMIN', 'ADMIN', 'CEO', 'SYSTEM ADMINISTRATOR'].includes(r));
    if (isEmployee) {
      filters.userId = req.user?.id || 1;
    }

    const requests = await requestService.getRequests(filters);
    res.json({ success: true, data: requests });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const processAssetRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { action, notes, assignedAssetId } = req.body;
    const adminId = req.user?.id || 1;
    const organizationId = req.user?.orgId || 1;
    const requestId = Number(req.params.id);

    const result = await requestService.processRequest(
      requestId,
      organizationId,
      adminId,
      action,
      notes,
      assignedAssetId
    );

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};
