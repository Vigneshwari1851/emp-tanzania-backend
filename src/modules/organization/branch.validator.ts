import { z } from "zod";

export const createBranchSchema = z.object({
    body: z.object({
        organization_id: z.number(),
        branch_name: z.string().min(1, "branch_name is required"),
        branch_code: z.string().min(1, "branch_code is required"),
        address: z.string().min(1, "address is required"),
        city: z.string().min(1, "city is required"),
        state: z.string().min(1, "state is required"),
        zip: z.string().min(1, "zip is required"),
        country: z.string().min(1, "country is required"),
        time_zone: z.string().min(1, "time_zone is required"),
        tax_location: z.string().min(1, "tax_location is required"),
        gst: z.string().optional()
    })
});

export const updateBranchSchema = z.object({
    body: z.object({
        organization_id: z.number().optional(),
        branch_name: z.string().optional(),
        branch_code: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        country: z.string().optional(),
        time_zone: z.string().optional(),
        tax_location: z.string().optional(),
        gst: z.string().optional()
    })
});
