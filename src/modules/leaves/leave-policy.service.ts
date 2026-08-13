import prisma from '../../shared/prisma/client';
import { AppError } from '../../middlewares/error.middleware';

export class LeavePolicyService {
  async create(data: {
    policy_name: string;
    leave_type?: string;
    days_per_year: number;
    carry_forward_days: number;
    accrual_rate: number;
    leave_category?: string;
    leave_color?: string;
    eligibility_criteria?: string;
    description?: string;
    requires_document?: boolean;
    document_url?: string;
  }) {
    if (!data.policy_name) throw new AppError('Policy name is required', 400);

    const existing = await prisma.leavePolicy.findUnique({ where: { policy_name: data.policy_name } });
    if (existing) throw new AppError('Leave policy with this name already exists', 400);

    // Ensure all required fields have values or defaults
    const payload = {
      ...data,
      leave_type: data.leave_type || 'General',
      leave_category: data.leave_category || 'paid',
      leave_color: data.leave_color || 'blue',
      days_per_year: Number(data.days_per_year) || 0,
      carry_forward_days: Number(data.carry_forward_days) || 0,
      accrual_rate: Number(data.accrual_rate) || 0,
      requires_document: data.requires_document !== undefined ? Boolean(data.requires_document) : false,
      document_url: data.document_url || null
    };

    return await prisma.leavePolicy.create({ data: payload as any });
  }

  async getAll() {
    return await prisma.leavePolicy.findMany();
  }

  async getById(id: number) {
    const policy = await prisma.leavePolicy.findUnique({ where: { id } });
    if (!policy) throw new AppError('Leave policy not found', 404);
    return policy;
  }

  async update(id: number, data: any) {
    const policy = await prisma.leavePolicy.findUnique({ where: { id } });
    if (!policy) throw new AppError('Leave policy not found', 404);

    return await prisma.leavePolicy.update({
      where: { id },
      data
    });
  }

  async delete(id: number) {
    const policy = await prisma.leavePolicy.findUnique({ where: { id } });
    if (!policy) throw new AppError('Leave policy not found', 404);

    // Check if any leave requests are using this policy
    const usage = await prisma.leaveRequest.findFirst({ where: { leave_policy_id: id } });
    if (usage) throw new AppError('Cannot delete policy that is already in use by leave requests', 400);

    return await prisma.leavePolicy.delete({ where: { id } });
  }
}

export const leavePolicyService = new LeavePolicyService();
