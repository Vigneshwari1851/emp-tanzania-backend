export type JobStatus = 'OPEN' | 'CLOSED' | 'DRAFT';
export type SalaryType = 'RANGE' | 'FIXED' | 'UNDISCLOSED';

export interface Job {
  job_id: number;
  organization_id: number | null;
  title: string;
  description: string;
  department: string;
  location: string;
  employment_type: string;
  experience_level: string;
  experience_required: string | null;
  number_of_positions: number;
  remote_option: string;
  
  // Salary & Compensation
  salary_type: SalaryType;
  currency: string;
  min_salary: number | null;
  max_salary: number | null;
  fixed_salary: number | null;
  salary_period: string | null;

  // Descriptions
  job_summary: string;

  // Dynamic Lists (Stored as JSON Arrays)
  responsibilities: string[] | null;
  requirements: string[] | null;
  required_skills: string[] | null;
  preferred_skills: string[] | null;
  benefits: string[] | null;

  // Additional Details
  hiring_manager_id: number | null;
  assigned_recruiter_id: number | null;
  application_deadline: Date | null;
  target_start_date: Date | null;
  interview_rounds: number | null;
  travel_required: string | null;

  status: JobStatus;
  created_at: Date;
  updated_at: Date;
}

export interface JobFilters {
  status?: JobStatus;
  department?: string;
  location?: string;
  search?: string;
  page?: number;
  limit?: number;
}
