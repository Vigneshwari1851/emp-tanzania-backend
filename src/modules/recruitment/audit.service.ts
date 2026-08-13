import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AuditService {
  static async getEvents(entity_type?: string, entity_id?: number) {
    const where: any = {};
    if (entity_type) where.entity_type = entity_type;
    if (entity_id) where.entity_id = entity_id;

    return prisma.auditEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' }
    });
  }
}
