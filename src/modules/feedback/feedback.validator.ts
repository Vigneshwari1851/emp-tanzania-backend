import { z } from 'zod';

export const submitFeedbackSchema = z.object({
    body: z.object({
        message: z.string().trim().min(1, 'Feedback message is required').max(5000, 'Feedback must be at most 5000 characters'),
        category: z.preprocess((val) => {
            if (val === null || val === undefined) return undefined;
            if (typeof val === 'string' && val.trim() === '') return undefined;
            return val;
        }, z.string().max(100, 'Category must be at most 100 characters').optional())
    })
});

export const feedbackIdParamsSchema = z.object({
    params: z.object({
        id: z.coerce.number()
    })
});

export const updateFeedbackStatusSchema = z.object({
    params: z.object({
        id: z.coerce.number()
    }),
    body: z.object({
        status: z.enum(['PENDING', 'REVIEWED', 'RESOLVED'])
    })
});
