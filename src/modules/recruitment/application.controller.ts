import { Request, Response } from 'express';
import { ApplicationService } from './application.service';

export class ApplicationController {
  // POST /applications (Admin/Recruiter create application)
  static async createApplication(req: Request, res: Response) {
    try {
      const { candidate_id, job_id } = req.body;
      const ip = req.ip || req.socket.remoteAddress || null;
      const result = await ApplicationService.createApplication(
        Number(candidate_id),
        Number(job_id),
        (req as any).user,
        ip
      );
      return res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // GET /applications (List recruitment applications with filters)
  static async getApplications(req: Request, res: Response) {
    try {
      const result = await ApplicationService.getApplications(req.query);
      return res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      console.error('Error in getApplications:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // GET /applications/:id (Get detailed candidate application with audit timeline)
  static async getApplicationById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await ApplicationService.getApplicationById(Number(id));
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(404).json({ success: false, message: error.message });
    }
  }

  // PUT /applications/:id/status (Progress pipeline stage status)
  static async updateStatus(req: Request, res: Response) {
    try {
      const { status, comments } = req.body;
      const { id } = req.params;
      const ip = req.ip || req.socket.remoteAddress || null;
      
      const result = await ApplicationService.updateStatus(
        Number(id),
        status,
        (req as any).user,
        ip,
        comments
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // POST /applications/:id/reject (Transition candidate status to REJECTED)
  static async rejectApplication(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const ip = req.ip || req.socket.remoteAddress || null;
      
      const result = await ApplicationService.rejectApplication(
        Number(id),
        (req as any).user,
        ip,
        reason
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // POST /applications/:id/withdraw (Transition candidate status to WITHDRAWN)
  static async withdrawApplication(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const ip = req.ip || req.socket.remoteAddress || null;
      
      const result = await ApplicationService.withdrawApplication(
        Number(id),
        (req as any).user,
        ip,
        reason
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}
