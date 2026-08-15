import { z } from 'zod';

const nonEmptyString = z.string().min(1).max(255);

// ─── Salary Components ─────────────────────────────────────────────────
export const createComponentSchema = z.object({
    body: z.object({
        name: nonEmptyString,
        code: nonEmptyString.optional(),
        type: z.enum(['earning', 'deduction']),
        category: z.enum(['statutory', 'fixed', 'variable', 'reimbursement', 'loan_advance']).optional(),
        calculationType: z.enum(['fixed', 'percentage', 'formula', 'slab']).optional(),
        value: z.coerce.number().optional(),
        defaultValue: z.coerce.number().optional(),
        formula: z.string().max(1000).optional(),
        description: z.string().max(500).optional(),
        isDefault: z.boolean().optional(),
        isTaxable: z.boolean().optional(),
        isStatutory: z.boolean().optional(),
    })
});

export const updateComponentSchema = z.object({
    params: z.object({ id: z.coerce.number().int().positive() }),
    body: z.object({
        name: nonEmptyString.optional(),
        code: nonEmptyString.optional(),
        type: z.enum(['earning', 'deduction']).optional(),
        category: z.enum(['statutory', 'fixed', 'variable', 'reimbursement', 'loan_advance']).optional(),
        calculationType: z.enum(['fixed', 'percentage', 'formula', 'slab']).optional(),
        value: z.coerce.number().optional(),
        defaultValue: z.coerce.number().optional(),
        formula: z.string().max(1000).optional(),
        description: z.string().max(500).optional(),
        status: z.boolean().optional(),
        isTaxable: z.boolean().optional(),
        isStatutory: z.boolean().optional(),
    })
});

// ─── Payroll Structure ─────────────────────────────────────────────────
export const createStructureSchema = z.object({
    body: z.object({
        name: nonEmptyString,
        description: z.string().max(500).optional(),
    })
});

// ─── Payroll Group ─────────────────────────────────────────────────────
export const createGroupSchema = z.object({
    body: z.object({
        name: nonEmptyString,
        description: z.string().max(500).optional(),
        criteria: z.any().optional(),
        salaryStructureId: z.coerce.number().int().positive().optional(),
        paymentCategoryId: z.coerce.number().int().positive().optional(),
        status: z.boolean().optional(),
    })
});

// ─── Tax Sections ──────────────────────────────────────────────────────
export const createTaxSectionSchema = z.object({
    body: z.object({
        section: nonEmptyString,
        label: nonEmptyString,
        limit: z.coerce.number().nonnegative().optional(),
        instruments: z.array(z.string()).optional(),
    })
});

// ─── Reimbursements ────────────────────────────────────────────────────
export const createReimbursementSchema = z.object({
    body: z.object({
        label: nonEmptyString,
        categoryId: z.coerce.number().int().positive().optional(),
        frequency: z.enum(['monthly', 'quarterly', 'annually', 'one_time']).optional(),
        maxAmount: z.coerce.number().nonnegative().optional(),
        description: z.string().max(500).optional(),
        isTaxable: z.boolean().optional(),
    })
});

// ─── Pay Cycle ─────────────────────────────────────────────────────────
export const updatePayCycleSchema = z.object({
    body: z.object({
        payFrequency: z.enum(['monthly', 'bi_weekly', 'weekly', 'quarterly']).optional(),
        payDay: z.coerce.number().int().min(1).max(31).optional(),
        payMonthOffset: z.coerce.number().int().min(0).max(12).optional(),
    })
});

// ─── Payroll Run ───────────────────────────────────────────────────────
export const createRunSchema = z.object({
    body: z.object({
        userId: z.coerce.number().int().positive(),
        month: nonEmptyString.regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM format'),
        grossAmount: z.coerce.number(),
        deductionAmount: z.coerce.number(),
        netAmount: z.coerce.number(),
        status: z.enum(['DRAFT', 'Pending', 'Paid', 'Rejected', 'processed', 'PAID', 'PENDING', 'PROCESSED', 'REJECTED']).optional(),
        breakdown: z.record(z.string(), z.any()).optional(),
    })
});

// ─── Employee Claims ───────────────────────────────────────────────────
export const submitClaimSchema = z.object({
    body: z.object({
        type: nonEmptyString,
        amount: z.coerce.number().positive(),
        date: z.coerce.string().or(z.coerce.date()),
        description: z.string().max(1000).optional(),
        proofUrl: z.string().optional(),
        approval_sequence: z.string().optional(),
    })
});

// ─── Tax Regime ────────────────────────────────────────────────────────
export const updateTaxRegimeSchema = z.object({
    body: z.object({
        regime: z.string().min(1).max(10),
    })
});

// ─── Declaration ───────────────────────────────────────────────────────
export const submitDeclarationSchema = z.object({
    body: z.object({
        section: nonEmptyString,
        instrument: nonEmptyString,
        amount: z.coerce.number().nonnegative(),
        financialYear: z.string().optional(),
        proofUrl: z.string().optional(),
    })
});

// ─── Form 12B ──────────────────────────────────────────────────────────
export const submitForm12BSchema = z.object({
    body: z.record(z.string(), z.any())
});

// ─── Reimbursement Payment ─────────────────────────────────────────────
export const processPaymentSchema = z.object({
    params: z.object({ id: z.coerce.number().int().positive() }),
    body: z.object({
        paymentReference: z.string().max(255).optional(),
        paidBy: z.coerce.number().int().positive().optional(),
    }).optional()
});

export const batchPaymentSchema = z.object({
    body: z.object({
        ids: z.array(z.coerce.number().int().positive()).min(1),
        paymentReference: z.string().max(255).optional(),
        paidBy: z.coerce.number().int().positive().optional(),
    })
});

// ─── System Settings ───────────────────────────────────────────────────
export const saveSystemSettingsSchema = z.object({
    body: z.array(z.object({
        key: nonEmptyString,
        value: z.any(),
        description: z.string().max(500).optional(),
    }))
});
