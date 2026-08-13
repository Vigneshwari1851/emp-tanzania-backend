import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseOptionalInt(val: any): number | null {
  if (val === undefined || val === null || val === '' || String(val) === 'NaN') return null;
  const num = Number(val);
  return Number.isNaN(num) ? null : num;
}

function parseIntOrDefault(val: any, defaultVal: number): number {
  if (val === undefined || val === null || val === '' || String(val) === 'NaN') return defaultVal;
  const num = Number(val);
  return Number.isNaN(num) ? defaultVal : num;
}

function mapPrismaJobToDomain(job: any): any {
  if (!job) return null;
  const isFixed = job.salary_type === 'FIXED';

  let screening_count = 0;
  let interviews_count = 0;
  let offers_count = 0;

  if (job.applications && Array.isArray(job.applications)) {
    job.applications.forEach((app: any) => {
      const status = app.status;
      if (['APPLIED', 'SCREENING', 'SHORTLISTED'].includes(status)) screening_count++;
      else if (['INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED'].includes(status)) interviews_count++;
      else if (['OFFER_EXTENDED', 'OFFER_ACCEPTED', 'BGV_INITIATED', 'DOCUMENTS_PENDING', 'VERIFICATION_IN_PROGRESS', 'PARTIALLY_VERIFIED', 'REVIEW_REQUIRED', 'ADVERSE_FOUND', 'BGV_IN_PROGRESS', 'BGV_CLEARED', 'BGV_FAILED', 'ONBOARDING'].includes(status)) offers_count++;
    });
  }

  // Dynamic auto-close if offers meet/exceed openings count
  let dynamicStatus = job.status;
  if (dynamicStatus === 'OPEN' && offers_count > 0 && offers_count >= (job.openings_count || 1)) {
    dynamicStatus = 'CLOSED';
  }

  return {
    ...job,
    job_id: job.id,
    fixed_salary: isFixed ? (job.min_salary ? Number(job.min_salary) : null) : null,
    min_salary: job.min_salary ? Number(job.min_salary) : null,
    max_salary: job.max_salary ? Number(job.max_salary) : null,
    screening_count,
    interviews_count,
    offers_count,
    status: dynamicStatus
  };
}

export class JobService {
  static async createJob(data: any, actor: any, ip: string | null = null) {
    return prisma.$transaction(async (tx) => {
      let min_salary = parseOptionalInt(data.min_salary);
      let max_salary = parseOptionalInt(data.max_salary);
      if (data.salary_type === 'FIXED' && data.fixed_salary) {
        const fixedVal = parseOptionalInt(data.fixed_salary);
        min_salary = fixedVal;
        max_salary = fixedVal;
      }
      
      const orgId = parseIntOrDefault(data.organization_id || actor?.orgId, 1);

      const job = await tx.job.create({
        data: {
          title: data.title,
          department: data.department,
          location: data.location,
          employment_type: data.employment_type || 'Full-time',
          experience_level: data.experience_level || 'Entry Level',
          remote_option: data.remote_option || 'On-site',
          openings_count: parseIntOrDefault(data.openings_count, 1),
          salary_type: data.salary_type || 'UNDISCLOSED',
          currency: data.currency || 'INR',
          min_salary,
          max_salary,
          salary_period: data.salary_period || null,
          job_summary: data.job_summary || '',
          description: data.description || '',
          responsibilities: data.responsibilities || [],
          requirements: data.requirements || [],
          required_skills: data.required_skills || [],
          preferred_skills: data.preferred_skills || [],
          benefits: data.benefits || [],
          status: data.status || 'DRAFT',
          hiring_manager_id: parseOptionalInt(data.hiring_manager_id),
          assigned_recruiter_id: parseOptionalInt(data.assigned_recruiter_id),
          application_deadline: data.application_deadline ? new Date(data.application_deadline) : null,
          target_start_date: data.target_start_date ? new Date(data.target_start_date) : null,
          interview_rounds: parseOptionalInt(data.interview_rounds),
          organization_id: orgId,
        }
      });

      await tx.auditEvent.create({
        data: {
          entity_type: 'JOB',
          entity_id: job.id,
          action_type: 'CREATED',
          new_state: job.status,
          actor_type: actor?.role || 'SYSTEM',
          actor_id: actor?.id,
          ip_address: ip
        }
      });

      return mapPrismaJobToDomain(job);
    });
  }

  static async updateJob(job_id: number, data: any, actor: any, ip: string | null = null) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.job.findUnique({ where: { id: job_id } });
      if (!existing) throw new Error('Job not found');

      let min_salary = data.min_salary !== undefined ? parseOptionalInt(data.min_salary) : existing.min_salary;
      let max_salary = data.max_salary !== undefined ? parseOptionalInt(data.max_salary) : existing.max_salary;
      const salary_type = data.salary_type !== undefined ? data.salary_type : existing.salary_type;
      
      if (salary_type === 'FIXED') {
        const fixedVal = data.fixed_salary !== undefined ? parseOptionalInt(data.fixed_salary) : (existing.min_salary ? Number(existing.min_salary) : null);
        min_salary = fixedVal;
        max_salary = fixedVal;
      }

      const job = await tx.job.update({
        where: { id: job_id },
        data: {
          title: data.title !== undefined ? data.title : existing.title,
          department: data.department !== undefined ? data.department : existing.department,
          location: data.location !== undefined ? data.location : existing.location,
          employment_type: data.employment_type !== undefined ? data.employment_type : existing.employment_type,
          experience_level: data.experience_level !== undefined ? data.experience_level : existing.experience_level,
          remote_option: data.remote_option !== undefined ? data.remote_option : existing.remote_option,
          openings_count: data.openings_count !== undefined ? parseIntOrDefault(data.openings_count, existing.openings_count) : existing.openings_count,
          salary_type,
          currency: data.currency !== undefined ? data.currency : existing.currency,
          min_salary,
          max_salary,
          salary_period: data.salary_period !== undefined ? data.salary_period : existing.salary_period,
          job_summary: data.job_summary !== undefined ? data.job_summary : existing.job_summary,
          description: data.description !== undefined ? data.description : existing.description,
          responsibilities: data.responsibilities !== undefined ? data.responsibilities : existing.responsibilities,
          requirements: data.requirements !== undefined ? data.requirements : existing.requirements,
          required_skills: data.required_skills !== undefined ? data.required_skills : existing.required_skills,
          preferred_skills: data.preferred_skills !== undefined ? data.preferred_skills : existing.preferred_skills,
          benefits: data.benefits !== undefined ? data.benefits : existing.benefits,
          status: data.status !== undefined ? data.status : existing.status,
          hiring_manager_id: data.hiring_manager_id !== undefined ? parseOptionalInt(data.hiring_manager_id) : existing.hiring_manager_id,
          assigned_recruiter_id: data.assigned_recruiter_id !== undefined ? parseOptionalInt(data.assigned_recruiter_id) : existing.assigned_recruiter_id,
          application_deadline: data.application_deadline ? new Date(data.application_deadline) : existing.application_deadline,
          target_start_date: data.target_start_date ? new Date(data.target_start_date) : existing.target_start_date,
          interview_rounds: data.interview_rounds !== undefined ? parseOptionalInt(data.interview_rounds) : existing.interview_rounds,
          travel_required: data.travel_required !== undefined ? data.travel_required : existing.travel_required,
        }
      });

      await tx.auditEvent.create({
        data: {
          entity_type: 'JOB',
          entity_id: job.id,
          action_type: 'UPDATED',
          previous_state: existing.status,
          new_state: job.status,
          actor_type: actor?.role || 'SYSTEM',
          actor_id: actor?.id,
          ip_address: ip
        }
      });

      return mapPrismaJobToDomain(job);
    });
  }

  static async updateJobStatus(job_id: number, status: string, actor: any, ip: string | null = null) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.job.findUnique({ where: { id: job_id } });
      if (!existing) throw new Error('Job not found');

      const job = await tx.job.update({
        where: { id: job_id },
        data: { status }
      });

      await tx.auditEvent.create({
        data: {
          entity_type: 'JOB',
          entity_id: job.id,
          action_type: 'STATUS_CHANGE',
          previous_state: existing.status,
          new_state: job.status,
          actor_type: actor?.role || 'SYSTEM',
          actor_id: actor?.id,
          ip_address: ip
        }
      });

      return mapPrismaJobToDomain(job);
    });
  }

  static async getAllJobs() {
    const jobs = await prisma.job.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        _count: {
          select: { applications: true }
        },
        applications: {
          select: { status: true }
        }
      }
    });
    return jobs.map(mapPrismaJobToDomain);
  }

  static async getJobById(job_id: number) {
    const job = await prisma.job.findUnique({
      where: { id: job_id },
      include: {
        _count: {
          select: { applications: true }
        },
        applications: {
          select: { status: true }
        }
      }
    });
    return mapPrismaJobToDomain(job);
  }

  static async getJobApplications(job_id: number) {
    return prisma.candidateApplication.findMany({
      where: { job_id, candidate: { is_draft: false } },
      include: {
        candidate: true,
        interviews: true
      }
    });
  }
}
