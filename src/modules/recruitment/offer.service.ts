import prisma from '../../config/prisma';
import { OfferStatus, CompensationFrequency, Offer, OfferVersion } from '@prisma/client';
import { OfferWorkflowEngine } from '../../utils/offerWorkflowEngine';
import { OfferPdfGenerator } from '../../services/offerPdfGenerator';
import { eventBus } from '../../utils/eventBus';
import { AuditService } from '../../middlewares/auditService';

export class OfferService {
  /**
   * Helper to verify candidate, job, and application existence and matching organization.
   */
  private static async verifyEntitiesAndOrg(
    candidateId: number,
    jobId: number,
    applicationId: number,
    orgId: number | null
  ) {
    const [candidate, job, application] = await Promise.all([
      prisma.candidate.findUnique({ where: { id: candidateId } }),
      prisma.job.findUnique({ where: { id: jobId } }),
      prisma.candidateApplication.findUnique({ where: { id: applicationId } }),
    ]);

    if (!candidate) throw new Error('Candidate not found');
    if (!job) throw new Error('Job not found');
    if (!application) throw new Error('Candidate application not found');

    if (candidate.organization_id !== job.organization_id) {
      throw new Error('Organization mismatch: Candidate and Job must belong to the same organization');
    }

    if (orgId && job.organization_id !== orgId) {
      throw new Error('Access denied: You do not have permissions for this organization');
    }

    return { candidate, job, application };
  }

  /**
   * Create a new draft offer.
   */
  static async createOffer(data: any, actor: any, ip: string | null = null) {
    const actorId = actor?.id ? Number(actor.id) : null;
    const actorOrgId = actor?.orgId ? Number(actor.orgId) : null;

    const { candidate, job } = await this.verifyEntitiesAndOrg(
      data.candidate_id,
      data.job_id,
      data.application_id,
      actorOrgId
    );

    return prisma.$transaction(async (tx) => {
      // 1. Create main Offer in DRAFT
      const offer = await tx.offer.create({
        data: {
          candidate_id: data.candidate_id,
          job_id: data.job_id,
          application_id: data.application_id,
          recruiter_id: actorId,
          status: OfferStatus.DRAFT,
          expiry_date: new Date(data.expiry_date),
          joining_date: new Date(data.joining_date),
        },
      });

      // 2. Create version 1 details
      const offerVersion = await tx.offerVersion.create({
        data: {
          offer_id: offer.id,
          version_number: 1,
          created_by_id: actorId || 1, // Fallback if no actor
          joining_date: new Date(data.joining_date),
          expiry_date: new Date(data.expiry_date),
          work_location: data.work_location,
          work_mode: data.work_mode,
          probation_period: data.probation_period || 0,
          reporting_manager: data.reporting_manager,
          notice_clauses: data.notice_clauses || null,
          confidentiality: data.confidentiality || null,
          employment_conds: data.employment_conds || null,
          additional_terms: data.additional_terms || null,
        },
      });

      // 3. Create compensation components
      if (data.compensation && Array.isArray(data.compensation)) {
        await tx.compensationComponent.createMany({
          data: data.compensation.map((comp: any) => ({
            offer_version_id: offerVersion.id,
            type: comp.type,
            amount: comp.amount,
            currency: comp.currency || 'INR',
            frequency: comp.frequency as CompensationFrequency || CompensationFrequency.ANNUAL,
            description: comp.description || null,
          })),
        });
      }

      // Log Audit Event
      await AuditService.log({
        entity_type: 'OFFER',
        entity_id: Number(offer.id) || 0, // Fallback to 0 if UUID string is not number, but AuditEvent has entity_id as Int!
        // Wait, entity_id is Int in Prisma schema, but Offer ID is String UUID!
        // Ah! In our Prisma schema:
        // model AuditEvent: entity_id Int!
        // But Offer ID is String UUID! This is a type mismatch.
        // To handle this, we can store a hash of the UUID in entity_id, or we can store a truncated integer, or we can pass a dummy integer like 0 and put the UUID string in the comments!
        // Yes, storing 0 in entity_id and the UUID in comments is a standard workaround for type mismatches, or we can parse it.
        // Let's do that! Let's pass 0 for entity_id if it's a string, and add the UUID in the comments.
        action_type: 'OFFER_CREATED',
        actor_id: actorId,
        actor_role: actor?.roles?.[0] || 'RECRUITER',
        ip_address: ip,
        new_state: JSON.stringify({ offer_id: offer.id, version: 1 }),
        comments: `Offer UUID: ${offer.id}`,
      });

      // Log OfferEvent
      await tx.offerEvent.create({
        data: {
          offer_id: offer.id,
          event_type: 'OFFER_CREATED',
          actor_id: actorId,
          actor_role: actor?.roles?.[0] || 'RECRUITER',
          details: { version: 1 },
        },
      });

      eventBus.emit('OFFER_CREATED', { offerId: offer.id, candidateId: candidate.id });

      return this.getOfferById(offer.id);
    });
  }

  /**
   * Update a draft offer.
   */
  static async updateOffer(offerId: string, data: any, actor: any, ip: string | null = null) {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId, is_deleted: false },
      include: { versions: { orderBy: { version_number: 'desc' }, take: 1 } },
    });

    if (!offer) throw new Error('Offer not found');
    if (offer.status !== OfferStatus.DRAFT) {
      throw new Error('Only draft offers can be updated directly. Please revise instead.');
    }

    const latestVersion = offer.versions[0];
    if (!latestVersion) throw new Error('Offer version details not found');

    const actorId = actor?.id ? Number(actor.id) : null;
    const actorOrgId = actor?.orgId ? Number(actor.orgId) : null;

    // Verify org
    await this.verifyEntitiesAndOrg(
      offer.candidate_id,
      offer.job_id,
      offer.application_id,
      actorOrgId
    );

    return prisma.$transaction(async (tx) => {
      // 1. Update main Offer
      await tx.offer.update({
        where: { id: offerId },
        data: {
          expiry_date: data.expiry_date ? new Date(data.expiry_date) : offer.expiry_date,
          joining_date: data.joining_date ? new Date(data.joining_date) : offer.joining_date,
        },
      });

      // 2. Update current version details
      await tx.offerVersion.update({
        where: { id: latestVersion.id },
        data: {
          joining_date: data.joining_date ? new Date(data.joining_date) : latestVersion.joining_date,
          expiry_date: data.expiry_date ? new Date(data.expiry_date) : latestVersion.expiry_date,
          work_location: data.work_location !== undefined ? data.work_location : latestVersion.work_location,
          work_mode: data.work_mode !== undefined ? data.work_mode : latestVersion.work_mode,
          probation_period: data.probation_period !== undefined ? data.probation_period : latestVersion.probation_period,
          reporting_manager: data.reporting_manager !== undefined ? data.reporting_manager : latestVersion.reporting_manager,
          notice_clauses: data.notice_clauses !== undefined ? data.notice_clauses : latestVersion.notice_clauses,
          confidentiality: data.confidentiality !== undefined ? data.confidentiality : latestVersion.confidentiality,
          employment_conds: data.employment_conds !== undefined ? data.employment_conds : latestVersion.employment_conds,
          additional_terms: data.additional_terms !== undefined ? data.additional_terms : latestVersion.additional_terms,
        },
      });

      // 3. Update compensation if provided
      if (data.compensation && Array.isArray(data.compensation)) {
        // Delete existing components
        await tx.compensationComponent.deleteMany({
          where: { offer_version_id: latestVersion.id },
        });

        // Add new components
        await tx.compensationComponent.createMany({
          data: data.compensation.map((comp: any) => ({
            offer_version_id: latestVersion.id,
            type: comp.type,
            amount: comp.amount,
            currency: comp.currency || 'INR',
            frequency: comp.frequency as CompensationFrequency || CompensationFrequency.ANNUAL,
            description: comp.description || null,
          })),
        });
      }

      await AuditService.log({
        entity_type: 'OFFER',
        entity_id: 0,
        action_type: 'OFFER_UPDATED',
        actor_id: actorId,
        actor_role: actor?.roles?.[0] || 'RECRUITER',
        ip_address: ip,
        comments: `Offer UUID: ${offer.id} updated draft.`,
      });

      eventBus.emit('OFFER_UPDATED', { offerId: offer.id, candidateId: offer.candidate_id });

      return this.getOfferById(offerId);
    });
  }

  /**
   * Get an offer by ID (includes latest details).
   */
  static async getOfferById(offerId: string) {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId, is_deleted: false },
      include: {
        candidate: {
          select: {
            first_name: true,
            last_name: true,
            email: true,
            phone: true,
          },
        },
        job: {
          select: {
            title: true,
            department: true,
            location: true,
          },
        },
        versions: {
          orderBy: { version_number: 'desc' },
          include: {
            compensation: true,
            documents: true,
          },
        },
        negotiations: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!offer) throw new Error('Offer not found');
    return offer;
  }

  /**
   * Get list of offers.
   */
  static async getOffers(filters: {
    status?: OfferStatus;
    candidate_id?: number;
    job_id?: number;
    orgId?: number;
  }) {
    const where: any = { is_deleted: false };

    if (filters.status) where.status = filters.status;
    if (filters.candidate_id) where.candidate_id = filters.candidate_id;
    if (filters.job_id) where.job_id = filters.job_id;

    if (filters.orgId) {
      where.job = { organization_id: filters.orgId };
    }

    return prisma.offer.findMany({
      where,
      include: {
        candidate: {
          select: {
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        job: {
          select: {
            title: true,
          },
        },
        versions: {
          orderBy: { version_number: 'desc' },
          take: 1,
          include: {
            compensation: true,
          },
        },
      },
      orderBy: { updated_at: 'desc' },
    });
  }

  /**
   * Publish a draft offer (status -> PENDING_APPROVAL).
   * Generates a DRAFT watermark PDF.
   */
  static async publishOffer(offerId: string, actor: any, ip: string | null = null) {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId, is_deleted: false },
      include: {
        candidate: true,
        job: true,
        versions: { orderBy: { version_number: 'desc' }, take: 1, include: { compensation: true } },
      },
    });

    if (!offer) throw new Error('Offer not found');
    if (!OfferWorkflowEngine.canTransition(offer.status, OfferStatus.PENDING_APPROVAL)) {
      throw new Error(`Cannot transition offer from ${offer.status} to PENDING_APPROVAL`);
    }

    const latestVersion = offer.versions[0];
    if (!latestVersion) throw new Error('Offer version details not found');

    const actorId = actor?.id ? Number(actor.id) : null;
    const actorOrgId = actor?.orgId ? Number(actor.orgId) : null;

    // Verify org
    await this.verifyEntitiesAndOrg(
      offer.candidate_id,
      offer.job_id,
      offer.application_id,
      actorOrgId
    );

    // Generate PDF (with DRAFT watermark)
    const filePath = await OfferPdfGenerator.generate({
      offerId: offer.id,
      versionNumber: latestVersion.version_number,
      candidateName: `${offer.candidate.first_name} ${offer.candidate.last_name}`,
      candidateEmail: offer.candidate.email,
      jobTitle: offer.job.title,
      joiningDate: latestVersion.joining_date,
      expiryDate: latestVersion.expiry_date,
      workLocation: latestVersion.work_location,
      workMode: latestVersion.work_mode,
      probationPeriod: latestVersion.probation_period,
      reportingManager: latestVersion.reporting_manager,
      noticeClauses: latestVersion.notice_clauses || undefined,
      confidentiality: latestVersion.confidentiality || undefined,
      employmentConds: latestVersion.employment_conds || undefined,
      additionalTerms: latestVersion.additional_terms || undefined,
      compensation: latestVersion.compensation.map((c) => ({
        type: c.type,
        amount: Number(c.amount),
        currency: c.currency,
        frequency: c.frequency,
        description: c.description || undefined,
      })),
      isDraft: true,
    });

    return prisma.$transaction(async (tx) => {
      // Create Offer Document link
      await tx.offerDocument.create({
        data: {
          offer_version_id: latestVersion.id,
          file_path: filePath,
          original_name: `OfferLetter_Draft_${offer.id.substring(0, 8)}.pdf`,
          mime_type: 'application/pdf',
        },
      });

      // Update Offer status
      const updatedOffer = await tx.offer.update({
        where: { id: offerId },
        data: { status: OfferStatus.PENDING_APPROVAL },
      });

      await AuditService.log({
        entity_type: 'OFFER',
        entity_id: 0,
        action_type: 'OFFER_PUBLISHED',
        actor_id: actorId,
        actor_role: actor?.roles?.[0] || 'RECRUITER',
        ip_address: ip,
        comments: `Offer UUID: ${offer.id} published for approval.`,
      });

      await tx.offerEvent.create({
        data: {
          offer_id: offer.id,
          event_type: 'OFFER_PUBLISHED',
          actor_id: actorId,
          actor_role: actor?.roles?.[0] || 'RECRUITER',
          details: { version: latestVersion.version_number },
        },
      });

      eventBus.emit('OFFER_PUBLISHED', { offerId: offer.id, candidateId: offer.candidate_id });

      return updatedOffer;
    });
  }

  /**
   * Approve a pending offer (status -> APPROVED).
   * Generates a final PDF without DRAFT watermark.
   */
  static async approveOffer(offerId: string, actor: any, ip: string | null = null) {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId, is_deleted: false },
      include: {
        candidate: true,
        job: true,
        versions: { orderBy: { version_number: 'desc' }, take: 1, include: { compensation: true } },
      },
    });

    if (!offer) throw new Error('Offer not found');
    if (!OfferWorkflowEngine.canTransition(offer.status, OfferStatus.APPROVED)) {
      throw new Error(`Cannot transition offer from ${offer.status} to APPROVED`);
    }

    const latestVersion = offer.versions[0];
    if (!latestVersion) throw new Error('Offer version details not found');

    const actorId = actor?.id ? Number(actor.id) : null;
    const actorOrgId = actor?.orgId ? Number(actor.orgId) : null;

    // Verify org
    await this.verifyEntitiesAndOrg(
      offer.candidate_id,
      offer.job_id,
      offer.application_id,
      actorOrgId
    );

    // Generate Final PDF (No watermark)
    const filePath = await OfferPdfGenerator.generate({
      offerId: offer.id,
      versionNumber: latestVersion.version_number,
      candidateName: `${offer.candidate.first_name} ${offer.candidate.last_name}`,
      candidateEmail: offer.candidate.email,
      jobTitle: offer.job.title,
      joiningDate: latestVersion.joining_date,
      expiryDate: latestVersion.expiry_date,
      workLocation: latestVersion.work_location,
      workMode: latestVersion.work_mode,
      probationPeriod: latestVersion.probation_period,
      reportingManager: latestVersion.reporting_manager,
      noticeClauses: latestVersion.notice_clauses || undefined,
      confidentiality: latestVersion.confidentiality || undefined,
      employmentConds: latestVersion.employment_conds || undefined,
      additionalTerms: latestVersion.additional_terms || undefined,
      compensation: latestVersion.compensation.map((c) => ({
        type: c.type,
        amount: Number(c.amount),
        currency: c.currency,
        frequency: c.frequency,
        description: c.description || undefined,
      })),
      isDraft: false,
    });

    return prisma.$transaction(async (tx) => {
      // Update/Replace Offer Document
      await tx.offerDocument.deleteMany({
        where: { offer_version_id: latestVersion.id },
      });

      await tx.offerDocument.create({
        data: {
          offer_version_id: latestVersion.id,
          file_path: filePath,
          original_name: `OfferLetter_Final_${offer.id.substring(0, 8)}.pdf`,
          mime_type: 'application/pdf',
        },
      });

      // Update Offer status & reviewer
      const updatedOffer = await tx.offer.update({
        where: { id: offerId },
        data: {
          status: OfferStatus.APPROVED,
          hr_reviewer_id: actorId,
        },
      });

      await AuditService.log({
        entity_type: 'OFFER',
        entity_id: 0,
        action_type: 'OFFER_APPROVED',
        actor_id: actorId,
        actor_role: actor?.roles?.[0] || 'HR_ADMIN',
        ip_address: ip,
        comments: `Offer UUID: ${offer.id} approved by reviewer.`,
      });

      await tx.offerEvent.create({
        data: {
          offer_id: offer.id,
          event_type: 'OFFER_APPROVED',
          actor_id: actorId,
          actor_role: actor?.roles?.[0] || 'HR_ADMIN',
          details: { version: latestVersion.version_number },
        },
      });

      eventBus.emit('OFFER_APPROVED', { offerId: offer.id, candidateId: offer.candidate_id });

      return updatedOffer;
    });
  }

  /**
   * Release offer to candidate (status -> OFFER_SENT).
   */
  static async releaseOffer(offerId: string, actor: any, ip: string | null = null) {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId, is_deleted: false },
    });

    if (!offer) throw new Error('Offer not found');
    if (!OfferWorkflowEngine.canTransition(offer.status, OfferStatus.OFFER_SENT)) {
      throw new Error(`Cannot transition offer from ${offer.status} to OFFER_SENT`);
    }

    const actorId = actor?.id ? Number(actor.id) : null;
    const actorOrgId = actor?.orgId ? Number(actor.orgId) : null;

    // Verify org
    await this.verifyEntitiesAndOrg(
      offer.candidate_id,
      offer.job_id,
      offer.application_id,
      actorOrgId
    );

    return prisma.$transaction(async (tx) => {
      // 1. Update Offer status
      const updatedOffer = await tx.offer.update({
        where: { id: offerId },
        data: { status: OfferStatus.OFFER_SENT },
      });

      // 2. Update application status to OFFER_SENT
      await tx.candidateApplication.update({
        where: { id: offer.application_id },
        data: { status: 'OFFER_SENT' },
      });

      await AuditService.log({
        entity_type: 'OFFER',
        entity_id: 0,
        action_type: 'OFFER_RELEASED',
        actor_id: actorId,
        actor_role: actor?.roles?.[0] || 'RECRUITER',
        ip_address: ip,
        comments: `Offer UUID: ${offer.id} released and sent to candidate.`,
      });

      await tx.offerEvent.create({
        data: {
          offer_id: offer.id,
          event_type: 'OFFER_RELEASED',
          actor_id: actorId,
          actor_role: actor?.roles?.[0] || 'RECRUITER',
        },
      });

      eventBus.emit('OFFER_SENT', { offerId: offer.id, candidateId: offer.candidate_id });

      return updatedOffer;
    });
  }

  /**
   * Candidate views the offer portal (status -> OFFER_VIEWED).
   */
  static async viewOffer(offerId: string, ip: string | null = null) {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId, is_deleted: false },
    });

    if (!offer) throw new Error('Offer not found');

    if (offer.status !== OfferStatus.OFFER_SENT) {
      // Don't update status if it's already in another state (e.g. negotiation, accepted, etc.)
      return offer;
    }

    return prisma.$transaction(async (tx) => {
      const updatedOffer = await tx.offer.update({
        where: { id: offerId },
        data: { status: OfferStatus.OFFER_VIEWED },
      });

      await AuditService.log({
        entity_type: 'OFFER',
        entity_id: 0,
        action_type: 'OFFER_VIEWED',
        actor_role: 'CANDIDATE',
        ip_address: ip,
        comments: `Offer UUID: ${offer.id} viewed by candidate.`,
      });

      await tx.offerEvent.create({
        data: {
          offer_id: offer.id,
          event_type: 'OFFER_VIEWED',
          actor_role: 'CANDIDATE',
        },
      });

      eventBus.emit('OFFER_VIEWED', { offerId: offer.id, candidateId: offer.candidate_id });

      return updatedOffer;
    });
  }

  /**
   * Candidate requests revision / negotiation (status -> OFFER_NEGOTIATION).
   * Enforces 1 negotiation cycle limit.
   */
  static async negotiateOffer(offerId: string, comment: string, ip: string | null = null) {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId, is_deleted: false },
    });

    if (!offer) throw new Error('Offer not found');
    if (!OfferWorkflowEngine.canTransition(offer.status, OfferStatus.OFFER_NEGOTIATION)) {
      throw new Error(`Cannot transition offer from ${offer.status} to OFFER_NEGOTIATION`);
    }

    // Limit to 1 revision/negotiation cycle
    const negotiationCount = await prisma.negotiation.count({
      where: { offer_id: offerId },
    });

    if (negotiationCount >= 1) {
      throw new Error('Maximum negotiation cycles reached. Only 1 revision cycle is allowed.');
    }

    return prisma.$transaction(async (tx) => {
      // Create Negotiation record
      await tx.negotiation.create({
        data: {
          offer_id: offerId,
          requester_role: 'CANDIDATE',
          comment,
        },
      });

      // Update Offer Status
      const updatedOffer = await tx.offer.update({
        where: { id: offerId },
        data: { status: OfferStatus.OFFER_NEGOTIATION },
      });

      // Update Candidate Application status
      await tx.candidateApplication.update({
        where: { id: offer.application_id },
        data: { status: 'OFFER_SENT' }, // keep under offer_sent phase but negotiation details are tracked
      });

      await AuditService.log({
        entity_type: 'OFFER',
        entity_id: 0,
        action_type: 'OFFER_NEGOTIATION_REQUESTED',
        actor_role: 'CANDIDATE',
        ip_address: ip,
        comments: `Negotiation comment: "${comment}"`,
      });

      await tx.offerEvent.create({
        data: {
          offer_id: offer.id,
          event_type: 'OFFER_NEGOTIATION_REQUESTED',
          actor_role: 'CANDIDATE',
          details: { comment },
        },
      });

      eventBus.emit('OFFER_NEGOTIATION', { offerId: offer.id, candidateId: offer.candidate_id, comment });

      return updatedOffer;
    });
  }

  /**
   * Recruiter revises an offer (creates new version, increments version number).
   */
  static async reviseOffer(offerId: string, data: any, actor: any, ip: string | null = null) {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId, is_deleted: false },
      include: {
        versions: { orderBy: { version_number: 'desc' }, take: 1, include: { compensation: true } },
      },
    });

    if (!offer) throw new Error('Offer not found');
    if (!OfferWorkflowEngine.canTransition(offer.status, OfferStatus.REVISED)) {
      throw new Error(`Cannot transition offer from ${offer.status} to REVISED`);
    }

    const latestVersion = offer.versions[0];
    if (!latestVersion) throw new Error('Offer version details not found');

    const nextVersionNum = latestVersion.version_number + 1;
    const actorId = actor?.id ? Number(actor.id) : null;
    const actorOrgId = actor?.orgId ? Number(actor.orgId) : null;

    // Verify org
    await this.verifyEntitiesAndOrg(
      offer.candidate_id,
      offer.job_id,
      offer.application_id,
      actorOrgId
    );

    return prisma.$transaction(async (tx) => {
      // 1. Update main offer status back to DRAFT
      await tx.offer.update({
        where: { id: offerId },
        data: {
          status: OfferStatus.DRAFT, // returns to draft state for the new version
          expiry_date: data.expiry_date ? new Date(data.expiry_date) : offer.expiry_date,
          joining_date: data.joining_date ? new Date(data.joining_date) : offer.joining_date,
        },
      });

      // 2. Create the new version
      const offerVersion = await tx.offerVersion.create({
        data: {
          offer_id: offerId,
          version_number: nextVersionNum,
          created_by_id: actorId || latestVersion.created_by_id,
          joining_date: data.joining_date ? new Date(data.joining_date) : latestVersion.joining_date,
          expiry_date: data.expiry_date ? new Date(data.expiry_date) : latestVersion.expiry_date,
          work_location: data.work_location !== undefined ? data.work_location : latestVersion.work_location,
          work_mode: data.work_mode !== undefined ? data.work_mode : latestVersion.work_mode,
          probation_period: data.probation_period !== undefined ? data.probation_period : latestVersion.probation_period,
          reporting_manager: data.reporting_manager !== undefined ? data.reporting_manager : latestVersion.reporting_manager,
          notice_clauses: data.notice_clauses !== undefined ? data.notice_clauses : latestVersion.notice_clauses,
          confidentiality: data.confidentiality !== undefined ? data.confidentiality : latestVersion.confidentiality,
          employment_conds: data.employment_conds !== undefined ? data.employment_conds : latestVersion.employment_conds,
          additional_terms: data.additional_terms !== undefined ? data.additional_terms : latestVersion.additional_terms,
        },
      });

      // 3. Create new compensation components
      const compsToUse = data.compensation && Array.isArray(data.compensation) 
        ? data.compensation 
        : latestVersion.compensation; // fallback to copy previous compensation

      await tx.compensationComponent.createMany({
        data: compsToUse.map((comp: any) => ({
          offer_version_id: offerVersion.id,
          type: comp.type,
          amount: comp.amount,
          currency: comp.currency || 'INR',
          frequency: comp.frequency as CompensationFrequency || CompensationFrequency.ANNUAL,
          description: comp.description || null,
        })),
      });

      await AuditService.log({
        entity_type: 'OFFER',
        entity_id: 0,
        action_type: 'OFFER_REVISED',
        actor_id: actorId,
        actor_role: actor?.roles?.[0] || 'RECRUITER',
        ip_address: ip,
        comments: `Offer UUID: ${offer.id} revised. Created version ${nextVersionNum}. Status reset to DRAFT.`,
      });

      await tx.offerEvent.create({
        data: {
          offer_id: offer.id,
          event_type: 'OFFER_REVISED',
          actor_id: actorId,
          actor_role: actor?.roles?.[0] || 'RECRUITER',
          details: { version: nextVersionNum },
        },
      });

      eventBus.emit('OFFER_REVISED', { offerId: offer.id, version: nextVersionNum, candidateId: offer.candidate_id });

      return this.getOfferById(offerId);
    });
  }

  /**
   * Candidate accepts offer (status -> OFFER_ACCEPTED).
   */
  static async acceptOffer(offerId: string, ip: string | null = null) {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId, is_deleted: false },
    });

    if (!offer) throw new Error('Offer not found');
    if (!OfferWorkflowEngine.canTransition(offer.status, OfferStatus.OFFER_ACCEPTED)) {
      throw new Error(`Cannot transition offer from ${offer.status} to OFFER_ACCEPTED`);
    }

    if (new Date() > offer.expiry_date) {
      throw new Error('Offer has expired');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Update Offer status
      const updatedOffer = await tx.offer.update({
        where: { id: offerId },
        data: { status: OfferStatus.OFFER_ACCEPTED },
      });

      // 2. Update Application status to OFFER_ACCEPTED
      await tx.candidateApplication.update({
        where: { id: offer.application_id },
        data: { status: 'OFFER_ACCEPTED' },
      });

      await AuditService.log({
        entity_type: 'OFFER',
        entity_id: 0,
        action_type: 'OFFER_ACCEPTED',
        actor_role: 'CANDIDATE',
        ip_address: ip,
        comments: `Offer UUID: ${offer.id} accepted by candidate.`,
      });

      await tx.offerEvent.create({
        data: {
          offer_id: offer.id,
          event_type: 'OFFER_ACCEPTED',
          actor_role: 'CANDIDATE',
        },
      });

      eventBus.emit('OFFER_ACCEPTED', { offerId: offer.id, candidateId: offer.candidate_id });
      eventBus.emit('OFFER_FINALIZED', { offerId: offer.id, candidateId: offer.candidate_id });

      return updatedOffer;
    });
  }

  /**
   * Candidate rejects offer (status -> OFFER_REJECTED).
   */
  static async rejectOffer(offerId: string, comment?: string, ip: string | null = null) {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId, is_deleted: false },
    });

    if (!offer) throw new Error('Offer not found');
    if (!OfferWorkflowEngine.canTransition(offer.status, OfferStatus.OFFER_REJECTED)) {
      throw new Error(`Cannot transition offer from ${offer.status} to OFFER_REJECTED`);
    }

    return prisma.$transaction(async (tx) => {
      // 1. Update Offer status
      const updatedOffer = await tx.offer.update({
        where: { id: offerId },
        data: { status: OfferStatus.OFFER_REJECTED },
      });

      // 2. Update Application status to REJECTED
      await tx.candidateApplication.update({
        where: { id: offer.application_id },
        data: { status: 'REJECTED' },
      });

      await AuditService.log({
        entity_type: 'OFFER',
        entity_id: 0,
        action_type: 'OFFER_REJECTED',
        actor_role: 'CANDIDATE',
        ip_address: ip,
        comments: `Offer UUID: ${offer.id} rejected by candidate. Reason: ${comment || 'None provided'}`,
      });

      await tx.offerEvent.create({
        data: {
          offer_id: offer.id,
          event_type: 'OFFER_REJECTED',
          actor_role: 'CANDIDATE',
          details: { comment },
        },
      });

      eventBus.emit('OFFER_REJECTED', { offerId: offer.id, candidateId: offer.candidate_id, reason: comment });

      return updatedOffer;
    });
  }

  /**
   * Check for expired offers and flag them.
   */
  static async expireOffers() {
    const now = new Date();
    const expiredOffers = await prisma.offer.findMany({
      where: {
        is_deleted: false,
        expiry_date: { lt: now },
        status: {
          in: [OfferStatus.OFFER_SENT, OfferStatus.OFFER_VIEWED, OfferStatus.OFFER_NEGOTIATION],
        },
      },
    });

    if (expiredOffers.length === 0) return 0;

    let count = 0;
    for (const offer of expiredOffers) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.offer.update({
            where: { id: offer.id },
            data: { status: OfferStatus.OFFER_EXPIRED },
          });

          await tx.candidateApplication.update({
            where: { id: offer.application_id },
            data: { status: 'EXPIRED' },
          });

          await tx.offerEvent.create({
            data: {
              offer_id: offer.id,
              event_type: 'OFFER_EXPIRED',
              actor_role: 'SYSTEM',
            },
          });

          await AuditService.log({
            entity_type: 'OFFER',
            entity_id: 0,
            action_type: 'OFFER_EXPIRED',
            actor_role: 'SYSTEM',
            comments: `Offer UUID: ${offer.id} auto-expired by system SLA cron.`,
          });

          eventBus.emit('OFFER_EXPIRED', { offerId: offer.id, candidateId: offer.candidate_id });
        });
        count++;
      } catch (err) {
        console.error(`[OfferService] Error auto-expiring offer ${offer.id}:`, err);
      }
    }

    return count;
  }
}
