import { Request, Response } from 'express';
import { JobService } from './job.service';

export class JobController {
  static async createJob(req: Request, res: Response) {
    try {
      const ip = req.ip || req.socket.remoteAddress || null;
      const result = await JobService.createJob(req.body, (req as any).user, ip);
      return res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateJob(req: Request, res: Response) {
    try {
      const ip = req.ip || req.socket.remoteAddress || null;
      const result = await JobService.updateJob(Number(req.params.id), req.body, (req as any).user, ip);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async publishJob(req: Request, res: Response) {
    try {
      const ip = req.ip || req.socket.remoteAddress || null;
      const result = await JobService.updateJobStatus(Number(req.params.id), 'OPEN', (req as any).user, ip);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async archiveJob(req: Request, res: Response) {
    try {
      const ip = req.ip || req.socket.remoteAddress || null;
      const result = await JobService.updateJobStatus(Number(req.params.id), 'CLOSED', (req as any).user, ip);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async saveDraft(req: Request, res: Response) {
    try {
      const ip = req.ip || req.socket.remoteAddress || null;
      const data = { ...req.body, status: 'DRAFT' };
      const result = await JobService.updateJob(Number(req.params.id), data, (req as any).user, ip);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async saveNewDraft(req: Request, res: Response) {
    try {
      const ip = req.ip || req.socket.remoteAddress || null;
      const data = { ...req.body, status: 'DRAFT' };
      const result = await JobService.createJob(data, (req as any).user, ip);
      return res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getJobs(req: Request, res: Response) {
    try {
      const result = await JobService.getAllJobs();
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getJobById(req: Request, res: Response) {
    try {
      const result = await JobService.getJobById(Number(req.params.id));
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getJobApplications(req: Request, res: Response) {
    try {
      const result = await JobService.getJobApplications(Number(req.params.id));
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}
