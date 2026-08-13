import { z } from "zod";

const orgConfigSchema = z.object({
    primary_color: z.string().optional().nullable(),
    secondary_color: z.string().optional().nullable(),
    custom_domain: z.string().optional().nullable(),
    sso_provider: z.string().optional().nullable(),
    mfa_policy: z.string().optional().nullable(),
    mfa_required_admins: z.boolean().optional().nullable(),
    billing_contact: z.string().optional().nullable(),
    finance_contact: z.string().optional().nullable(),
    technical_contact: z.string().optional().nullable(),
    legal_contact: z.string().optional().nullable(),
    theme: z.string().optional().nullable(),
    language: z.string().optional().nullable(),
    date_format: z.string().optional().nullable(),
    week_start_day: z.string().optional().nullable(),
    default_landing_page: z.string().optional().nullable(),
    email_notifications: z.boolean().optional().nullable(),
    sms_notifications: z.boolean().optional().nullable(),
    in_app_notifications: z.boolean().optional().nullable(),
    webhooks_enabled: z.boolean().optional().nullable(),
    notification_frequency: z.string().optional().nullable(),
    maintenance_day: z.string().optional().nullable(),
    maintenance_start: z.string().optional().nullable(),
    maintenance_end: z.string().optional().nullable(),
    backup_frequency: z.string().optional().nullable(),
    backup_retention_days: z.number().optional().nullable(),
    rpo_minutes: z.number().optional().nullable(),
    rto_minutes: z.number().optional().nullable(),
}).optional();

export const createOrganizationSchema = z.object({
    body: z.object({
        entity_name: z.string(),
        company_code: z.string().optional(),
        company_type: z.string().optional(),
        jurisdiction: z.string().optional(),
        currency: z.string(),

        fiscal_year_end: z.string().optional(),

        pan: z.string().optional(),
        tin: z.string().optional(),
        sin: z.string().optional(),
        ein: z.string().optional(),
        siret: z.string().optional(),
        other_tax_id: z.string().optional(),

        address: z.string(),
        city: z.string(),
        state: z.string(),
        country: z.string(),
        zip: z.string(),
        logo_url: z.string().optional(),
        business_unit: z.string().optional(),
        cost_center: z.string().optional(),


        payroll_statutory_unit: z.string().optional(),
        legal_employer: z.string().optional(),
        legislative_data_group: z.string().optional(),
        pay_frequency: z.string().optional(),
        standard_working_hours_per_week: z.number(),
        fixed_start_time: z.string().optional(),
        fixed_end_time: z.string().optional(),
        fixed_break_time: z.number().optional(),

        working_days: z.array(z.string()),
        public_holidays: z.array(z.string()),
        schedule_type: z.string().optional(),
        shifts: z.array(z.any()).optional(),
        org_config: orgConfigSchema,

        branch: z.array(
            z.object({
                branch_name: z.string().min(1, "Branch name is required"),
                branch_code: z.string().min(1, "Branch code is required"),
                address: z.string().min(1, "Branch address is required"),
                city: z.string().min(1, "City is required"),
                state: z.string().min(1, "State is required"),
                zip: z.string().min(1, "Zip/postal code is required"),
                country: z.string().min(1, "Country is required"),
                time_zone: z.string().min(1, "Time zone is required"),
                tax_location: z.string().min(1, "Tax location is required"),
                gst: z.string().optional(),
                id: z.number().optional()
            })
        )
    })
});

export const updateOrganizationSchema = z.object({
    body: z.object({
        entity_name: z.string().optional(),
        company_code: z.string().optional(),
        company_type: z.string().optional(),
        jurisdiction: z.string().optional(),
        currency: z.string().optional(),

        fiscal_year_end: z.string().optional(),

        pan: z.string().optional(),
        tin: z.string().optional(),
        sin: z.string().optional(),
        ein: z.string().optional(),
        siret: z.string().optional(),
        other_tax_id: z.string().optional(),

        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        zip: z.string().optional(),
        logo_url: z.string().optional(),
        business_unit: z.string().optional(),
        cost_center: z.string().optional(),

        payroll_statutory_unit: z.string().optional(),
        legal_employer: z.string().optional(),
        legislative_data_group: z.string().optional(),
        pay_frequency: z.string().optional(),
        standard_working_hours_per_week: z.number().optional(),
        fixed_start_time: z.string().optional(),
        fixed_end_time: z.string().optional(),
        fixed_break_time: z.number().optional(),

        working_days: z.array(z.string()).optional(),
        public_holidays: z.array(z.string()).optional(),
        schedule_type: z.string().optional(),
        enable_shifts: z.boolean().optional(),
        shifts: z.array(z.any()).optional(),
        org_config: orgConfigSchema,

        branch: z.array(
            z.object({
                branch_name: z.string().min(1, "Branch name is required"),
                branch_code: z.string().min(1, "Branch code is required"),
                address: z.string().min(1, "Branch address is required"),
                city: z.string().min(1, "City is required"),
                state: z.string().min(1, "State is required"),
                zip: z.string().min(1, "Zip/postal code is required"),
                country: z.string().min(1, "Country is required"),
                time_zone: z.string().min(1, "Time zone is required"),
                tax_location: z.string().min(1, "Tax location is required"),
                gst: z.string().optional(),
                id: z.number().optional()
            })
        ).optional()
    })
});

export const updateShiftSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Shift name is required"),
        startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid start time format (HH:MM)"),
        endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid end time format (HH:MM)"),
        breakTime: z.number().nonnegative("Break time must be non-negative").optional(),
        icon: z.enum(['sunrise', 'sun', 'moon']).optional(),
        color: z.string().optional()
    })
});