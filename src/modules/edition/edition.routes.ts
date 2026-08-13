import { Router, Request, Response } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { sendResponse } from '../../utils/response.util';
import { PrismaClient } from '@prisma/client';
import { auditService } from '../audit/audit.service';

const router = Router();
const prisma = new PrismaClient();

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

// ─── GET /edition/tenant/:tenantId/modules ────────────────────────────────────
// Used by useFeatures hook – returns string[] of enabled module codes
router.get('/tenant/:tenantId/modules', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = Number(req.params.tenantId);

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT fm.code
      FROM feature_modules fm
      LEFT JOIN (
          SELECT featureModuleId FROM edition_modules em
          JOIN tenants t ON t.editionId = em.editionId
          WHERE t.id = ?
      ) base ON base.featureModuleId = fm.id
      LEFT JOIN tenant_feature_overrides tfo ON tfo.featureModuleId = fm.id AND tfo.tenantId = ?
      WHERE (tfo.enabled = 1) OR (base.featureModuleId IS NOT NULL AND tfo.enabled IS NULL)
    `, tenantId, tenantId);

    if (rows.length > 0) {
      return sendResponse(res, 200, true, 'Modules fetched', rows.map((r: any) => r.code));
    }

    // No rows means tenant has no edition or no modules configured
    return sendResponse(res, 200, true, 'Modules fetched', []);
  } catch {
    return sendResponse(res, 200, true, 'Modules fetched (fallback)', []);
  }
});

// ─── GET /edition/modules ─────────────────────────────────────────────────────
// Used by SubscriptionTab – full module objects { id, name, code }
router.get('/modules', authenticate, async (_req: Request, res: Response) => {
  try {
    const modules: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, name, code FROM feature_modules ORDER BY id`
    );
    return sendResponse(res, 200, true, 'Modules fetched', modules.map(m => ({
      ...m,
      id: Number(m.id),
    })));
  } catch {
    return sendResponse(res, 200, true, 'Modules fetched (fallback)', []);
  }
});

// ─── GET /edition/all ─────────────────────────────────────────────────────────
// Used by SubscriptionTab – editions with their included modules
router.get('/all', authenticate, async (_req: Request, res: Response) => {
  try {
    const editions: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, code, name, description FROM editions ORDER BY id`
    );
    const editionModules: any[] = await prisma.$queryRawUnsafe(
      `SELECT editionId, featureModuleId FROM edition_modules`
    );

    const result = editions.map((e: any) => ({
      id: Number(e.id),
      code: e.code,
      name: e.name,
      description: e.description,
      modules: editionModules
        .filter((em: any) => Number(em.editionId) === Number(e.id))
        .map((em: any) => ({ featureModuleId: Number(em.featureModuleId) })),
    }));

    return sendResponse(res, 200, true, 'Editions fetched', result);
  } catch {
    return sendResponse(res, 200, true, 'Editions fetched (fallback)', []);
  }
});

// ─── GET /edition/tenant/:tenantId/subscription ───────────────────────────────
router.get('/tenant/:tenantId/subscription', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = Number(req.params.tenantId);

    const tenantRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT t.id, t.editionId, e.id as eId, e.code, e.name, e.description
      FROM tenants t
      LEFT JOIN editions e ON e.id = t.editionId
      WHERE t.id = ?
    `, tenantId);

    const tenant = tenantRows[0];
    if (!tenant) {
      return sendResponse(res, 404, false, 'Tenant not found');
    }

    const editionModules: any[] = await prisma.$queryRawUnsafe(
      `SELECT featureModuleId FROM edition_modules WHERE editionId = ?`,
      Number(tenant.editionId)
    );

    const overrides: any[] = await prisma.$queryRawUnsafe(`
      SELECT tfo.enabled, fm.id, fm.name, fm.code
      FROM tenant_feature_overrides tfo
      JOIN feature_modules fm ON fm.id = tfo.featureModuleId
      WHERE tfo.tenantId = ?
    `, tenantId);

    return sendResponse(res, 200, true, 'Subscription fetched', {
      tenantId,
      edition: {
        id: Number(tenant.eId),
        code: tenant.code,
        name: tenant.name,
        description: tenant.description,
        modules: editionModules.map((em: any) => ({ featureModuleId: Number(em.featureModuleId) })),
      },
      overrides: overrides.map((ov: any) => ({
        enabled: Boolean(ov.enabled),
        featureModule: { id: Number(ov.id), name: ov.name, code: ov.code },
      })),
      isActive: true,
      expiresAt: null,
    });
  } catch (err: any) {
    return sendResponse(res, 500, false, err.message);
  }
});

// ─── PUT /edition/tenant/:tenantId/subscription ───────────────────────────────
router.put('/tenant/:tenantId/subscription', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = Number(req.params.tenantId);
    const { editionId, overrides } = req.body;

    const oldTenant = await (prisma as any).tenants.findUnique({ where: { id: tenantId } });
    const oldOverrides = await (prisma as any).tenant_feature_overrides.findMany({ where: { tenantId } });
    const oldState = { ...oldTenant, overrides: oldOverrides };

    if (editionId) {
      await prisma.$executeRawUnsafe(
        `UPDATE tenants SET editionId = ? WHERE id = ?`, editionId, tenantId
      );
    }

    if (Array.isArray(overrides)) {
      for (const ov of overrides) {
        const existing: any[] = await prisma.$queryRawUnsafe(
          `SELECT tenantId FROM tenant_feature_overrides WHERE tenantId = ? AND featureModuleId = ?`,
          tenantId, ov.featureModuleId
        );
        if (existing.length > 0) {
          await prisma.$executeRawUnsafe(
            `UPDATE tenant_feature_overrides SET enabled = ? WHERE tenantId = ? AND featureModuleId = ?`,
            ov.enabled ? 1 : 0, tenantId, ov.featureModuleId
          );
        } else {
          await prisma.$executeRawUnsafe(
            `INSERT INTO tenant_feature_overrides (tenantId, featureModuleId, enabled) VALUES (?, ?, ?)`,
            tenantId, ov.featureModuleId, ov.enabled ? 1 : 0
          );
        }
      }
    }

    const newTenant = await (prisma as any).tenants.findUnique({ where: { id: tenantId } });
    const newOverrides = await (prisma as any).tenant_feature_overrides.findMany({ where: { tenantId } });
    const newState = { ...newTenant, overrides: newOverrides };

    _audit(req, 'TENANT_SUBSCRIPTION_UPDATED', tenantId, newState, oldState);

    return sendResponse(res, 200, true, 'Subscription updated successfully');
  } catch (err: any) {
    return sendResponse(res, 500, false, err.message);
  }
});

export default router;
