import prisma from '../config/prisma';

export class AuditService {
  static async log(data: {
    entity_type: string;
    entity_id: number;
    action_type: string;
    actor_id?: number | null;
    actor_role?: string | null;
    ip_address?: string | null;
    previous_state?: string | null;
    new_state?: string | null;
    comments?: string | null;
    correlation_id?: string | null;
  }) {
    try {
      const auditEvent = await prisma.auditEvent.create({
        data: {
          entity_type: data.entity_type,
          entity_id: data.entity_id,
          action_type: data.action_type,
          actor_id: data.actor_id ?? null,
          actor_type: data.actor_role ?? null,
          ip_address: data.ip_address ?? null,
          previous_state: data.previous_state ?? null,
          new_state: data.new_state ?? null,
          comments: data.comments ?? null,
          correlation_id: data.correlation_id ?? null,
        },
      });
      return auditEvent;
    } catch (error) {
      console.error('[AuditService] Failed to create audit log:', error);
      // Fail silently to avoid breaking core transactions if audit log fails
      return null;
    }
  }
}
