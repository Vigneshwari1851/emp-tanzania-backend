import { Request, Response } from 'express';
import { AuditService } from './audit.service';

export class AuditController {
  static async getEvents(req: Request, res: Response) {
    try {
      const { entity_type, entity_id } = req.query;
      const result = await AuditService.getEvents(
        entity_type as string, 
        entity_id ? Number(entity_id) : undefined
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}
