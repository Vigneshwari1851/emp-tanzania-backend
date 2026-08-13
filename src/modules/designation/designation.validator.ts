import { z } from 'zod';

export const createDesignationSchema = z.object({
    designation_name: z.string().min(2, 'Designation name must be at least 2 characters'),
    designation_code: z.string().min(2, 'Designation code must be at least 2 characters'),
    description: z.string().optional(),
    parent_designation_id: z.number().nullable().optional(),
    secondary_parent_designation_id: z.number().nullable().optional(),
    secondary_reporting_employee_id: z.number().nullable().optional(),
    department_id: z.number().nullable().optional(),
});

export const updateDesignationSchema = createDesignationSchema.partial();
