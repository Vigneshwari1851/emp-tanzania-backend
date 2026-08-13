// ─── Asset Validators ─────────────────────────────────────────────────────
// Zod schemas for request validation in the Asset module.

import { z } from 'zod';

export const createAssetSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Asset name is required').max(255),
    categoryId: z.coerce.number().int().positive('Category ID must be a positive integer'),
    serialNumber: z.string().min(1, 'Serial number is required').max(100),
    locationId: z.coerce.number().int().positive('Location ID must be a positive integer'),
    description: z.string().max(2000).optional(),
    imageUrl: z.string().optional().nullable().or(z.literal('')),
    manufacturer: z.string().max(255).optional(),
    model: z.string().max(255).optional(),
    assetTag: z.string().max(100).optional(),
    purchaseDate: z.string().optional(),
    purchasePrice: z.coerce.number().nonnegative().optional(),
    warrantyExpiry: z.string().optional(),
    depreciationRate: z.coerce.number().min(0).max(100).optional(),
  }),
});

export const updateAssetSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    serialNumber: z.string().min(1).max(100).optional(),
    locationId: z.coerce.number().int().positive().optional(),
    status: z.enum(['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED', 'DISPOSED']).optional(),
    description: z.string().max(2000).optional(),
    imageUrl: z.string().optional().nullable().or(z.literal('')),
    manufacturer: z.string().max(255).optional(),
    model: z.string().max(255).optional(),
    assetTag: z.string().max(100).optional(),
    purchasePrice: z.coerce.number().nonnegative().optional(),
    warrantyExpiry: z.string().optional(),
  }),
});

export const getAssetByIdSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

export const listAssetsSchema = z.object({
  query: z.object({
    status: z.string().optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    locationId: z.coerce.number().int().positive().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50000).default(10),
  }),
});
