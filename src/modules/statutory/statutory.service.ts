import prisma from '../../config/prisma';
import { AppError } from '../../middlewares/error.middleware';

export interface PayeBandInput {
    upper_limit: number | null;
    rate: number;
}

export class StatutoryService {

    // ─── PAYE Bands CRUD ────────────────────────────────────────────────

    async getPayeBands(orgId: number): Promise<PayeBandInput[]> {
        const record = await prisma.statutoryConfig.findFirst({
            where: {
                organization_id: orgId,
                config_type: 'PAYE',
                key: 'TZ_PAYE_BANDS',
                is_active: true,
            },
            orderBy: { effective_from: 'desc' },
        });

        if (record) {
            try {
                const parsed = JSON.parse(record.value);
                // Normalize tuple format if needed
                if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
                    return parsed.map((b: any[]) => ({
                        upper_limit: b[0],
                        rate: b[1],
                    }));
                }
                return parsed;
            } catch {
                return [];
            }
        }

        // Fallback to system_settings for backward compat
        const fallback = await prisma.systemSetting.findUnique({
            where: { key: 'TZ_PAYE_BANDS' },
        });
        if (fallback) {
            try {
                const parsed = JSON.parse(fallback.value);
                // Normalize tuple format [[upper, rate], ...] → [{ upper_limit, rate }, ...]
                if (Array.isArray(parsed) && parsed.length > 0) {
                    if (Array.isArray(parsed[0])) {
                        return parsed.map((b: any[]) => ({
                            upper_limit: b[0],
                            rate: b[1],
                        }));
                    }
                    return parsed;
                }
            } catch {
                return [];
            }
        }

        // Hardcoded Tanzania defaults
        return [
            { upper_limit: 270000, rate: 0 },
            { upper_limit: 520000, rate: 0.08 },
            { upper_limit: 760000, rate: 0.20 },
            { upper_limit: 1000000, rate: 0.25 },
            { upper_limit: null, rate: 0.30 },
        ];
    }

    async savePayeBands(orgId: number, bands: PayeBandInput[]): Promise<PayeBandInput[]> {
        // ── Validate ──
        this.validateBands(bands);

        const value = JSON.stringify(bands);

        // Upsert into StatutoryConfig
        const existing = await prisma.statutoryConfig.findFirst({
            where: {
                organization_id: orgId,
                config_type: 'PAYE',
                key: 'TZ_PAYE_BANDS',
                is_active: true,
            },
        });

        if (existing) {
            // Deactivate old record, create new version
            await prisma.statutoryConfig.update({
                where: { id: existing.id },
                data: { is_active: false, effective_to: new Date() },
            });
        }

        await prisma.statutoryConfig.create({
            data: {
                organization_id: orgId,
                config_type: 'PAYE',
                key: 'TZ_PAYE_BANDS',
                value,
                effective_from: new Date(),
                is_active: true,
            },
        });

        // Also update system_settings for engine fallback
        await prisma.systemSetting.upsert({
            where: { key: 'TZ_PAYE_BANDS' },
            update: { value },
            create: { key: 'TZ_PAYE_BANDS', value },
        });

        return bands;
    }

    validateBands(bands: PayeBandInput[]): void {
        if (!Array.isArray(bands) || bands.length === 0) {
            throw new AppError('At least one tax band is required', 400);
        }

        // Sort by upper_limit (null = infinity, goes last)
        const sorted = [...bands].sort((a, b) => {
            const aVal = a.upper_limit ?? Infinity;
            const bVal = b.upper_limit ?? Infinity;
            return aVal - bVal;
        });

        // Check: exactly one band must have null upper_limit (the top band)
        const nullBands = sorted.filter(b => b.upper_limit === null);
        if (nullBands.length !== 1) {
            throw new AppError('Exactly one band must have no upper limit (the top tax bracket)', 400);
        }

        // Check: first band upper_limit must be > 0
        if (sorted[0].upper_limit !== null && sorted[0].upper_limit! <= 0) {
            throw new AppError('First band upper limit must be greater than 0', 400);
        }

        // Check: no overlapping ranges and sequential
        for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i];
            const next = sorted[i + 1];

            if (current.upper_limit === null) {
                throw new AppError('The band with no upper limit must be the last band', 400);
            }

            // Bands must be sequential (no gaps, no overlaps)
            if (current.upper_limit !== next.upper_limit && next.upper_limit !== null) {
                // Allow adjacent bands where current.upper === next.upper (same boundary)
                // But flag if there's a gap or overlap
                if (current.upper_limit! > next.upper_limit!) {
                    throw new AppError(
                        `Band overlap detected: TZS ${current.upper_limit} overlaps with TZS ${next.upper_limit}`,
                        400
                    );
                }
            }
        }

        // Check: rates must be between 0 and 1 (0% to 100%)
        for (const band of sorted) {
            if (band.rate < 0 || band.rate > 1) {
                throw new AppError(
                    `Invalid tax rate ${(band.rate * 100).toFixed(1)}%. Rate must be between 0% and 100%`,
                    400
                );
            }
        }

        // Check: rates should be monotonically non-decreasing
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].rate < sorted[i - 1].rate) {
                throw new AppError(
                    `Tax rates must be non-decreasing. Band ${i} rate (${(sorted[i].rate * 100).toFixed(1)}%) is lower than band ${i - 1} (${(sorted[i - 1].rate * 100).toFixed(1)}%)`,
                    400
                );
            }
        }
    }

    // ─── Generic Statutory Config ───────────────────────────────────────

    async getConfig(orgId: number, configType: string): Promise<Record<string, string>> {
        const records = await prisma.statutoryConfig.findMany({
            where: {
                organization_id: orgId,
                config_type: configType,
                is_active: true,
            },
        });

        const result: Record<string, string> = {};
        for (const r of records) {
            result[r.key] = r.value;
        }
        return result;
    }

    async setConfig(orgId: number, configType: string, key: string, value: string): Promise<void> {
        const existing = await prisma.statutoryConfig.findFirst({
            where: {
                organization_id: orgId,
                config_type: configType,
                key,
                is_active: true,
            },
        });

        if (existing) {
            await prisma.statutoryConfig.update({
                where: { id: existing.id },
                data: { value, is_active: true },
            });
        } else {
            await prisma.statutoryConfig.create({
                data: {
                    organization_id: orgId,
                    config_type: configType,
                    key,
                    value,
                    effective_from: new Date(),
                    is_active: true,
                },
            });
        }
    }
}

export const statutoryService = new StatutoryService();
