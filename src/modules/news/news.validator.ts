import { z } from 'zod';

export const createNewsSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required'),
    content: z.string().trim().min(1, 'Content is required'),
    image: z.string().nullable().optional(),
    access_type: z.enum(['public', 'department']).optional(),
    department_ids: z.array(z.number().int()).optional().default([]),
    status: z.enum(['draft', 'published']).optional().default('published'),
    is_global: z.boolean().optional(),
    target_department_ids: z.array(z.union([z.string(), z.number()])).optional(),
  }),
});

export const updateNewsSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required'),
    content: z.string().trim().min(1, 'Content is required'),
    image: z.string().nullable().optional(),
    access_type: z.enum(['public', 'department']).optional(),
    department_ids: z.array(z.number().int()).optional().default([]),
    status: z.enum(['draft', 'published', 'archived']).optional().default('published'),
    is_global: z.boolean().optional(),
    target_department_ids: z.array(z.union([z.string(), z.number()])).optional(),
  }),
});
