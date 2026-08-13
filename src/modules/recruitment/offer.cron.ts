import cron from 'node-cron';
import { OfferStatus } from '@prisma/client';
import { OfferService } from './offer.service';
import { RecruitmentEmailService } from './recruitment.email.service';
import prisma from '../../config/prisma';

/**
 * Background task: Auto-expire offers past their deadline.
 * Runs every hour.
 */
export const initOfferCron = () => {
  // ─── 1. Offer Expiry (hourly) ────────────────────────────────────────────
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Checking for expired employment offers...');
    try {
      const count = await OfferService.expireOffers();
      if (count > 0) {
        console.log(`[Cron] Successfully expired ${count} offer(s) matching SLA deadline.`);
      }
    } catch (error) {
      console.error('[Cron Error] Offer expiry check failed:', error);
    }
  });

  // ─── 2. Offer Expiry Reminder — 48h warning (every 6 hours) ─────────────
  cron.schedule('0 */6 * * *', async () => {
    console.log('[Cron] Checking for offers expiring within 48 hours...');
    try {
      const now = new Date();
      const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      // Find active offers expiring in the next 48 hours that haven't been reminded yet
      // Find offers expiring in the next 48 hours that haven't received a reminder yet
      // We identify 'already reminded' offers by checking OfferEvent for EXPIRY_REMINDER_SENT
      const remindedOfferIds = await prisma.offerEvent
        .findMany({
          where: { event_type: 'EXPIRY_REMINDER_SENT' },
          select: { offer_id: true },
        })
        .then((rows) => rows.map((r) => r.offer_id));

      const upcomingExpiries = await prisma.offer.findMany({
        where: {
          is_deleted: false,
          expiry_date: { gte: now, lte: in48h },
          status: {
            in: [OfferStatus.OFFER_SENT, OfferStatus.OFFER_VIEWED, OfferStatus.OFFER_NEGOTIATION],
          },
          ...(remindedOfferIds.length > 0 ? { id: { notIn: remindedOfferIds } } : {}),
        },
        select: { id: true },
      });

      for (const offer of upcomingExpiries) {
        try {
          await RecruitmentEmailService.sendOfferExpiryReminder(offer.id);

          // Record that reminder was sent so we don't resend
          await prisma.offerEvent.create({
            data: {
              offer_id: offer.id,
              event_type: 'EXPIRY_REMINDER_SENT',
              actor_role: 'SYSTEM',
            },
          });

          console.log(`[Cron] Expiry reminder sent for offer: ${offer.id}`);
        } catch (err) {
          console.error(`[Cron] Failed to send reminder for offer ${offer.id}:`, err);
        }
      }

      if (upcomingExpiries.length > 0) {
        console.log(`[Cron] Expiry reminder emails sent for ${upcomingExpiries.length} offer(s).`);
      }
    } catch (error) {
      console.error('[Cron Error] Offer expiry reminder check failed:', error);
    }
  });
};
