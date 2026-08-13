import { Request, Response } from 'express';
import { BgvService } from './bgv.service';

export class BgvController {
  static async initiateCase(req: Request, res: Response) {
    try {
      const { application_id } = req.body;
      const ip = req.ip || req.socket.remoteAddress || null;
      const result = await BgvService.initiateBgv(Number(application_id), (req as any).user, ip as string | null);
      return res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getCaseDetails(req: Request, res: Response) {
    try {
      const application_id = Number(req.params.id);
      const result = await BgvService.getCaseDetails(application_id);
      if (!result) {
        return res.status(404).json({ success: false, message: 'Case not found' });
      }
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async uploadDocument(req: Request, res: Response) {
    try {
      const { bgv_case_id, verification_id, type, file_url, original_name, mime } = req.body;
      const ip = req.ip || req.socket.remoteAddress || null;
      const result = await BgvService.uploadDocument(
        bgv_case_id,
        verification_id || null,
        type,
        file_url,
        original_name,
        mime,
        (req as any).user,
        ip as string | null
      );
      return res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateVerification(req: Request, res: Response) {
    try {
      const { verification_id, status, remarks } = req.body;
      const ip = req.ip || req.socket.remoteAddress || null;
      const result = await BgvService.updateVerificationStatus(
        verification_id,
        status,
        remarks,
        (req as any).user,
        ip as string | null
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async addReview(req: Request, res: Response) {
    try {
      const { bgv_case_id, decision, remarks } = req.body;
      const ip = req.ip || req.socket.remoteAddress || null;
      const result = await BgvService.addReview(
        bgv_case_id,
        decision,
        remarks,
        (req as any).user,
        ip as string | null
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}
