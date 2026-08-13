import { PrismaClient, InterviewStatus, Recommendation } from '@prisma/client';
import { AuditService } from '../../middlewares/auditService';
import { eventBus } from '../../utils/eventBus';

const prisma = new PrismaClient();

export class InterviewService {
  /** Create a new interview */
  static async createInterview(data: {
    candidateId: number;
    jobId: number;
    roundNumber: number;
    type: string;
    scheduledAt: Date;
    durationMinutes: number;
    interviewerIds: number[];
    notes?: string;
    meetingLink?: string;
  }, actor: any, ip: string | null = null) {
    // Ensure candidate and job belong to same organization
    const [candidate, job] = await Promise.all([
      prisma.candidate.findUnique({ where: { id: data.candidateId }, select: { organization_id: true } }),
      prisma.job.findUnique({ where: { id: data.jobId }, select: { organization_id: true } })
    ]);
    if (!candidate || !job) throw new Error('Candidate or Job not found');
    if (candidate.organization_id !== job.organization_id) {
      throw new Error('Organization mismatch between candidate and job');
    }

    const interview = await prisma.interview.create({
      data: {
        candidate_id: data.candidateId,
        job_id: data.jobId,
        round_number: data.roundNumber,
        type: data.type as any,
        scheduled_at: data.scheduledAt,
        duration_minutes: data.durationMinutes,
        meeting_link: data.meetingLink,
        notes: data.notes,
        interviewers: {
          create: data.interviewerIds.map(id => ({ user_id: id, role: 'INTERVIEWER' })),
        },
      },
    });

    await AuditService.log({
      entity_type: 'INTERVIEW',
      entity_id: interview.id,
      action_type: 'CREATED',
      actor_id: actor?.id,
      actor_role: actor?.role,
      ip_address: ip,
    });
    eventBus.emit('interviewCreated', interview);
    return interview;
  }

  /** Reschedule an interview */
  static async rescheduleInterview(id: number, newDate: Date, actor: any, ip: string | null = null) {
    const interview = await prisma.interview.update({
      where: { id },
      data: {
        scheduled_at: newDate,
        status: InterviewStatus.RESCHEDULED,
      },
    });
    await AuditService.log({
      entity_type: 'INTERVIEW',
      entity_id: id,
      action_type: 'RESCHEDULED',
      actor_id: actor?.id,
      actor_role: actor?.role,
      ip_address: ip,
    });
    eventBus.emit('interviewRescheduled', interview);
    return interview;
  }

  /** Cancel an interview */
  static async cancelInterview(id: number, actor: any, ip: string | null = null) {
    const interview = await prisma.interview.update({
      where: { id },
      data: { status: InterviewStatus.CANCELLED, is_deleted: true, deleted_at: new Date() },
    });
    await AuditService.log({
      entity_type: 'INTERVIEW',
      entity_id: id,
      action_type: 'CANCELLED',
      actor_id: actor?.id,
      actor_role: actor?.role,
      ip_address: ip,
    });
    eventBus.emit('interviewCancelled', interview);
    return interview;
  }

  /** Mark interview as completed */
  static async completeInterview(id: number, actor: any, ip: string | null = null) {
    const interview = await prisma.interview.update({
      where: { id },
      data: { status: InterviewStatus.COMPLETED },
    });
    await AuditService.log({
      entity_type: 'INTERVIEW',
      entity_id: id,
      action_type: 'COMPLETED',
      actor_id: actor?.id,
      actor_role: actor?.role,
      ip_address: ip,
    });
    eventBus.emit('interviewCompleted', interview);
    return interview;
  }

  /** Submit feedback */
  static async submitFeedback(id: number, feedback: {
    technical_rating: number;
    communication_rating: number;
    problem_solving_rating: number;
    culture_fit_rating: number;
    recommendation: Recommendation;
    strengths?: string;
    weaknesses?: string;
    additional_notes?: string;
  }, actor: any, ip: string | null = null) {
    const created = await prisma.interviewFeedback.create({
      data: { interview_id: id, ...feedback },
    });
    // Update interview status based on recommendation
    const newStatus = feedback.recommendation === Recommendation.REJECT ? InterviewStatus.FAILED : InterviewStatus.PASSED;
    await prisma.interview.update({
      where: { id },
      data: { status: newStatus },
    });
    await AuditService.log({
      entity_type: 'INTERVIEW_FEEDBACK',
      entity_id: created.id,
      action_type: 'FEEDBACK_SUBMITTED',
      actor_id: actor?.id,
      actor_role: actor?.role,
      ip_address: ip,
    });
    eventBus.emit('interviewFeedbackSubmitted', { interviewId: id, feedback: created });
    return created;
  }
}

export { eventBus };
