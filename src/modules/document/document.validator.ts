import { z } from 'zod';

export const createDocumentSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required'),
    description: z.string().optional(),
    category: z.string().trim().min(1, 'Category is required'),
    tab: z.string().optional(),
    file_url: z.string().optional(),
    file_type: z.string().optional(),
    file_size: z.number().int().optional(),
    is_restricted: z.boolean().optional().default(false),
    tags: z.array(z.string()).optional(),
    version: z.string().optional().default('1.0'),
    user_id: z.number().int().optional(),
    target_department: z.string().optional(),
  }),
});

export const updateDocumentSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required').optional(),
    description: z.string().optional(),
    category: z.string().trim().min(1, 'Category is required').optional(),
    tab: z.string().optional(),
    is_restricted: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    version: z.string().optional(),
    user_id: z.number().int().optional(),
    target_department: z.string().optional(),
  }),
});
