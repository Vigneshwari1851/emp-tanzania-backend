import { z } from "zod";

export const createTeamSchema = z.object({
    body: z.object({
        department_id: z.number(),
        team_name: z.string().min(1, "team_name is required"),
        description: z.string().optional(),
        team_lead_id: z.number().nullable().optional()
    })
});

export const updateTeamSchema = z.object({
    body: z.object({
        department_id: z.number().optional(),
        team_name: z.string().optional(),
        description: z.string().optional(),
        team_lead_id: z.number().nullable().optional()
    })
});
