import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AuditService {
  /**
   * Generic audit logger. Call from any service/controller.
   */
  async log(params: {
    module: string;
    action: string;
    entityId: string | number;
    actorId: number;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
  }) {
    const { module, action, entityId, actorId, oldValue, newValue, ipAddress } = params;
    await prisma.auditLog.create({
      data: {
        module,
        action,
        entityId: entityId.toString(),
        actorId,
        oldValue: oldValue ? JSON.stringify(oldValue) : undefined,
        newValue: newValue ? JSON.stringify(newValue) : undefined,
        ipAddress,
      },
    });
  }
}

export const auditService = new AuditService();
