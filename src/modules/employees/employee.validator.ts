import { z } from 'zod';

const coerceBoolean = z.preprocess((val) => {
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'on') return true;
    if (s === 'false' || s === '0' || s === 'off') return false;
    if (s === '') return undefined;
  }
  return val;
}, z.boolean().optional());

const coerceNumber = z.preprocess((val) => {
  if (val === null || val === 'null' || (typeof val === 'string' && val.trim() === '')) return null;
  return val;
}, z.coerce.number().nullable().optional());

const coerceArray = (schema: z.ZodTypeAny) => z.preprocess((val) => {
  if (typeof val === 'string') {
    const s = val.trim();
    if (s === '') return [];
    try {
      return JSON.parse(s);
    } catch {
      return s.split(',').map(item => item.trim()).filter(Boolean);
    }
  }
  return val;
}, z.array(schema));

const trimString = z.string().trim();
const trimEmail = z.string().trim().email();

const trimEmailOptional = z.preprocess((val) => {
  if (val === null || val === 'null' || val === 'undefined' || (typeof val === 'string' && val.trim() === '')) {
    return null;
  }
  return val;
}, z.string().trim().email().nullable().optional());

const trimStringOptional = z.preprocess((val) => {
  if (val === null || val === 'null' || val === 'undefined' || (typeof val === 'string' && val.trim() === '')) {
    return null;
  }
  return val;
}, z.string().trim().nullable().optional());

const employeeBaseFields = {
  // User Authentication Details
  email: trimEmail,
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  username: trimString.optional(),
  status: coerceBoolean,
  is_draft: coerceBoolean,
  bulk_upload: coerceBoolean,
  role_id: z.preprocess((val) => (val === '' ? undefined : val), z.coerce.number().optional()),
};

const personalFields = {
  first_name: trimString,
  last_name: trimString,
  middle_name: trimString.optional(),
  date_of_birth: trimString,
  gender: trimString,
  nationality: trimString.optional(),
  marital_status: trimString.optional(),
  blood_group: trimString.optional(),
};

const contactFields = {
  phone: trimString,
  secondary_phone: trimString.optional(),
  secondary_email: trimEmailOptional.optional(),
};

const addressFields = {
  address: trimString,
  city: trimString,
  state: trimString,
  zip: trimString,
  country: trimString,
};

const emergencyFields = {
  emergency_contact: trimString,
  emergency_relationship: trimString,
  emergency_phone: trimString,
  emergency_email: trimEmailOptional.optional(),
};

const jobFields = {
  employee_id: trimString.optional(),
  department_id: z.coerce.number(),
  team_id: coerceNumber,
  employment_type: trimString,
  start_date: trimString,
  work_location: trimString,
  work_schedule: trimString.optional(),
  reporting_manager_id: coerceNumber,
  probation_period: coerceNumber,
  designation_id: coerceNumber,
  sub_status: trimString.optional(),
};

const compensationFields = {
  base_salary: z.coerce.number(),
  currency: trimString.optional(),
  salary_frequency: trimString.optional(),
  compensation_breakdown: z.unknown().optional(),
  payroll_group_id: coerceNumber,
};

const bankFields = {
  bank_name: trimString,
  branch_name: trimString.optional(),
  account_holder_name: trimString,
  account_number: trimString,
  ifsc_code: trimString.optional(),
};

const backgroundFields = {
  family_members: coerceArray(z.unknown()).optional(),
  education: coerceArray(z.unknown()).optional(),
  employment_history: coerceArray(z.unknown()).optional(),
  skills: coerceArray(z.string()).optional(),
  certifications: coerceArray(z.unknown()).optional(),
  languages: coerceArray(z.unknown()).optional(),
};

const documentFields = {
  passport_number: trimStringOptional,
  passport_expiry_date: trimStringOptional,
  driving_license_number: trimStringOptional,
  license_expiry_date: trimStringOptional,
  pan_number: trimStringOptional,
  aadhaar_number: trimStringOptional,
  nssf_number: trimStringOptional,
  is_heslb_beneficiary: coerceBoolean.optional(),
  heslb_index_number: trimStringOptional,
  is_disabled: coerceBoolean.optional(),
};

const mediaFields = {
  profile_picture: trimString.optional(),
  resume: trimString.optional(),
  certificate_files: coerceArray(z.string()).optional(),
  documents: coerceArray(z.string()).optional(),
};

// Lenient Schema for Drafts
const draftSchema = z.object({
  ...employeeBaseFields,
  password: z.string().optional(), // Drafts don't strictly need password validation
  ...Object.fromEntries(Object.keys(personalFields).map(k => [k, trimStringOptional])),
  ...Object.fromEntries(Object.keys(contactFields).map(k => [k, trimStringOptional])),
  ...Object.fromEntries(Object.keys(addressFields).map(k => [k, trimStringOptional])),
  ...Object.fromEntries(Object.keys(emergencyFields).map(k => [k, trimStringOptional])),
  ...Object.fromEntries(Object.keys(jobFields).map(k => [k, (jobFields as any)[k].optional()])),
  ...Object.fromEntries(Object.keys(compensationFields).map(k => [k, (compensationFields as any)[k].optional()])),
  ...Object.fromEntries(Object.keys(bankFields).map(k => [k, trimStringOptional])),
  ...backgroundFields,
  ...documentFields,
  ...mediaFields,
});

// Strict Schema for Final Submission
const fullSchema = z.object({
  ...employeeBaseFields,
  ...personalFields,
  ...contactFields,
  ...addressFields,
  ...emergencyFields,
  ...jobFields,
  ...compensationFields,
  ...bankFields,
  ...backgroundFields,
  ...documentFields,
  ...mediaFields,
}).extend({
  // Enforce specific requirements for full submission
  first_name: trimString.min(1, 'First name is required'),
  last_name: trimString.min(1, 'Last name is required'),
  date_of_birth: trimString.min(1, 'Date of birth is required'),
  gender: trimString.min(1, 'Gender is required'),
  phone: trimString.min(1, 'Primary phone is required'),
  address: trimString.min(1, 'Street address is required'),
  city: trimString.min(1, 'City is required'),
  state: trimString.min(1, 'State is required'),
  zip: trimString.min(1, 'Zip/Postal code is required'),
  country: trimString.min(1, 'Country is required'),
  emergency_contact: trimString.min(1, 'Emergency contact name is required'),
  emergency_relationship: trimString.min(1, 'Emergency relationship is required'),
  emergency_phone: trimString.min(1, 'Emergency phone is required'),
  department_id: z.coerce.number().min(1, 'Department is required'),
  team_id: z.coerce.number().min(1, 'Team is required'),
  employment_type: trimString.min(1, 'Employment type is required'),
  start_date: trimString.min(1, 'Start date is required'),
  work_location: trimString.min(1, 'Work location is required'),
  base_salary: z.coerce.number().min(1, 'Base salary is required'),
  bank_name: trimString.min(1, 'Bank name is required'),
  account_holder_name: trimString.min(1, 'Account holder name is required'),
  account_number: trimString.min(1, 'Account number is required'),
  role_id: z.preprocess((val) => (val === '' ? undefined : val), z.coerce.number().min(1, 'Role ID is required')),
});

// Strict Schema for Update (allowing partial updates of fields, skipping password and parsing numbers safely)
const updateFullSchema = z.object({
  // Base Fields (all optional on update)
  email: trimEmail.optional(),
  password: z.preprocess((val) => {
    if (typeof val === 'string' && val.trim() === '') return undefined;
    return val;
  }, z.string().min(6, 'Password must be at least 6 characters long').optional()),
  username: trimString.optional(),
  status: coerceBoolean,
  is_draft: coerceBoolean,
  role_id: z.preprocess((val) => {
    if (val === undefined || val === null || val === 'null' || val === 'undefined' || (typeof val === 'string' && val.trim() === '')) {
      return undefined;
    }
    const parsed = Number(val);
    return isNaN(parsed) ? undefined : parsed;
  }, z.number().min(1).optional()),

  // Personal Fields
  first_name: trimString.min(1, 'First name cannot be empty').optional(),
  last_name: trimString.min(1, 'Last name cannot be empty').optional(),
  middle_name: trimStringOptional,
  date_of_birth: trimString.optional(),
  gender: trimString.min(1, 'Gender cannot be empty').optional(),
  nationality: trimStringOptional,
  marital_status: trimStringOptional,
  blood_group: trimStringOptional,

  // Contact Fields
  phone: trimString.min(1, 'Phone cannot be empty').optional(),
  secondary_phone: trimStringOptional,
  secondary_email: trimEmailOptional.optional(),

  // Address Fields
  address: trimString.min(1, 'Address cannot be empty').optional(),
  city: trimString.min(1, 'City cannot be empty').optional(),
  state: trimString.min(1, 'State cannot be empty').optional(),
  zip: trimString.min(1, 'Zip cannot be empty').optional(),
  country: trimString.min(1, 'Country cannot be empty').optional(),

  // Emergency Fields
  emergency_contact: trimString.min(1, 'Emergency contact cannot be empty').optional(),
  emergency_relationship: trimString.min(1, 'Emergency relationship cannot be empty').optional(),
  emergency_phone: trimString.min(1, 'Emergency phone cannot be empty').optional(),
  emergency_email: trimEmailOptional.optional(),

  // Job Fields
  employee_id: trimString.optional(),
  department_id: z.preprocess((val) => {
    if (val === undefined || val === null || val === 'null' || val === 'undefined' || (typeof val === 'string' && val.trim() === '')) {
      return undefined;
    }
    const parsed = Number(val);
    return isNaN(parsed) ? undefined : parsed;
  }, z.number().min(1).optional()),
  team_id: z.preprocess((val) => {
    if (val === null || val === 'null' || (typeof val === 'string' && val.trim() === '')) {
      return null;
    }
    if (val === undefined || val === 'undefined') {
      return undefined;
    }
    const parsed = Number(val);
    return isNaN(parsed) ? undefined : parsed;
  }, z.number().min(1).nullable().optional()),
  employment_type: trimString.min(1, 'Employment type cannot be empty').optional(),
  sub_status: trimStringOptional,
  start_date: trimString.optional(),
  work_location: trimString.min(1, 'Work location cannot be empty').optional(),
  work_schedule: trimStringOptional,
  reporting_manager_id: z.preprocess((val) => {
    if (val === null || val === 'null' || (typeof val === 'string' && val.trim() === '')) {
      return null;
    }
    if (val === undefined || val === 'undefined') {
      return undefined;
    }
    const parsed = Number(val);
    return isNaN(parsed) ? undefined : parsed;
  }, z.number().nullable().optional()),
  designation_id: z.preprocess((val) => {
    if (val === null || val === 'null' || (typeof val === 'string' && val.trim() === '')) {
      return null;
    }
    if (val === undefined || val === 'undefined') {
      return undefined;
    }
    const parsed = Number(val);
    return isNaN(parsed) ? undefined : parsed;
  }, z.number().nullable().optional()),
  probation_period: z.preprocess((val) => {
    if (val === null || val === 'null' || (typeof val === 'string' && val.trim() === '')) {
      return null;
    }
    if (val === undefined || val === 'undefined') {
      return undefined;
    }
    const parsed = Number(val);
    return isNaN(parsed) ? undefined : parsed;
  }, z.number().nullable().optional()),

  // Compensation Fields
  base_salary: z.preprocess((val) => {
    if (val === undefined || val === null || val === 'null' || val === 'undefined' || (typeof val === 'string' && val.trim() === '')) {
      return undefined;
    }
    const parsed = Number(val);
    return isNaN(parsed) ? undefined : parsed;
  }, z.number().optional()),
  currency: trimStringOptional,
  salary_frequency: trimStringOptional,
  compensation_breakdown: z.unknown().optional(),
  payroll_group_id: z.preprocess((val) => {
    if (val === null || val === 'null' || (typeof val === 'string' && val.trim() === '')) {
      return null;
    }
    if (val === undefined || val === 'undefined') {
      return undefined;
    }
    const parsed = Number(val);
    return isNaN(parsed) ? undefined : parsed;
  }, z.number().nullable().optional()),

  // Bank Fields
  bank_name: trimString.min(1, 'Bank name cannot be empty').optional(),
  branch_name: trimStringOptional,
  account_holder_name: trimString.min(1, 'Account holder name cannot be empty').optional(),
  account_number: trimString.min(1, 'Account number cannot be empty').optional(),
  ifsc_code: trimStringOptional,

  // Background, Document & Media Fields
  ...backgroundFields,
  ...documentFields,
  ...mediaFields,
});

export const createEmployeeSchema = z.object({
  body: z.preprocess((data: any) => {
    // Robustly detect is_draft
    const isDraft = data.is_draft === 'true' || data.is_draft === true || data.is_draft === 1 || data.is_draft === '1';
    data.is_draft = isDraft;
    return data;
  }, z.discriminatedUnion('is_draft', [
    draftSchema.extend({ is_draft: z.literal(true) }),
    fullSchema.extend({ is_draft: z.literal(false) })
  ]))
});

export const updateEmployeeSchema = z.object({
  body: z.preprocess((data: any) => {
    // Robustly detect is_draft
    const isDraft = data.is_draft === 'true' || data.is_draft === true || data.is_draft === 1 || data.is_draft === '1';
    data.is_draft = isDraft;
    return data;
  }, z.discriminatedUnion('is_draft', [
    // Draft Update: Lenient (same as draftSchema but everything optional)
    draftSchema.partial().extend({ is_draft: z.literal(true) }),
    // Full Update: Strict about types but allows optional fields on update
    updateFullSchema.extend({ is_draft: z.literal(false) })
  ]))
});
