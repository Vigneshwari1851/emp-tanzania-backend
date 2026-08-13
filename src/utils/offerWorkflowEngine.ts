import { OfferStatus } from '@prisma/client';

export class OfferWorkflowEngine {
  private static transitions: Record<OfferStatus, OfferStatus[]> = {
    [OfferStatus.DRAFT]: [OfferStatus.PENDING_APPROVAL, OfferStatus.WITHDRAWN],
    [OfferStatus.PENDING_APPROVAL]: [OfferStatus.APPROVED, OfferStatus.DRAFT, OfferStatus.WITHDRAWN],
    [OfferStatus.APPROVED]: [OfferStatus.OFFER_SENT, OfferStatus.WITHDRAWN],
    [OfferStatus.OFFER_SENT]: [
      OfferStatus.OFFER_VIEWED,
      OfferStatus.OFFER_ACCEPTED,
      OfferStatus.OFFER_REJECTED,
      OfferStatus.OFFER_NEGOTIATION,
      OfferStatus.OFFER_EXPIRED,
      OfferStatus.WITHDRAWN,
    ],
    [OfferStatus.OFFER_VIEWED]: [
      OfferStatus.OFFER_ACCEPTED,
      OfferStatus.OFFER_REJECTED,
      OfferStatus.OFFER_NEGOTIATION,
      OfferStatus.OFFER_EXPIRED,
      OfferStatus.WITHDRAWN,
    ],
    [OfferStatus.OFFER_NEGOTIATION]: [OfferStatus.REVISED, OfferStatus.WITHDRAWN, OfferStatus.OFFER_EXPIRED],
    [OfferStatus.REVISED]: [OfferStatus.DRAFT, OfferStatus.PENDING_APPROVAL, OfferStatus.APPROVED, OfferStatus.OFFER_SENT, OfferStatus.WITHDRAWN],
    [OfferStatus.OFFER_ACCEPTED]: [], // Terminal state
    [OfferStatus.OFFER_REJECTED]: [OfferStatus.REVISED], // Recruiter can revise rejected offers
    [OfferStatus.OFFER_EXPIRED]: [OfferStatus.REVISED],  // Recruiter can revise expired offers
    [OfferStatus.WITHDRAWN]: [OfferStatus.DRAFT],        // Can be put back in draft
  };

  static canTransition(current: OfferStatus, next: OfferStatus): boolean {
    if (current === next) return true;
    const allowed = this.transitions[current];
    return allowed ? allowed.includes(next) : false;
  }
}
