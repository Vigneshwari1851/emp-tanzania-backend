import { z } from 'zod';

export const CompensationComponentSchema = z.object({
  type: z.string().min(1, 'Compensation type is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('INR'),
  frequency: z.enum(['MONTHLY', 'ANNUAL']).default('ANNUAL'),
  description: z.string().optional(),
});

export const CreateOfferSchema = z.object({
  candidate_id: z.number({ message: 'Candidate ID is required' }),
  job_id: z.number({ message: 'Job ID is required' }),
  application_id: z.number({ message: 'Application ID is required' }),
  joining_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid joining date format',
  }),
  expiry_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid expiry date format',
  }),
  work_location: z.string().min(1, 'Work location is required'),
  work_mode: z.string().min(1, 'Work mode is required'), // e.g. "Remote", "On-site", "Hybrid"
  probation_period: z.number().default(0), // in months or days
  reporting_manager: z.string().min(1, 'Reporting manager is required'),
  notice_clauses: z.string().optional(),
  confidentiality: z.string().optional(),
  employment_conds: z.string().optional(),
  additional_terms: z.string().optional(),
  compensation: z.array(CompensationComponentSchema).min(1, 'At least one compensation component is required'),
});

export const UpdateOfferSchema = CreateOfferSchema.partial();

export const NegotiationSchema = z.object({
  comment: z.string().min(1, 'Negotiation comment is required'),
});

export const ApproveOfferSchema = z.object({
  comment: z.string().optional(),
});
