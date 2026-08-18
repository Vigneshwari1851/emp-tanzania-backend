import { PrismaClient } from '@prisma/client';
import { RecruitmentEmailService } from './recruitment.email.service';

const prisma = new PrismaClient();

function extractSmartExperience(experienceHistory: any[] | null | undefined) {
  if (!experienceHistory || !Array.isArray(experienceHistory) || experienceHistory.length === 0) {
    return {
      current_company: null,
      experience_years: null
    };
  }

  const sorted = [...experienceHistory].sort((a, b) => {
    if (!a.end_date || a.end_date.toLowerCase() === 'present') return -1;
    if (!b.end_date || b.end_date.toLowerCase() === 'present') return 1;
    return new Date(b.end_date).getTime() - new Date(a.end_date).getTime();
  });
  const currentCompany = sorted[0]?.company_name || null;

  let totalYears = 0;
  for (const exp of experienceHistory) {
    if (exp.start_date) {
      const start = new Date(exp.start_date);
      const end = (!exp.end_date || exp.end_date.toLowerCase() === 'present') ? new Date() : new Date(exp.end_date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
      totalYears += diffYears;
    }
  }

  return {
    current_company: currentCompany,
    experience_years: totalYears > 0 ? Number(totalYears.toFixed(1)) : null
  };
}

function extractSmartEducation(educationHistory: any[] | null | undefined) {
  if (!educationHistory || !Array.isArray(educationHistory) || educationHistory.length === 0) {
    return {
      highest_degree: null,
      specialization: null,
      university: null,
      graduation_year: null,
      gpa_percentage: null
    };
  }

  const sorted = [...educationHistory].sort((a, b) => {
    const yearA = Number(a.graduation_year) || 0;
    const yearB = Number(b.graduation_year) || 0;
    return yearB - yearA;
  });

  const latest = sorted[0];
  return {
    highest_degree: latest.degree || null,
    specialization: latest.specialization || null,
    university: latest.university || null,
    graduation_year: latest.graduation_year ? Number(latest.graduation_year) : null,
    gpa_percentage: latest.gpa_percentage ? Number(latest.gpa_percentage) : null
  };
}

export class CandidateService {
  static async createCandidate(data: any, actor: any, ip: string | null = null) {
    return prisma.$transaction(async (tx) => {
      // Check if email already exists
      const existingCandidate = await tx.candidate.findUnique({ where: { email: data.email } });
      let candidate;

      const expHistory = data.experience_history || null;
      const eduHistory = data.education_history || null;

      const smartExp = extractSmartExperience(expHistory);
      const smartEdu = extractSmartEducation(eduHistory);

      const payload = {
        organization_id: actor?.organization_id || null,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone || null,
        gender: data.gender || null,
        dob: data.dob ? new Date(data.dob) : null,
        address: data.address || null,
        experience_years: smartExp.experience_years !== null ? smartExp.experience_years : (data.experience_years ? Number(data.experience_years) : null),
        current_company: smartExp.current_company !== null ? smartExp.current_company : (data.current_company || null),
        current_ctc: data.current_ctc ? Number(data.current_ctc) : null,
        expected_ctc: data.expected_ctc ? Number(data.expected_ctc) : null,
        notice_period_days: data.notice_period_days ? Number(data.notice_period_days) : null,
        skills: data.skills || null,
        resume_url: data.resume_url || null,
        linkedin_url: data.linkedin_url || null,
        github_url: data.github_url || null,
        portfolio_url: data.portfolio_url || null,
        source: data.source || null,
        highest_degree: smartEdu.highest_degree !== null ? smartEdu.highest_degree : (data.highest_degree || null),
        specialization: smartEdu.specialization !== null ? smartEdu.specialization : (data.specialization || null),
        university: smartEdu.university !== null ? smartEdu.university : (data.university || null),
        graduation_year: smartEdu.graduation_year !== null ? smartEdu.graduation_year : (data.graduation_year ? Number(data.graduation_year) : null),
        gpa_percentage: smartEdu.gpa_percentage !== null ? smartEdu.gpa_percentage : (data.gpa_percentage ? Number(data.gpa_percentage) : null),
        experience_history: expHistory,
        education_history: eduHistory,
        is_draft: false
      };

      if (existingCandidate) {
        if (!existingCandidate.is_draft) {
          throw new Error('A candidate with this email already exists.');
        }
        // Promote draft candidate to active candidate
        candidate = await tx.candidate.update({
          where: { id: existingCandidate.id },
          data: payload
        });

        await tx.auditEvent.create({
          data: {
            entity_type: 'CANDIDATE',
            entity_id: candidate.id,
            action_type: 'DRAFT_PROMOTED',
            actor_type: actor?.role || 'SYSTEM',
            actor_id: actor?.id || null,
            ip_address: ip
          }
        });
      } else {
        // Create Candidate
        candidate = await tx.candidate.create({
          data: payload
        });

        await tx.auditEvent.create({
          data: {
            entity_type: 'CANDIDATE',
            entity_id: candidate.id,
            action_type: 'CREATED',
            actor_type: actor?.role || 'SYSTEM',
            actor_id: actor?.id || null,
            ip_address: ip
          }
        });
      }

      // If job_id is provided, automatically map them via CandidateApplication
      if (data.job_id) {
        const existingApp = await tx.candidateApplication.findFirst({
          where: { candidate_id: candidate.id, job_id: Number(data.job_id), is_deleted: false }
        });
        if (!existingApp) {
          const application = await tx.candidateApplication.create({
            data: {
              candidate_id: candidate.id,
              job_id: Number(data.job_id),
              status: 'APPLIED'
            }
          });

          await tx.auditEvent.create({
            data: {
              entity_type: 'APPLICATION',
              entity_id: application.id,
              action_type: 'CREATED',
              new_state: 'APPLIED',
              actor_type: actor?.role || 'SYSTEM',
              actor_id: actor?.id || null,
              ip_address: ip
            }
          });
        }
      }

      return candidate;
    });
  }

  static async saveDraft(data: any, actor: any, ip: string | null = null) {
    return prisma.$transaction(async (tx) => {
      // Relax required fields by generating defaults
      const firstName = data.first_name?.trim() || 'Draft Candidate';
      const lastName = data.last_name?.trim() || 'Draft';
      let email = data.email?.trim();

      if (!email) {
        // Generate robust placeholder email to satisfy unique constraint
        email = `draft_${Date.now()}_${Math.floor(Math.random() * 10000)}@lattium.com`;
      } else {
        // Check duplicate email logic for draft
        const existing = await tx.candidate.findUnique({ where: { email } });
        if (existing && !existing.is_draft) {
          throw new Error('A candidate with this email already exists.');
        }
      }

      const expHistory = data.experience_history || null;
      const eduHistory = data.education_history || null;

      const smartExp = extractSmartExperience(expHistory);
      const smartEdu = extractSmartEducation(eduHistory);

      const payload = {
        organization_id: actor?.organization_id || null,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: data.phone || null,
        gender: data.gender || null,
        dob: data.dob ? new Date(data.dob) : null,
        address: data.address || null,
        experience_years: smartExp.experience_years !== null ? smartExp.experience_years : (data.experience_years ? Number(data.experience_years) : null),
        current_company: smartExp.current_company !== null ? smartExp.current_company : (data.current_company || null),
        current_ctc: data.current_ctc ? Number(data.current_ctc) : null,
        expected_ctc: data.expected_ctc ? Number(data.expected_ctc) : null,
        notice_period_days: data.notice_period_days ? Number(data.notice_period_days) : null,
        skills: data.skills || null,
        resume_url: data.resume_url || null,
        source: data.source || null,
        highest_degree: smartEdu.highest_degree !== null ? smartEdu.highest_degree : (data.highest_degree || null),
        specialization: smartEdu.specialization !== null ? smartEdu.specialization : (data.specialization || null),
        university: smartEdu.university !== null ? smartEdu.university : (data.university || null),
        graduation_year: smartEdu.graduation_year !== null ? smartEdu.graduation_year : (data.graduation_year ? Number(data.graduation_year) : null),
        gpa_percentage: smartEdu.gpa_percentage !== null ? smartEdu.gpa_percentage : (data.gpa_percentage ? Number(data.gpa_percentage) : null),
        experience_history: expHistory,
        education_history: eduHistory,
        is_draft: true
      };

      let candidate;
      const existingDraft = await tx.candidate.findUnique({ where: { email } });
      if (existingDraft && existingDraft.is_draft) {
        candidate = await tx.candidate.update({
          where: { id: existingDraft.id },
          data: payload
        });

        await tx.auditEvent.create({
          data: {
            entity_type: 'CANDIDATE',
            entity_id: candidate.id,
            action_type: 'DRAFT_UPDATED',
            actor_type: actor?.role || 'SYSTEM',
            actor_id: actor?.id || null,
            ip_address: ip
          }
        });
      } else {
        candidate = await tx.candidate.create({
          data: payload
        });

        await tx.auditEvent.create({
          data: {
            entity_type: 'CANDIDATE',
            entity_id: candidate.id,
            action_type: 'DRAFT_CREATED',
            actor_type: actor?.role || 'SYSTEM',
            actor_id: actor?.id || null,
            ip_address: ip
          }
        });
      }

      // Map to job if job_id is provided
      if (data.job_id) {
        const existingApp = await tx.candidateApplication.findFirst({
          where: { candidate_id: candidate.id, job_id: Number(data.job_id), is_deleted: false }
        });
        if (!existingApp) {
          const application = await tx.candidateApplication.create({
            data: {
              candidate_id: candidate.id,
              job_id: Number(data.job_id),
              status: 'APPLIED'
            }
          });

          await tx.auditEvent.create({
            data: {
              entity_type: 'APPLICATION',
              entity_id: application.id,
              action_type: 'CREATED',
              new_state: 'APPLIED',
              actor_type: actor?.role || 'SYSTEM',
              actor_id: actor?.id || null,
              ip_address: ip
            }
          });
        }
      }

      return candidate;
    });
  }

  static async getAllCandidates() {
    return prisma.candidate.findMany({
      where: { is_deleted: false, is_draft: false },
      include: { applications: { include: { job: true, offers: true, bgv_case: true } } }
    });
  }

  static async getCandidateById(id: number) {
    return prisma.candidate.findUnique({
      where: { id },
      include: { applications: { include: { job: true, offers: true } }, documents: true }
    });
  }

  // Obsolete updateStatus - Candidates no longer have a global status. 
  // Moved to ApplicationService.updateStatus
  static async updateStatus(id: number, status: string, actor: any, ip: string | null = null) {
    throw new Error('Candidate status is now managed per application. Use Application endpoints.');
  }

  static async updateBGV(application_id: number, status: string, comments: string, actor: any, ip: string | null = null) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.candidateApplication.findUnique({ where: { id: application_id } });
      if (!current) throw new Error('Application not found');

      let nextStatus = current.status;
      if (status === 'CLEARED') nextStatus = 'BGV_CLEARED';
      if (status === 'FAILED') nextStatus = 'REJECTED'; // Or custom BGV_FAILED

      const updated = await tx.candidateApplication.update({
        where: { id: application_id },
        data: { status: nextStatus }
      });

      await tx.auditEvent.create({
        data: {
          entity_type: 'APPLICATION',
          entity_id: application_id,
          action_type: `BGV_${status}`,
          previous_state: current.status,
          new_state: nextStatus,
          actor_type: actor?.role || 'HR',
          actor_id: actor?.id,
          ip_address: ip,
          comments
        }
      });

      // Fire BGV failure email alert to HR Ops (fire-and-forget)
      if (status === 'FAILED') {
        const candidate = await tx.candidate.findFirst({
          where: { applications: { some: { id: application_id } } },
          select: { first_name: true, last_name: true }
        });
        const candidateName = candidate
          ? `${candidate.first_name} ${candidate.last_name}`
          : `Application #${application_id}`;
        RecruitmentEmailService.sendBgvFailureAlert(application_id, candidateName, comments).catch(
          (err) => console.error('[CandidateService] BGV failure email dispatch failed:', err)
        );
      }

      return updated;
    });
  }

  static async uploadDocument(candidate_id: number, document_type: string, file_url: string, ip: string | null = null) {
    return prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.findUnique({ where: { id: candidate_id } });
      if (!candidate) throw new Error('Candidate not found');

      const doc = await tx.candidateDocument.create({
        data: {
          candidate_id,
          document_type,
          file_url
        }
      });

      await tx.auditEvent.create({
        data: {
          action_type: 'DOCUMENT_UPLOADED',
          entity_type: 'CANDIDATE',
          entity_id: candidate_id,
          actor_type: 'CANDIDATE',
          actor_id: candidate_id,
          ip_address: ip,
          comments: `Uploaded ${document_type}`
        }
      });

      return doc;
    });
  }

  static async updateCandidate(id: string, data: any, actor: any, ip: string | null = null) {
    return prisma.$transaction(async (tx) => {
      const existingCandidate = await tx.candidate.findUnique({ where: { id: Number(id) } });
      if (!existingCandidate) {
        throw new Error('Candidate not found');
      }

      if (data.email && data.email !== existingCandidate.email) {
        const emailExists = await tx.candidate.findUnique({ where: { email: data.email } });
        if (emailExists) {
          throw new Error('A candidate with this email already exists.');
        }
      }

      const expHistory = data.experience_history !== undefined ? data.experience_history : existingCandidate.experience_history;
      const eduHistory = data.education_history !== undefined ? data.education_history : existingCandidate.education_history;

      const smartExp = extractSmartExperience(expHistory);
      const smartEdu = extractSmartEducation(eduHistory);

      const payload = {
        first_name: data.first_name ?? existingCandidate.first_name,
        last_name: data.last_name ?? existingCandidate.last_name,
        email: data.email ?? existingCandidate.email,
        phone: data.phone !== undefined ? data.phone : existingCandidate.phone,
        gender: data.gender !== undefined ? data.gender : existingCandidate.gender,
        dob: data.dob ? new Date(data.dob) : existingCandidate.dob,
        address: data.address !== undefined ? data.address : existingCandidate.address,
        experience_years: smartExp.experience_years !== null ? smartExp.experience_years : (data.experience_years ? Number(data.experience_years) : existingCandidate.experience_years),
        current_company: smartExp.current_company !== null ? smartExp.current_company : (data.current_company !== undefined ? data.current_company : existingCandidate.current_company),
        current_ctc: data.current_ctc ? Number(data.current_ctc) : existingCandidate.current_ctc,
        expected_ctc: data.expected_ctc ? Number(data.expected_ctc) : existingCandidate.expected_ctc,
        notice_period_days: data.notice_period_days ? Number(data.notice_period_days) : existingCandidate.notice_period_days,
        skills: data.skills !== undefined ? data.skills : existingCandidate.skills,
        resume_url: data.resume_url !== undefined ? data.resume_url : existingCandidate.resume_url,
        linkedin_url: data.linkedin_url !== undefined ? data.linkedin_url : existingCandidate.linkedin_url,
        github_url: data.github_url !== undefined ? data.github_url : existingCandidate.github_url,
        portfolio_url: data.portfolio_url !== undefined ? data.portfolio_url : existingCandidate.portfolio_url,
        highest_degree: smartEdu.highest_degree !== null ? smartEdu.highest_degree : (data.highest_degree !== undefined ? data.highest_degree : existingCandidate.highest_degree),
        specialization: smartEdu.specialization !== null ? smartEdu.specialization : (data.specialization !== undefined ? data.specialization : existingCandidate.specialization),
        university: smartEdu.university !== null ? smartEdu.university : (data.university !== undefined ? data.university : existingCandidate.university),
        graduation_year: smartEdu.graduation_year !== null ? smartEdu.graduation_year : (data.graduation_year ? Number(data.graduation_year) : existingCandidate.graduation_year),
        gpa_percentage: smartEdu.gpa_percentage !== null ? smartEdu.gpa_percentage : (data.gpa_percentage ? Number(data.gpa_percentage) : existingCandidate.gpa_percentage),
        experience_history: expHistory,
        education_history: eduHistory,
      };

      const candidate = await tx.candidate.update({
        where: { id: Number(id) },
        data: payload
      });

      await tx.auditEvent.create({
        data: {
          entity_type: 'CANDIDATE',
          entity_id: candidate.id,
          action_type: 'UPDATED',
          actor_type: actor?.role || 'SYSTEM',
          actor_id: actor?.id || null,
          ip_address: ip
        }
      });

      return candidate;
    });
  }

  static async convertToEmployee(candidate_id: number, actor: any, ip: string | null = null) {
    return prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.findUnique({ 
        where: { id: candidate_id },
        include: { applications: { include: { job: true, offers: { where: { status: 'OFFER_ACCEPTED' } } } } }
      });
      if (!candidate) throw new Error('Candidate not found');

      // Resolve tenantId
      const orgId = candidate.applications?.[0]?.job?.organization_id;
      let tenantId = 1;
      if (orgId) {
        const org = await tx.organization.findUnique({
          where: { id: orgId },
          select: { tenantId: true }
        });
        if (org) {
          tenantId = org.tenantId;
        }
      }

      // Extract bank details
      const bankDetails: any = candidate.bank_details;

      // Create User in core module
      const user = await tx.user.create({
        data: {
          tenantId,
          email: candidate.email,
          username: candidate.email.split('@')[0],
          password: 'Password@123', // Default
          status: true,
          details: {
            create: {
              first_name: candidate.first_name,
              last_name: candidate.last_name,
              phone: candidate.phone,
              bank_name: bankDetails?.bank_name || null,
              account_number: bankDetails?.account_number || null,
              ifsc_code: bankDetails?.ifsc_code || null,
              is_draft: false
            }
          }
        }
      });

      // Update candidate applications status to EMPLOYEE_CREATED
      await tx.candidateApplication.updateMany({
        where: { candidate_id },
        data: { status: 'EMPLOYEE_CREATED' }
      });

      await tx.auditEvent.create({
        data: {
          entity_type: 'CANDIDATE',
          entity_id: candidate_id,
          action_type: 'CONVERT_TO_EMPLOYEE',
          new_state: 'EMPLOYEE_CREATED',
          actor_type: actor?.role || 'HR',
          actor_id: actor?.id,
          ip_address: ip
        }
      });

      // Fire employee created alert to HR (fire-and-forget)
      RecruitmentEmailService.sendEmployeeCreatedAlert(candidate_id).catch(
        (err) => console.error('[CandidateService] Employee created email dispatch failed:', err)
      );

      return user;
    });
  }

  static async updateOnboarding(candidate_id: number, data: { policies_accepted?: boolean, bank_details?: any }, ip: string | null = null) {
    return prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.findUnique({ where: { id: candidate_id } });
      if (!candidate) throw new Error('Candidate not found');

      const updateData: any = {};
      if (data.policies_accepted !== undefined) {
        updateData.policies_accepted = data.policies_accepted;
      }
      if (data.bank_details !== undefined) {
        updateData.bank_details = data.bank_details;
      }

      const updated = await tx.candidate.update({
        where: { id: candidate_id },
        data: updateData
      });

      if (data.policies_accepted === true && candidate.policies_accepted !== true) {
        await tx.auditEvent.create({
          data: {
            entity_type: 'CANDIDATE',
            entity_id: candidate_id,
            action_type: 'POLICIES_ACCEPTED',
            actor_type: 'CANDIDATE',
            actor_id: candidate_id,
            ip_address: ip,
            comments: 'Corporate Policies accepted'
          }
        });
      }

      if (data.bank_details && JSON.stringify(candidate.bank_details) !== JSON.stringify(data.bank_details)) {
        await tx.auditEvent.create({
          data: {
            entity_type: 'CANDIDATE',
            entity_id: candidate_id,
            action_type: 'BANK_DETAILS_SUBMITTED',
            actor_type: 'CANDIDATE',
            actor_id: candidate_id,
            ip_address: ip,
            comments: `Bank details submitted for: ${data.bank_details.bank_name}`
          }
        });
      }

      return updated;
    });
  }

  static async generateOTP(email: string, consent?: boolean) {
    if (consent !== true) {
      throw new Error('Data processing consent is mandatory. Access Denied.');
    }

    const candidate = await prisma.candidate.findUnique({ where: { email } });
    if (!candidate) throw new Error('Candidate not found');

    if (candidate.otp_attempts >= 3) {
      throw new Error('Account is locked due to multiple failed OTP attempts. Contact HR.');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { otp_secret: otp, otp_attempts: 0 }
    });

    console.log(`[MVP] OTP for ${email} is ${otp}`);

    // Send OTP via email (fire-and-forget)
    const candidateName = `${candidate.first_name} ${candidate.last_name}`;
    RecruitmentEmailService.sendCandidateOtpEmail(email, candidateName, otp).catch(
      (err) => console.error('[CandidateService] OTP email dispatch failed:', err)
    );

    return { message: 'OTP sent successfully' }; // Removed mock_otp from production response
  }

  static async verifyOTP(email: string, otp: string, ip: string | null = null) {
    const candidate = await prisma.candidate.findUnique({ where: { email } });
    if (!candidate) throw new Error('Candidate not found');

    if (candidate.otp_attempts >= 3) {
      throw new Error('Account is locked due to multiple failed OTP attempts. Contact HR.');
    }

    if (candidate.otp_secret !== otp) {
      const attempts = candidate.otp_attempts + 1;
      await prisma.candidate.update({
        where: { id: candidate.id },
        data: { otp_attempts: attempts }
      });

      if (attempts >= 3) {
        await prisma.auditEvent.create({
          data: {
            entity_type: 'CANDIDATE',
            entity_id: candidate.id,
            action_type: 'ACCOUNT_LOCKED',
            new_state: 'LOCKED',
            actor_type: 'SYSTEM',
            ip_address: ip,
            comments: 'Locked due to 3 failed OTP verification attempts.'
          }
        });
        throw new Error('Account locked due to 3 failed attempts.');
      }
      throw new Error(`Invalid OTP. You have ${3 - attempts} attempts left.`);
    }

    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { otp_secret: null, otp_attempts: 0 }
    });

    await prisma.auditEvent.create({
      data: {
        entity_type: 'CANDIDATE',
        entity_id: candidate.id,
        action_type: 'LOGIN',
        actor_type: 'CANDIDATE',
        actor_id: candidate.id,
        ip_address: ip,
        comments: 'Successful Candidate Portal authentication'
      }
    });

    const jwt = require('jsonwebtoken');
    const { config } = require('../../config');
    const token = jwt.sign(
      { id: candidate.id, email: candidate.email, role: 'CANDIDATE' },
      config.JWT_SECRET,
      { expiresIn: '2h' }
    );

    return { token, candidate };
  }

  static async getPortalDetails(candidate_id: number) {
    return prisma.candidate.findUnique({
      where: { id: candidate_id },
      include: { applications: { include: { job: true, offers: true, interviews: true } }, documents: true }
    });
  }
}
