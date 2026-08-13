import { Request, Response } from 'express';
import { CandidateService } from './candidate.service';

export class CandidateController {
  static async createCandidate(req: Request, res: Response) {
    try {
      const ip = req.ip || req.socket.remoteAddress || null;
      const result = await CandidateService.createCandidate(req.body, (req as any).user, ip);
      return res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async saveDraft(req: Request, res: Response) {
    try {
      const ip = req.ip || req.socket.remoteAddress || null;
      const result = await CandidateService.saveDraft(req.body, (req as any).user, ip);
      return res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getAllCandidates(req: Request, res: Response) {
    try {
      const result = await CandidateService.getAllCandidates();
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getCandidateById(req: Request, res: Response) {
    try {
      const result = await CandidateService.getCandidateById(Number(req.params.id));
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateCandidate(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const ip = (req.ip || req.socket.remoteAddress || null) as string | null;
      const result = await CandidateService.updateCandidate(id, req.body, (req as any).user, ip);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateCandidateStatus(req: Request, res: Response) {
    try {
      const ip = req.ip || req.socket.remoteAddress || null;
      const result = await CandidateService.updateStatus(Number(req.params.id), req.body.status, (req as any).user, ip);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateBGVStatus(req: Request, res: Response) {
    try {
      const { application_id, status, comments } = req.body;
      const ip = req.ip || req.socket.remoteAddress || null;
      const result = await CandidateService.updateBGV(Number(application_id), status, comments, (req as any).user, ip);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async uploadDocument(req: Request, res: Response) {
    try {
      const { document_type, file_url } = req.body;
      const ip = req.ip || req.socket.remoteAddress || null;
      const result = await CandidateService.uploadDocument(Number(req.params.id), document_type, file_url, ip);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async convertToEmployee(req: Request, res: Response) {
    try {
      const ip = req.ip || req.socket.remoteAddress || null;
      const result = await CandidateService.convertToEmployee(Number(req.params.id), (req as any).user, ip);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateOnboardingData(req: Request, res: Response) {
    try {
      const { policies_accepted, bank_details } = req.body;
      const ip = req.ip || req.socket.remoteAddress || null;
      const result = await CandidateService.updateOnboarding(Number(req.params.id), { policies_accepted, bank_details }, ip);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // OTP Auth
  static async generateOTP(req: Request, res: Response) {
    try {
      const { email, consent } = req.body;
      const result = await CandidateService.generateOTP(email, consent);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      const status = error.message.includes('consent') ? 403 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  static async verifyOTP(req: Request, res: Response) {
    try {
      const { email, otp } = req.body;
      const ip = req.ip || req.socket.remoteAddress || null;
      const result = await CandidateService.verifyOTP(email, otp, ip);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getPortalDetails(req: Request, res: Response) {
    try {
      const result = await CandidateService.getPortalDetails(Number(req.params.id));
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}
