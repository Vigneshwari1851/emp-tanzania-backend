import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { RecruitmentEmailService } from './recruitment.email.service';

const prisma = new PrismaClient();

export class ApplicationService {
  // Public application submit is handled in CareersController.
  // This service supports recruiter administrative pipelines.

  static async createApplication(candidate_id: number, job_id: number, actor: any, ip: string | null = null) {
    return prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.findFirst({ where: { id: candidate_id, is_deleted: false } });
      const job = await tx.job.findFirst({ where: { id: job_id, is_deleted: false } });

      if (!candidate) throw new Error('Candidate not found');
      if (!job) throw new Error('Job not found');

      // Check if application already exists
      const existing = await tx.candidateApplication.findFirst({
        where: { candidate_id, job_id, is_deleted: false }
      });
      if (existing) throw new Error('Candidate has already applied for this job');

      const application = await tx.candidateApplication.create({
        data: {
          candidate_id,
          job_id,
          status: 'APPLIED'
        }
      });

      await tx.auditEvent.create({
        data: {
          entity_type: 'APPLICATION',
          entity_id: application.id,
          action_type: 'CREATED',
          new_state: 'APPLIED',
          actor_type: actor?.role || 'RECRUITER',
          actor_id: actor?.id || null,
          ip_address: ip,
          correlation_id: uuidv4(),
          comments: `Application created by recruiter/admin (Actor ID: ${actor?.id || 'SYSTEM'}).`
        }
      });

      return application;
    });
  }

  // GET /applications (List applications with rich filters and search)
  static async getApplications(filters: any) {
    const {
      status,
      job_id,
      location,
      experience,
      skills,
      search,
      applied_date,
      page = '1',
      limit = '10'
    } = filters;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skipNum = (pageNum - 1) * limitNum;

    // Base query filters (ignore soft-deleted applications)
    const whereClause: any = {
      is_deleted: false
    };

    // Stage Status
    if (status) {
      whereClause.status = status;
    }

    // Associated Job
    if (job_id) {
      whereClause.job_id = parseInt(job_id, 10);
    }

    const candidateFilters: any = {
      is_deleted: false,
      is_draft: false
    };

    // Candidate Location
    if (location) {
      candidateFilters.current_location = { contains: location };
    }

    // Candidate Experience (Supports formats: "5+", "1-3", "8")
    if (experience) {
      if (experience.endsWith('+')) {
        const minYears = parseFloat(experience.replace('+', ''));
        candidateFilters.experience_years = { gte: minYears };
      } else if (experience.includes('-')) {
        const [min, max] = experience.split('-').map(parseFloat);
        candidateFilters.experience_years = { gte: min, lte: max };
      } else {
        const years = parseFloat(experience);
        if (!isNaN(years)) {
          candidateFilters.experience_years = { gte: years };
        }
      }
    }

    // Candidate Skills filter (CSV matches)
    if (skills) {
      const skillsList = skills.split(',').map((s: string) => s.trim().toLowerCase());
      if (skillsList.length > 0) {
        candidateFilters.OR = skillsList.map((skill: string) => ({
          skills: { contains: skill }
        }));
      }
    }

    // Search query on Name, Email, Phone, current Designation, or Job Title
    if (search) {
      const searchStr = search.toLowerCase();
      whereClause.OR = [
        {
          candidate: {
            OR: [
              { first_name: { contains: searchStr } },
              { last_name: { contains: searchStr } },
              { email: { contains: searchStr } },
              { phone: { contains: searchStr } },
              { current_designation: { contains: searchStr } }
            ]
          }
        },
        {
          job: {
            title: { contains: searchStr }
          }
        }
      ];
    }

    // Filter by Application Date ranges (e.g. TODAY, WEEK, MONTH)
    if (applied_date) {
      const now = new Date();
      let startDate = new Date();
      if (applied_date === 'TODAY') {
        startDate.setHours(0, 0, 0, 0);
        whereClause.applied_at = { gte: startDate };
      } else if (applied_date === 'WEEK') {
        startDate.setDate(now.getDate() - 7);
        whereClause.applied_at = { gte: startDate };
      } else if (applied_date === 'MONTH') {
        startDate.setMonth(now.getMonth() - 1);
        whereClause.applied_at = { gte: startDate };
      }
    }

    // Attach candidate scope if we added filters to it
    if (Object.keys(candidateFilters).length > 2 || candidateFilters.OR) {
      whereClause.candidate = {
        ...whereClause.candidate,
        ...candidateFilters
      };
    } else {
      whereClause.candidate = { is_deleted: false, is_draft: false };
    }

    // Query DB
    const [applications, total] = await Promise.all([
      prisma.candidateApplication.findMany({
        where: whereClause,
        include: {
          candidate: true,
          job: true
        },
        orderBy: { applied_at: 'desc' },
        skip: skipNum,
        take: limitNum
      }),
      prisma.candidateApplication.count({ where: whereClause })
    ]);

    return {
      applications,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    };
  }

  // GET /applications/:id (Recruiter single detailed lookup with verification timelines)
  static async getApplicationById(id: number) {
    const application = await prisma.candidateApplication.findFirst({
      where: { id, is_deleted: false },
      include: {
        candidate: {
          include: { documents: true }
        },
        job: true,
        offers: true
      }
    });

    if (!application) {
      throw new Error('Application details not found or archived.');
    }

    // Fetch related audit logs for the candidate and the application to draw full timeline
    const auditTimeline = await prisma.auditEvent.findMany({
      where: {
        OR: [
          { entity_type: 'APPLICATION', entity_id: application.id },
          { entity_type: 'CANDIDATE', entity_id: application.candidate_id }
        ]
      },
      orderBy: { timestamp: 'asc' }
    });

    return {
      application,
      timeline: auditTimeline
    };
  }

  // PUT /applications/:id/status (Progress pipeline stage status with immutable logs)
  static async updateStatus(id: number, status: string, actor: any, ip: string | null = null, comment?: string) {
    const validStates = [
      'APPLIED',
      'SCREENING',
      'INTERVIEW_SCHEDULED',
      'INTERVIEW_COMPLETED',
      'SELECTED',
      'OFFER_SENT',
      'OFFER_ACCEPTED',
      'BGV_IN_PROGRESS',
      'BGV_CLEARED',
      'ONBOARDING',
      'EMPLOYEE_CREATED',
      'REJECTED',
      'WITHDRAWN',
      'EXPIRED',
      'NO_SHOW'
    ];

    if (!validStates.includes(status)) {
      throw new Error(`Invalid stage status: ${status}`);
    }

    return prisma.$transaction(async (tx) => {
      const current = await tx.candidateApplication.findFirst({
        where: { id, is_deleted: false }
      });
      if (!current) throw new Error('Application not found');

      // Update state
      const updated = await tx.candidateApplication.update({
        where: { id },
        data: { status }
      });

      // Audit status transition
      await tx.auditEvent.create({
        data: {
          entity_type: 'APPLICATION',
          entity_id: id,
          action_type: 'STATUS_UPDATE',
          previous_state: current.status,
          new_state: status,
          actor_type: actor?.role || 'RECRUITER',
          actor_id: actor?.id || null,
          ip_address: ip,
          correlation_id: uuidv4(),
          comments: comment || `Application status promoted from ${current.status} to ${status} by recruiter.`
        }
      });

      // Fire email notification if selected
      if (status === 'SELECTED') {
        RecruitmentEmailService.sendCandidateSelectedEmail(id).catch(err => {
          console.error('[ApplicationService] Failed to dispatch selected email:', err);
        });
      }

      // Fire email notification if rejected
      if (status === 'REJECTED') {
        RecruitmentEmailService.sendCandidateRejectedEmail(id).catch(err => {
          console.error('[ApplicationService] Failed to dispatch rejected email:', err);
        });
      }

      return updated;
    });
  }

  // POST /applications/:id/reject (Transition applicant stage to REJECTED)
  static async rejectApplication(id: number, actor: any, ip: string | null = null, reason?: string) {
    return this.updateStatus(
      id,
      'REJECTED',
      actor,
      ip,
      reason ? `Application rejected. Reason: ${reason}` : 'Application rejected by recruiter.'
    );
  }

  // POST /applications/:id/withdraw (Transition applicant stage to WITHDRAWN)
  static async withdrawApplication(id: number, actor: any, ip: string | null = null, reason?: string) {
    return this.updateStatus(
      id,
      'WITHDRAWN',
      actor,
      ip,
      reason ? `Application withdrawn by candidate. Remarks: ${reason}` : 'Application marked as withdrawn.'
    );
  }
}
