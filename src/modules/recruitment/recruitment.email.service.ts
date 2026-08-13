import prisma from '../../config/prisma';
import { sendEmail } from '../../utils/email.service';
import { config } from '../../config';
import {
  getOfferSentTemplate,
  getOfferRevisedTemplate,
  getCandidateOtpTemplate,
  getOfferExpiryReminderTemplate,
  getBgvFailureTemplate,
  getEmployeeCreatedTemplate,
  getCandidateSelectedTemplate,
  getCandidateRejectedTemplate,
} from '../../utils/email-templates.util';

/**
 * Recruitment Email Service
 *
 * Handles all email notifications triggered by recruitment lifecycle events.
 * All methods are fire-and-forget — they never throw so the calling service
 * flow is never disrupted by a mail failure.
 */
export class RecruitmentEmailService {
  private static readonly PORTAL_BASE = `${config.FRONTEND_URL}/careers/portal`;

  /**
   * Fetches offer with candidate + job details for email context.
   */
  private static async fetchOfferContext(offerId: string) {
    return prisma.offer.findUnique({
      where: { id: offerId, is_deleted: false },
      include: {
        candidate: { select: { first_name: true, last_name: true, email: true } },
        job: { select: { title: true } },
        versions: { orderBy: { version_number: 'desc' }, take: 1 },
      },
    });
  }

  /**
   * 1. Offer Sent to Candidate
   *    Triggered when: OfferService.releaseOffer() emits OFFER_SENT
   */
  static async sendOfferEmail(offerId: string): Promise<void> {
    try {
      const offer = await this.fetchOfferContext(offerId);
      if (!offer) return;

      const candidateName = `${offer.candidate.first_name} ${offer.candidate.last_name}`;
      const expiryDate = offer.expiry_date.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
      const portalUrl = `${this.PORTAL_BASE}?email=${encodeURIComponent(offer.candidate.email)}`;

      await sendEmail(
        offer.candidate.email,
        `Your Job Offer — ${offer.job.title} | Lattium Tech`,
        `Dear ${candidateName}, your offer letter for ${offer.job.title} is ready. Please review it before ${expiryDate}.`,
        getOfferSentTemplate(candidateName, offer.job.title, portalUrl, expiryDate)
      );

      console.log(`[RecruitmentEmail] Offer sent email delivered → ${offer.candidate.email}`);
    } catch (err) {
      console.error('[RecruitmentEmail] Failed to send offer email:', err);
    }
  }

  /**
   * 2. Revised Offer Sent to Candidate
   *    Triggered when: OfferService.reviseOffer() emits OFFER_REVISED
   */
  static async sendRevisedOfferEmail(offerId: string, versionNumber: number): Promise<void> {
    try {
      const offer = await this.fetchOfferContext(offerId);
      if (!offer) return;

      const candidateName = `${offer.candidate.first_name} ${offer.candidate.last_name}`;
      const portalUrl = `${this.PORTAL_BASE}?email=${encodeURIComponent(offer.candidate.email)}`;

      await sendEmail(
        offer.candidate.email,
        `Updated Offer Letter (v${versionNumber}) — ${offer.job.title} | Lattium Tech`,
        `Dear ${candidateName}, a revised offer (Version ${versionNumber}) for ${offer.job.title} is ready for your review.`,
        getOfferRevisedTemplate(candidateName, offer.job.title, portalUrl, versionNumber)
      );

      console.log(`[RecruitmentEmail] Revised offer (v${versionNumber}) email delivered → ${offer.candidate.email}`);
    } catch (err) {
      console.error('[RecruitmentEmail] Failed to send revised offer email:', err);
    }
  }

  /**
   * 3. OTP Email to Candidate
   *    Triggered when: CandidateService.generateOTP() saves OTP
   */
  static async sendCandidateOtpEmail(
    email: string,
    candidateName: string,
    otp: string
  ): Promise<void> {
    try {
      await sendEmail(
        email,
        'Your Candidate Portal Login OTP — Lattium Tech',
        `Hello ${candidateName}, your one-time login code is: ${otp}. It expires in 10 minutes.`,
        getCandidateOtpTemplate(candidateName, otp)
      );

      console.log(`[RecruitmentEmail] OTP email delivered → ${email}`);
    } catch (err) {
      console.error('[RecruitmentEmail] Failed to send OTP email:', err);
    }
  }

  /**
   * 4. Offer Expiry Reminder to Candidate
   *    Triggered by: offer expiry reminder cron (48h before deadline)
   */
  static async sendOfferExpiryReminder(offerId: string): Promise<void> {
    try {
      const offer = await this.fetchOfferContext(offerId);
      if (!offer) return;

      const candidateName = `${offer.candidate.first_name} ${offer.candidate.last_name}`;
      const expiryDate = offer.expiry_date.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
      const portalUrl = `${this.PORTAL_BASE}?email=${encodeURIComponent(offer.candidate.email)}`;

      await sendEmail(
        offer.candidate.email,
        `Action Required: Your Offer Expires on ${expiryDate} — ${offer.job.title}`,
        `Dear ${candidateName}, your offer for ${offer.job.title} expires on ${expiryDate}. Please respond before the deadline.`,
        getOfferExpiryReminderTemplate(candidateName, offer.job.title, portalUrl, expiryDate)
      );

      console.log(`[RecruitmentEmail] Expiry reminder email delivered → ${offer.candidate.email}`);
    } catch (err) {
      console.error('[RecruitmentEmail] Failed to send expiry reminder email:', err);
    }
  }

  /**
   * 5. BGV Failure Alert to HR Ops
   *    Triggered when: CandidateService.updateBGV() with status = 'FAILED'
   */
  static async sendBgvFailureAlert(
    applicationId: number,
    candidateName: string,
    comments: string
  ): Promise<void> {
    try {
      const hrOpsEmail = (config as any).HR_OPS_EMAIL;
      if (!hrOpsEmail) {
        console.warn('[RecruitmentEmail] HR_OPS_EMAIL not configured — skipping BGV alert.');
        return;
      }

      await sendEmail(
        hrOpsEmail,
        `[URGENT] BGV Failed — Candidate: ${candidateName}`,
        `BGV check failed for candidate ${candidateName} (Application #${applicationId}). Comments: ${comments || 'N/A'}`,
        getBgvFailureTemplate(candidateName, applicationId, comments)
      );

      console.log(`[RecruitmentEmail] BGV failure alert delivered → ${hrOpsEmail}`);
    } catch (err) {
      console.error('[RecruitmentEmail] Failed to send BGV failure alert:', err);
    }
  }

  /**
   * 6. Employee Created Alert to HR
   *    Triggered when: CandidateService.convertToEmployee() creates user
   */
  static async sendEmployeeCreatedAlert(candidateId: number): Promise<void> {
    try {
      const hrOpsEmail = (config as any).HR_OPS_EMAIL;
      if (!hrOpsEmail) {
        console.warn('[RecruitmentEmail] HR_OPS_EMAIL not configured — skipping employee created alert.');
        return;
      }

      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        include: {
          applications: {
            where: { is_deleted: false },
            orderBy: { id: 'desc' },
            take: 1,
            include: { job: { select: { title: true } } },
          },
        },
      });

      if (!candidate) return;

      const candidateName = `${candidate.first_name} ${candidate.last_name}`;
      const app = (candidate as any).applications?.[0];
      const jobTitle = app?.job?.title || 'N/A';

      await sendEmail(
        hrOpsEmail,
        `New Employee Onboarded — ${candidateName} | Lattium Tech`,
        `A new employee account has been created for ${candidateName} (${candidate.email}). Position: ${jobTitle}`,
        getEmployeeCreatedTemplate(candidateName, candidate.email, jobTitle)
      );

      console.log(`[RecruitmentEmail] Employee created alert delivered → ${hrOpsEmail}`);
    } catch (err) {
      console.error('[RecruitmentEmail] Failed to send employee created alert:', err);
    }
  }

  /**
   * 7. Candidate Selected Email
   *    Triggered when: Application status is updated to 'SELECTED'
   */
  static async sendCandidateSelectedEmail(applicationId: number): Promise<void> {
    try {
      const app = await prisma.candidateApplication.findUnique({
        where: { id: applicationId },
        include: {
          candidate: { select: { first_name: true, last_name: true, email: true } },
          job: { select: { title: true } },
        },
      });

      if (!app || !app.candidate || !app.job) return;

      const candidateName = `${app.candidate.first_name} ${app.candidate.last_name}`;

      await sendEmail(
        app.candidate.email,
        `Congratulations! You've been selected — ${app.job.title} | Lattium Tech`,
        `Dear ${candidateName}, you have been selected for the ${app.job.title} position at Lattium Tech!`,
        getCandidateSelectedTemplate(candidateName, app.job.title)
      );

      console.log(`[RecruitmentEmail] Selected email delivered → ${app.candidate.email}`);
    } catch (err) {
      console.error('[RecruitmentEmail] Failed to send selected email:', err);
    }
  }

  /**
   * 8. Candidate Rejected Email
   *    Triggered when: Application status is updated to 'REJECTED'
   */
  static async sendCandidateRejectedEmail(applicationId: number): Promise<void> {
    try {
      const app = await prisma.candidateApplication.findUnique({
        where: { id: applicationId },
        include: {
          candidate: { select: { first_name: true, last_name: true, email: true } },
          job: { select: { title: true } },
        },
      });

      if (!app || !app.candidate || !app.job) return;

      const candidateName = `${app.candidate.first_name} ${app.candidate.last_name}`;

      await sendEmail(
        app.candidate.email,
        `Update on your application — ${app.job.title} | Lattium Tech`,
        `Dear ${candidateName}, thank you for your application. We have decided to move forward with other candidates.`,
        getCandidateRejectedTemplate(candidateName, app.job.title)
      );

      console.log(`[RecruitmentEmail] Rejected email delivered → ${app.candidate.email}`);
    } catch (err) {
      console.error('[RecruitmentEmail] Failed to send rejected email:', err);
    }
  }
}
