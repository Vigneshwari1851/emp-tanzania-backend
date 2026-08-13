// ─── Asset Service ────────────────────────────────────────────────────────
// Business logic layer for the Asset module.
// Orchestrates repository calls, validations, and activity logging.

import { AssetRepository, AssetFilters } from './asset.repository';
import prisma from '../../config/prisma';

const assetRepo = new AssetRepository();

export class AssetService {
  async listAssets(filters: AssetFilters) {
    const { assets, total } = await assetRepo.findMany(filters);
    return {
      assets,
      totalAssets: total,
      totalPages: Math.ceil(total / filters.limit),
      currentPage: filters.page,
    };
  }

  async getAssetById(id: number, organizationId: number) {
    const asset = await assetRepo.findById(id, organizationId);
    if (!asset) {
      throw new AssetNotFoundError(id);
    }
    return asset;
  }

  async createAsset(data: {
    organizationId: number;
    name: string;
    categoryId: number;
    serialNumber: string;
    locationId: number;
    description?: string;
    imageUrl?: string;
    manufacturer?: string;
    model?: string;
    assetTag?: string;
    purchaseDate?: string;
    purchasePrice?: number;
    warrantyExpiry?: string;
    depreciationRate?: number;
    specifications?: any;
  }, userId: number) {
    // Check for duplicate serial number
    const existing = await assetRepo.findBySerialNumber(data.serialNumber, data.organizationId);
    if (existing) {
      throw new DuplicateSerialNumberError(data.serialNumber);
    }

    const asset = await prisma.asset.create({
      data: {
        organization: { connect: { id: data.organizationId } },
        name: data.name,
        category: { connect: { id: data.categoryId } },
        serial_number: data.serialNumber,
        location: { connect: { id: data.locationId } },
        description: data.description,
        image_url: data.imageUrl,
        manufacturer: data.manufacturer,
        model: data.model,
        asset_tag: data.assetTag,
        purchase_date: data.purchaseDate ? new Date(data.purchaseDate) : null,
        purchase_price: data.purchasePrice ? Number(data.purchasePrice) : null,
        warranty_expiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : null,
        depreciation_rate: data.depreciationRate ?? 0,
        specifications: data.specifications ? data.specifications : null,
      } as any,
    });

    // Generate unique asset_code like AST-00001
    const assetCode = `AST-${asset.id.toString().padStart(5, '0')}`;
    await prisma.asset.update({
      where: { id: asset.id },
      data: { asset_code: assetCode }
    });
    asset.asset_code = assetCode;

    // Create history entry
    await assetRepo.createHistory({
      organization: { connect: { id: data.organizationId } },
      asset: { connect: { id: asset.id } },
      action_type: 'CREATE',
      new_value: JSON.stringify({ name: data.name, serialNumber: data.serialNumber }),
      changed_by: { connect: { id: userId } },
    });

    // Log activity
    await this.logActivity(data.organizationId, userId, 'CREATE_ASSET', 'ASSET', asset.id, `Created asset: ${data.name}`);

    return asset;
  }

  async updateAsset(
    id: number,
    organizationId: number,
    updates: Record<string, any>,
    userId: number,
  ) {
    const oldAsset = await assetRepo.findById(id, organizationId);
    if (!oldAsset) {
      throw new AssetNotFoundError(id);
    }

    const updateData: Record<string, any> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.categoryId !== undefined) updateData.category_id = parseInt(updates.categoryId);
    if (updates.serialNumber !== undefined) updateData.serial_number = updates.serialNumber;
    if (updates.locationId !== undefined) updateData.location_id = parseInt(updates.locationId);
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.purchasePrice !== undefined) updateData.purchase_price = Number(updates.purchasePrice);
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl;
    if (updates.manufacturer !== undefined) updateData.manufacturer = updates.manufacturer;
    if (updates.model !== undefined) updateData.model = updates.model;
    if (updates.assetTag !== undefined) updateData.asset_tag = updates.assetTag;
    if (updates.warrantyExpiry !== undefined) updateData.warranty_expiry = updates.warrantyExpiry ? new Date(updates.warrantyExpiry) : null;
    if (updates.specifications !== undefined) updateData.specifications = updates.specifications;

    const asset = await assetRepo.update(id, organizationId, updateData as any);

    // Track field-level changes
    const fieldMap: Record<string, string> = {
      name: 'name', status: 'status', location_id: 'location_id',
      category_id: 'category_id', serial_number: 'serial_number',
    };

    for (const [dbField, label] of Object.entries(fieldMap)) {
      const oldVal = (oldAsset as any)[dbField];
      const newVal = (asset as any)[dbField];
      if (oldVal !== undefined && newVal !== undefined && String(oldVal) !== String(newVal)) {
        await assetRepo.createHistory({
          organization: { connect: { id: organizationId } },
          asset: { connect: { id: asset.id } },
          action_type: label === 'status' ? 'STATUS_CHANGE' : 'UPDATE',
          field_changed: label,
          old_value: String(oldVal),
          new_value: String(newVal),
          changed_by: { connect: { id: userId } },
        });
      }
    }

    await this.logActivity(organizationId, userId, 'UPDATE_ASSET', 'ASSET', id, `Updated asset ID: ${id}`);

    return asset;
  }

  async deleteAsset(id: number, organizationId: number, userId: number) {
    const asset = await assetRepo.findById(id, organizationId);
    if (!asset) {
      throw new AssetNotFoundError(id);
    }

    if (asset.status === 'ASSIGNED') {
      throw new AssetAssignedDeletionError(id);
    }

    await assetRepo.softDelete(id, organizationId);

    await assetRepo.createHistory({
      organization: { connect: { id: organizationId } },
      asset: { connect: { id } },
      action_type: 'DISPOSE',
      field_changed: 'is_deleted',
      old_value: 'false',
      new_value: 'true',
      changed_by: { connect: { id: userId } },
    });

    await this.logActivity(organizationId, userId, 'DELETE_ASSET', 'ASSET', id, `Soft deleted asset ID: ${id}`);
  }

  async getCategories(organizationId: number) {
    return assetRepo.findCategories(organizationId);
  }

  async getLocations(organizationId: number) {
    return assetRepo.findLocations(organizationId);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────
  private async logActivity(
    orgId: number,
    userId: number,
    action: string,
    module: string,
    entityId: number,
    description: string,
  ) {
    try {
      await prisma.activityLog.create({
        data: {
          user_id: userId,
          action,
          module,
          description: `${description} (Entity ID: ${entityId})`,
        },
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }
}

// ─── Domain Errors ──────────────────────────────────────────────────────
export class AssetNotFoundError extends Error {
  public statusCode = 404;
  constructor(id: number) {
    super(`Asset with ID ${id} not found`);
    this.name = 'AssetNotFoundError';
  }
}

export class DuplicateSerialNumberError extends Error {
  public statusCode = 400;
  constructor(serialNumber: string) {
    super(`Asset with serial number '${serialNumber}' already exists in your organization`);
    this.name = 'DuplicateSerialNumberError';
  }
}

export class AssetAssignedDeletionError extends Error {
  public statusCode = 400;
  constructor(id: number) {
    super(`Cannot delete an asset while it is currently assigned to an employee. Please return the asset first.`);
    this.name = 'AssetAssignedDeletionError';
  }
}
