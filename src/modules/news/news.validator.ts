import { z } from 'zod';

export const createNewsSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required'),
    content: z.string().trim().min(1, 'Content is required'),
    image: z.string().nullable().optional(),
    access_type: z.enum(['public', 'department']),
    department_ids: z.array(z.number().int()).optional().default([]),
    status: z.enum(['draft', 'published']),
  }),
});

export const updateNewsSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required'),
    content: z.string().trim().min(1, 'Content is required'),
    image: z.string().nullable().optional(),
    access_type: z.enum(['public', 'department']),
    department_ids: z.array(z.number().int()).optional().default([]),
    status: z.enum(['draft', 'published', 'archived']),
  }),
});
