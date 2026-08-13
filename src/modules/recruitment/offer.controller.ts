import { Request, Response } from 'express';
import { OfferService } from './offer.service';
import { sendResponse, sendError } from '../../utils/response.util';
import { CreateOfferSchema, UpdateOfferSchema, NegotiationSchema } from './validators/offer.zod';
import { OfferStatus } from '@prisma/client';
import path from 'path';
import fs from 'fs';

export class OfferController {
  static async createOffer(req: Request, res: Response) {
    try {
      const parsed = CreateOfferSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, parsed.error.issues[0].message);
      }

      const ip = req.ip || req.socket.remoteAddress || null;
      const offer = await OfferService.createOffer(parsed.data, (req as any).user, ip);
      return sendResponse(res, 201, true, 'Offer draft created successfully', offer);
    } catch (error: any) {
      console.error('[OfferController.createOffer] Error:', error);
      return sendError(res, 400, error.message);
    }
  }

  static async updateOffer(req: Request, res: Response) {
    try {
      const parsed = UpdateOfferSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, parsed.error.issues[0].message);
      }

      const ip = req.ip || req.socket.remoteAddress || null;
      const offer = await OfferService.updateOffer(req.params.id as string, parsed.data, (req as any).user, ip);
      return sendResponse(res, 200, true, 'Offer draft updated successfully', offer);
    } catch (error: any) {
      console.error('[OfferController.updateOffer] Error:', error);
      return sendError(res, 400, error.message);
    }
  }

  static async getOfferById(req: Request, res: Response) {
    try {
      const offer = await OfferService.getOfferById(req.params.id as string);
      
      // If candidate is accessing, check if the portal request is validated
      const user = (req as any).user;
      if (user?.role === 'CANDIDATE' && offer.candidate_id !== user.id) {
        return sendError(res, 403, 'Access denied: Candidate ID mismatch');
      }

      return sendResponse(res, 200, true, 'Offer details retrieved successfully', offer);
    } catch (error: any) {
      console.error('[OfferController.getOfferById] Error:', error);
      return sendError(res, 404, error.message);
    }
  }

  static async getOffers(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const orgId = user?.orgId ? Number(user.orgId) : undefined;
      const filters = {
        status: req.query.status as OfferStatus || undefined,
        candidate_id: req.query.candidate_id ? Number(req.query.candidate_id) : undefined,
        job_id: req.query.job_id ? Number(req.query.job_id) : undefined,
        orgId,
      };

      const offers = await OfferService.getOffers(filters);
      return sendResponse(res, 200, true, 'Offers retrieved successfully', offers);
    } catch (error: any) {
      console.error('[OfferController.getOffers] Error:', error);
      return sendError(res, 400, error.message);
    }
  }

  static async publishOffer(req: Request, res: Response) {
    try {
      const ip = req.ip || req.socket.remoteAddress || null;
      const offer = await OfferService.publishOffer(req.params.id as string, (req as any).user, ip);
      return sendResponse(res, 200, true, 'Offer published successfully for approval', offer);
    } catch (error: any) {
      console.error('[OfferController.publishOffer] Error:', error);
      return sendError(res, 400, error.message);
    }
  }

  static async approveOffer(req: Request, res: Response) {
    try {
      const ip = req.ip || req.socket.remoteAddress || null;
      const offer = await OfferService.approveOffer(req.params.id as string, (req as any).user, ip);
      return sendResponse(res, 200, true, 'Offer approved successfully', offer);
    } catch (error: any) {
      console.error('[OfferController.approveOffer] Error:', error);
      return sendError(res, 400, error.message);
    }
  }

  static async releaseOffer(req: Request, res: Response) {
    try {
      const ip = req.ip || req.socket.remoteAddress || null;
      const offer = await OfferService.releaseOffer(req.params.id as string, (req as any).user, ip);
      return sendResponse(res, 200, true, 'Offer released and sent to candidate', offer);
    } catch (error: any) {
      console.error('[OfferController.releaseOffer] Error:', error);
      return sendError(res, 400, error.message);
    }
  }

  static async viewOffer(req: Request, res: Response) {
    try {
      const ip = req.ip || req.socket.remoteAddress || null;
      const offer = await OfferService.viewOffer(req.params.id as string, ip);
      return sendResponse(res, 200, true, 'Offer viewed by candidate', offer);
    } catch (error: any) {
      console.error('[OfferController.viewOffer] Error:', error);
      return sendError(res, 400, error.message);
    }
  }

  static async acceptOffer(req: Request, res: Response) {
    try {
      const ip = req.ip || req.socket.remoteAddress || null;
      const offer = await OfferService.acceptOffer(req.params.id as string, ip);
      return sendResponse(res, 200, true, 'Offer accepted successfully', offer);
    } catch (error: any) {
      console.error('[OfferController.acceptOffer] Error:', error);
      return sendError(res, 400, error.message);
    }
  }

  static async rejectOffer(req: Request, res: Response) {
    try {
      const ip = req.ip || req.socket.remoteAddress || null;
      const comment = req.body.comment || undefined;
      const offer = await OfferService.rejectOffer(req.params.id as string, comment, ip);
      return sendResponse(res, 200, true, 'Offer rejected successfully', offer);
    } catch (error: any) {
      console.error('[OfferController.rejectOffer] Error:', error);
      return sendError(res, 400, error.message);
    }
  }

  static async negotiateOffer(req: Request, res: Response) {
    try {
      const parsed = NegotiationSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, parsed.error.issues[0].message);
      }

      const ip = req.ip || req.socket.remoteAddress || null;
      const offer = await OfferService.negotiateOffer(req.params.id as string, parsed.data.comment, ip);
      return sendResponse(res, 200, true, 'Offer negotiation requested successfully', offer);
    } catch (error: any) {
      console.error('[OfferController.negotiateOffer] Error:', error);
      return sendError(res, 400, error.message);
    }
  }

  static async reviseOffer(req: Request, res: Response) {
    try {
      const ip = req.ip || req.socket.remoteAddress || null;
      const offer = await OfferService.reviseOffer(req.params.id as string, req.body, (req as any).user, ip);
      return sendResponse(res, 200, true, 'Offer revised successfully. Version incremented.', offer);
    } catch (error: any) {
      console.error('[OfferController.reviseOffer] Error:', error);
      return sendError(res, 400, error.message);
    }
  }

  static async triggerExpiry(req: Request, res: Response) {
    try {
      const count = await OfferService.expireOffers();
      return sendResponse(res, 200, true, `Expired ${count} offer(s) successfully`, { count });
    } catch (error: any) {
      console.error('[OfferController.triggerExpiry] Error:', error);
      return sendError(res, 500, error.message);
    }
  }

  static async getPdf(req: Request, res: Response) {
    try {
      const offer = await OfferService.getOfferById(req.params.id as string);
      
      const latestVersion = offer.versions[0];
      if (!latestVersion) throw new Error('Offer version details not found');
      
      const document = latestVersion.documents[0];
      if (!document) throw new Error('Offer document PDF has not been generated');

      const absolutePath = path.join(__dirname, '../../', document.file_path);
      
      if (!fs.existsSync(absolutePath)) {
        throw new Error('PDF file not found on disk');
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${document.original_name}"`);
      return fs.createReadStream(absolutePath).pipe(res);
    } catch (error: any) {
      console.error('[OfferController.getPdf] Error:', error);
      return sendError(res, 404, error.message);
    }
  }
}
