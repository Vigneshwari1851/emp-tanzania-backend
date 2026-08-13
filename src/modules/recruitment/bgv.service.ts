import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class BgvService {
  // Initiate BGV Case
  static async initiateBgv(application_id: number, actor: any, ip: string | null = null) {
    return prisma.$transaction(async (tx) => {
      const application = await tx.candidateApplication.findUnique({
        where: { id: application_id },
        include: { candidate: true }
      });

      if (!application) throw new Error('Application not found');

      // Check if BGV case already exists
      const existing = await tx.bgvCase.findUnique({ where: { application_id } });
      if (existing) return existing;

      const bgvCase = await tx.bgvCase.create({
        data: {
          application_id,
          candidate_id: application.candidate_id,
          status: 'BGV_INITIATED',
          sla_due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days SLA
        }
      });

      // Default Verifications to perform
      const types = ['IDENTITY', 'ADDRESS', 'EDUCATION', 'EMPLOYMENT', 'CRIMINAL'];
      for (const type of types) {
        await tx.bgvVerification.create({
          data: {
            bgv_case_id: bgvCase.id,
            type,
            status: 'PENDING'
          }
        });
      }

      await tx.candidateApplication.update({
        where: { id: application_id },
        data: { status: 'BGV_IN_PROGRESS' } // Backward compatibility
      });

      await tx.bgvAuditEvent.create({
        data: {
          bgv_case_id: bgvCase.id,
          actor_id: actor?.id,
          actor_type: actor?.role || 'SYSTEM',
          action_type: 'CASE_CREATED',
          new_value: 'BGV_INITIATED',
          ip_address: ip
        }
      });

      return bgvCase;
    });
  }

  // Get BGV Case Details
  static async getCaseDetails(application_id: number) {
    return prisma.bgvCase.findUnique({
      where: { application_id },
      include: {
        verifications: { include: { documents: true } },
        documents: true,
        reviews: { include: { reviewer: true } },
        risk_flags: true,
        audit_events: { orderBy: { created_at: 'desc' } }
      }
    });
  }

  // Calculate Risk Engine
  static async calculateRiskScore(bgv_case_id: string, tx: any) {
    const flags = await tx.bgvRiskFlag.findMany({ where: { bgv_case_id } });
    const totalScore = flags.reduce((acc: number, f: any) => acc + f.score_impact, 0);
    
    let category = 'LOW';
    if (totalScore >= 70) category = 'CRITICAL';
    else if (totalScore >= 40) category = 'HIGH';
    else if (totalScore >= 15) category = 'MEDIUM';

    await tx.bgvCase.update({
      where: { id: bgv_case_id },
      data: { risk_score: totalScore, risk_category: category }
    });

    return { totalScore, category };
  }

  // Upload Document
  static async uploadDocument(bgv_case_id: string, verification_id: string | null, type: string, file_url: string, original_name: string, mime: string, actor: any, ip: string | null = null) {
    return prisma.$transaction(async (tx) => {
      const doc = await tx.bgvDocument.create({
        data: {
          bgv_case_id,
          bgv_verification_id: verification_id,
          document_type: type,
          file_url,
          original_name,
          mime_type: mime,
          status: 'UPLOADED'
        }
      });

      // Update case status
      await tx.bgvCase.update({
        where: { id: bgv_case_id },
        data: { status: 'DOCUMENTS_PENDING' }
      });

      await tx.bgvAuditEvent.create({
        data: {
          bgv_case_id,
          actor_id: actor?.id,
          actor_type: actor?.role || 'SYSTEM',
          action_type: 'DOCUMENT_UPLOADED',
          new_value: type,
          ip_address: ip
        }
      });

      return doc;
    });
  }

  // Update Verification Status
  static async updateVerificationStatus(verification_id: string, status: string, remarks: string, actor: any, ip: string | null = null) {
    return prisma.$transaction(async (tx) => {
      const v = await tx.bgvVerification.update({
        where: { id: verification_id },
        data: { status, remarks, verified_by: actor?.id?.toString() || 'SYSTEM' }
      });

      // Assess Risk if Failed
      if (status === 'FAILED') {
        await tx.bgvRiskFlag.create({
          data: {
            bgv_case_id: v.bgv_case_id,
            rule_name: `${v.type}_VERIFICATION_FAILED`,
            score_impact: 40,
            description: remarks
          }
        });
      }

      await BgvService.calculateRiskScore(v.bgv_case_id, tx);

      // Check global case status
      const allVers = await tx.bgvVerification.findMany({ where: { bgv_case_id: v.bgv_case_id } });
      const anyFailed = allVers.some((ver: any) => ver.status === 'FAILED');
      const allCleared = allVers.every((ver: any) => ver.status === 'VERIFIED');

      let newCaseStatus = 'VERIFICATION_IN_PROGRESS';
      if (anyFailed) newCaseStatus = 'REVIEW_REQUIRED';
      else if (allCleared) newCaseStatus = 'BGV_CLEARED';
      else newCaseStatus = 'PARTIALLY_VERIFIED';

      const bgvCase = await tx.bgvCase.update({
        where: { id: v.bgv_case_id },
        data: { status: newCaseStatus }
      });

      if (newCaseStatus === 'BGV_CLEARED') {
        await tx.candidateApplication.update({
          where: { id: bgvCase.application_id },
          data: { status: 'BGV_CLEARED' }
        });
      }

      await tx.bgvAuditEvent.create({
        data: {
          bgv_case_id: v.bgv_case_id,
          actor_id: actor?.id,
          actor_type: actor?.role || 'SYSTEM',
          action_type: 'VERIFICATION_UPDATED',
          new_value: `${v.type} -> ${status}`,
          reason: remarks,
          ip_address: ip
        }
      });

      return v;
    });
  }

  // HR Review
  static async addReview(bgv_case_id: string, decision: string, remarks: string, actor: any, ip: string | null = null) {
    return prisma.$transaction(async (tx) => {
      const review = await tx.bgvReview.create({
        data: {
          bgv_case_id,
          reviewer_id: actor.id,
          decision,
          remarks
        }
      });

      let newStatus = 'REVIEW_REQUIRED';
      let appStatus = 'BGV_IN_PROGRESS';

      if (decision === 'OVERRIDE_CLEAR') {
        newStatus = 'BGV_CLEARED';
        appStatus = 'BGV_CLEARED';
      } else if (decision === 'REJECT') {
        newStatus = 'FINAL_REJECTED';
        appStatus = 'REJECTED';
      }

      const c = await tx.bgvCase.update({
        where: { id: bgv_case_id },
        data: { status: newStatus, hr_reviewer_id: actor.id }
      });

      await tx.candidateApplication.update({
        where: { id: c.application_id },
        data: { status: appStatus }
      });

      await tx.bgvAuditEvent.create({
        data: {
          bgv_case_id,
          actor_id: actor?.id,
          actor_type: actor?.role || 'SYSTEM',
          action_type: 'HR_REVIEW',
          new_value: decision,
          reason: remarks,
          ip_address: ip
        }
      });

      return review;
    });
  }
}
