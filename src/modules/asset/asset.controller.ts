// ─── Asset Controller ─────────────────────────────────────────────────────
// Thin controller layer — delegates to AssetService.
// No direct database access. No business logic.

import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { AssetService, AssetNotFoundError, DuplicateSerialNumberError, AssetAssignedDeletionError } from './asset.service';

const assetService = new AssetService();

export const getAssets = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.orgId || 1;
  const { status, categoryId, locationId, search, page = '1', limit = '10' } = req.query as Record<string, string>;

  try {
    const result = await assetService.listAssets({
      organizationId: tenantId,
      status,
      categoryId: categoryId ? parseInt(categoryId) : undefined,
      locationId: locationId ? parseInt(locationId) : undefined,
      search,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) });
  }
};

export const createAsset = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.orgId || 1;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const imageFile = files?.['image']?.[0];
    const imageUrl = imageFile ? `/upload/${imageFile.filename}` : undefined;

    const payload = { ...req.body };
    if (typeof payload.specifications === 'string') {
      try {
        payload.specifications = JSON.parse(payload.specifications);
      } catch (e) {
        console.error('Failed parsing specifications:', e);
      }
    }

    const asset = await assetService.createAsset({
      organizationId: tenantId,
      ...payload,
      ...(imageUrl && { imageUrl }),
    }, userId);

    res.status(201).json({ success: true, data: asset });
  } catch (error: any) {
    if (error instanceof DuplicateSerialNumberError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Create asset error:', error);
    res.status(400).json({ error: error.message || 'Internal server error' });
  }
};

export const getAssetById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.user?.orgId || 1;

  try {
    const asset = await assetService.getAssetById(parseInt(id), tenantId);
    res.json({ success: true, data: asset });
  } catch (error: any) {
    if (error instanceof AssetNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error fetching asset detail:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateAsset = async (req: AuthRequest, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.user?.orgId || 1;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const imageFile = files?.['image']?.[0];
    const imageUrl = imageFile ? `/upload/${imageFile.filename}` : undefined;

    const payload = { ...req.body };
    if (typeof payload.specifications === 'string') {
      try {
        payload.specifications = JSON.parse(payload.specifications);
      } catch (e) {
        console.error('Failed parsing specifications updates:', e);
      }
    }

    const asset = await assetService.updateAsset(
      parseInt(id),
      tenantId,
      {
        ...payload,
        ...(imageUrl && { imageUrl }),
      },
      userId
    );
    res.json({ success: true, data: asset });
  } catch (error: any) {
    if (error instanceof AssetNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error updating asset:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const softDeleteAsset = async (req: AuthRequest, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.user?.orgId || 1;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await assetService.deleteAsset(parseInt(id), tenantId, userId);
    res.status(204).send();
  } catch (error: any) {
    if (error instanceof AssetNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof AssetAssignedDeletionError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error deleting asset:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCategories = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.orgId || 1;
  try {
    const categories = await assetService.getCategories(tenantId);
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.json({ success: true, data: [] });
  }
};

export const getLocations = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.orgId || 1;
  try {
    const locations = await assetService.getLocations(tenantId);
    res.json({ success: true, data: locations });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.json({ success: true, data: [] });
  }
};

