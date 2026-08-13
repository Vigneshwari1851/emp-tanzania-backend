export interface CreateEmployeeDTO {
  email: string;
  password?: string;
  username?: string;
  status?: boolean;
  role_id: number;
  is_draft?: boolean;
  bulk_upload?: boolean;
  first_name?: string;
  last_name?: string;
  department_id?: number;
  reporting_manager_id?: number;
  payroll_group_id?: number;
  date_of_birth?: string | Date;
  start_date?: string | Date;
  passport_expiry_date?: string | Date;
  license_expiry_date?: string | Date;
  pan_number?: string;
  aadhaar_number?: string;
  ifsc_code?: string;
  certifications?: any;
  documents?: any;
  [key: string]: any; // Allow other UserDetail fields for flexibility since the schema has many
}

export interface UpdateEmployeeDTO extends Partial<CreateEmployeeDTO> {
  employee_id?: string;
}

export interface EmployeeQueryFilters {
  page?: string | number;
  limit?: string | number;
  search?: string;
  orgId?: number;
  department?: string | string[] | number | number[];
  role?: string | string[] | number | number[];
  location?: string | string[];
  status?: string | string[] | boolean | boolean[];
}

export enum ExportFormat {
  CSV = 'csv',
  EXCEL = 'excel',
  PDF = 'pdf'
}
