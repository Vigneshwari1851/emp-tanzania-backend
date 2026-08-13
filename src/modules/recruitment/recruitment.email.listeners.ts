import { eventBus } from '../../utils/eventBus';
import { RecruitmentEmailService } from './recruitment.email.service';

/**
 * Recruitment Email EventBus Listeners
 *
 * Subscribes to lifecycle events already emitted by OfferService and wires
 * them to the corresponding RecruitmentEmailService email dispatch methods.
 *
 * Call initRecruitmentEmailListeners() once at server startup (in index.ts).
 */
export function initRecruitmentEmailListeners(): void {
  // ─── Offer Sent to Candidate ──────────────────────────────────────────────
  eventBus.on('OFFER_SENT', ({ offerId }: { offerId: string }) => {
    RecruitmentEmailService.sendOfferEmail(offerId).catch((err) =>
      console.error('[EmailListener] OFFER_SENT handler error:', err)
    );
  });

  // ─── Revised Offer Sent to Candidate ─────────────────────────────────────
  eventBus.on('OFFER_REVISED', ({ offerId, version }: { offerId: string; version: number }) => {
    RecruitmentEmailService.sendRevisedOfferEmail(offerId, version).catch((err) =>
      console.error('[EmailListener] OFFER_REVISED handler error:', err)
    );
  });

  console.log('[RecruitmentEmailListeners] EventBus listeners registered: OFFER_SENT, OFFER_REVISED');
}
