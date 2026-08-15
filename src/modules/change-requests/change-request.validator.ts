import { z } from 'zod';

export const createChangeRequestSchema = z.object({
    body: z.object({
        changes: z.record(z.string(), z.any()).refine((val) => Object.keys(val).length > 0, {
            message: 'At least one field change is required'
        })
    })
});

export const decideChangeRequestSchema = z.object({
    body: z.object({
        action: z.enum(['approve', 'reject']),
        role: z.enum(['manager', 'hr', 'finance']),
        note: z.preprocess((val) => {
            if (val === null || val === undefined) return undefined;
            if (typeof val === 'string' && val.trim() === '') return undefined;
            return val;
        }, z.string().max(1000, 'Note must be at most 1000 characters').optional())
    }),
    params: z.object({
        id: z.coerce.number()
    })
});

export const listChangeRequestSchema = z.object({
    query: z.object({
        status: z.string().optional()
    })
});
