import { z } from "zod";

export const createDepartmentSchema = z.object({
    body: z.object({
        department_name: z.string().min(1, "department_name is required"),
        department_code: z.string().min(1, "department_code is required"),
        branch_id: z.number(),
        description: z.string().optional(),
        parent_department_id: z.number().nullable().optional(),
        annual_budget: z.number().optional(),
        manager_id: z.number().nullable().optional(),
        cost_center: z.string().nullable().optional(),
        teams: z.array(
            z.object({
                team_name: z.string().min(1, "team_name is required for nested team"),
                description: z.string().optional(),
                team_lead_id: z.number().nullable().optional()
            })
        ).optional().default([])
    })
});

export const updateDepartmentSchema = z.object({
    body: z.object({
        department_name: z.string().optional(),
        department_code: z.string().optional(),
        branch_id: z.number().optional(),
        description: z.string().optional(),
        parent_department_id: z.number().nullable().optional(),
        annual_budget: z.number().optional(),
        manager_id: z.number().nullable().optional(),
        cost_center: z.string().nullable().optional(),
        teams: z.array(
            z.object({
                id: z.number().optional(), // For identifying existing teams to update
                team_name: z.string().optional(),
                description: z.string().optional(),
                team_lead_id: z.number().nullable().optional()
            })
        ).optional()
    })
});