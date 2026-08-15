import prisma from '../../shared/prisma/client';
import { AppError } from '../../middlewares/error.middleware';
import { notificationService } from '../notifications/notification.service';
import { webSocketService } from '../notifications/websocket.service';

export class LeaveService {
  async getAllLeavePolicies() {
    return await prisma.leavePolicy.findMany();
  }

  async applyLeave(userId: number, data: {
    id?: number;
    leave_policy_id: number;
    start_date: string;
    end_date: string;
    reason?: string;
    isOverQuota?: boolean;
    extraDaysRequested?: number;
    overQuotaReason?: string;
    attachment_url?: string;
  }) {
    if (!data.start_date || !data.end_date) {
      throw new AppError('Start date and end date are required', 400);
    }
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new AppError('Invalid start date or end date format', 400);
    }
    const year = startDate.getFullYear();

    // Basic validation
    if (endDate < startDate) {
      throw new AppError('End date cannot be before start date', 400);
    }

    // Check for overlapping leave requests
    const overlappingRequest = await prisma.leaveRequest.findFirst({
      where: {
        user_id: userId,
        status: {
          in: ['PENDING', 'APPROVED', 'EXTENDED_APPROVAL']
        },
        start_date: {
          lte: endDate
        },
        end_date: {
          gte: startDate
        },
        ...(data.id ? {
          id: {
            not: Number(data.id)
          }
        } : {})
      }
    });

    if (overlappingRequest) {
      throw new AppError('You have already applied for leave during this date range', 400);
    }

    // Calculate duration (days)
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Check Leave Policy and Balance
    const leavePolicy = await prisma.leavePolicy.findUnique({
      where: { id: data.leave_policy_id }
    });

    if (!leavePolicy) {
      throw new AppError('Invalid leave policy', 404);
    }

    if ((leavePolicy as any).requires_document && !data.attachment_url) {
      throw new AppError('Document upload is required for this leave type', 400);
    }

    let leaveBalance = await prisma.leaveBalance.findUnique({
      where: {
        user_id_leave_policy_id_year: {
          user_id: userId,
          leave_policy_id: data.leave_policy_id,
          year: year
        }
      }
    });

    // Automatically initialize balance if it doesn't exist
    if (!leaveBalance) {
      leaveBalance = await prisma.leaveBalance.create({
        data: {
          user_id: userId,
          leave_policy_id: data.leave_policy_id,
          year: year,
          balance: leavePolicy.days_per_year,
          used: 0
        }
      });
    }

    const isOverQuota = Boolean(data.isOverQuota);
    if (leaveBalance.balance < duration && !isOverQuota) {
      throw new AppError('Insufficient leave balance', 400);
    }

    const reasonText = isOverQuota 
      ? `[Over-Quota Request: ${data.extraDaysRequested || 0} extra days. Justification: ${data.overQuotaReason || ''}] ${data.reason || ''}`.trim()
      : data.reason;

    const requestStatus = isOverQuota ? 'EXTENDED_APPROVAL' : 'PENDING';

    // Fetch reporting manager from UserDetail
    const userDetail = await prisma.userDetail.findUnique({
      where: { user_id: userId },
      select: { reporting_manager_id: true }
    });

    // Create Leave Request
    // Create or Update Leave Request
    let leaveRequest;
    if (data.id) {
      leaveRequest = await prisma.leaveRequest.update({
        where: { id: Number(data.id) },
        data: {
          leave_policy_id: data.leave_policy_id,
          start_date: startDate,
          end_date: endDate,
          duration: duration,
          reason: reasonText,
          status: requestStatus,
          reporting_manager_id: userDetail?.reporting_manager_id || null
        }
      });
    } else {
      leaveRequest = await prisma.leaveRequest.create({
        data: {
          user_id: userId,
          leave_policy_id: data.leave_policy_id,
          start_date: startDate,
          end_date: endDate,
          duration: duration,
          reason: reasonText,
          status: requestStatus,
          reporting_manager_id: userDetail?.reporting_manager_id || null,
          attachment_url: data.attachment_url || null,
        applied_at: new Date()
        } as any
      });
    }

    // Create notification in DB and trigger WebSocket event to manager & admins
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { details: { select: { first_name: true, last_name: true } } }
        });
        const employeeName = `${user?.details?.first_name || ''} ${user?.details?.last_name || ''}`.trim() || user?.username || 'An employee';

        const adminUsers = await prisma.user.findMany({
            where: {
                OR: [
                    { roles: { some: { role: { role_name: { in: ['tenant admin', 'tenant_admin', 'CEO', 'ceo', 'admin', 'ADMIN', 'super admin', 'SUPER ADMIN'] } } } } },
                    { details: { role: { role_name: { in: ['tenant admin', 'tenant_admin', 'CEO', 'ceo', 'admin', 'ADMIN', 'super admin', 'SUPER ADMIN'] } } } }
                ]
            },
            select: { id: true }
        });

        const recipientIds = new Set();
        if (userDetail?.reporting_manager_id) {
            recipientIds.add(userDetail.reporting_manager_id);
        }
        for (const u of adminUsers) {
            recipientIds.add(u.id);
        }
        recipientIds.delete(userId);

        for (const targetUserId of recipientIds) {
            if (!targetUserId || typeof targetUserId !== 'number') continue;
            const notification = await notificationService.create({
                user_id: targetUserId as number,
                title: 'New Leave Request',
                message: `A new leave request has been submitted by ${employeeName}.`,
                type: 'leave',
                metadata: {
                    leave_id: leaveRequest.id,
                    employee_name: employeeName,
                    employee_id: userId,
                    start_date: leaveRequest.start_date,
                    end_date: leaveRequest.end_date,
                    reason: leaveRequest.reason,
                    duration: leaveRequest.duration,
                    status: 'PENDING',
                    policy_name: leavePolicy.policy_name
                },
                related_module: 'leave',
                related_id: leaveRequest.id
            });

            webSocketService.sendNotification(targetUserId as number, 'leave_request', notification);
        }
    } catch (e) {
        console.error('Leave submit notification error:', e);
    }
    
    return leaveRequest;
  }

  async deleteLeaveRequest(id: number, userId: number) {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id }
    });

    if (!leaveRequest) {
      throw new AppError('Leave request not found', 404);
    }

    if (leaveRequest.user_id !== userId) {
      throw new AppError('Unauthorized to delete this leave request', 403);
    }

    if (leaveRequest.status !== 'PENDING' && leaveRequest.status !== 'EXTENDED_APPROVAL') {
      throw new AppError(`Cannot delete a leave request in ${leaveRequest.status} status`, 400);
    }

    await prisma.leaveRequest.delete({
      where: { id }
    });

    return { message: 'Leave request deleted successfully' };
  }

  async getMyLeaveRequests(userId: number) {
    return await prisma.leaveRequest.findMany({
      where: { user_id: userId },
      include: { leave_policy: true, manager: { select: { details: { select: { first_name: true, last_name: true } } } } },
      orderBy: { created_at: 'desc' }
    });
  }

  async getPendingRequests(managerId?: number, orgId?: number) {
    const where: any = { status: 'PENDING' };
    if (managerId) {
      where.reporting_manager_id = managerId;
    } else if (orgId) {
      where.user = { details: { department: { branches: { organization_id: orgId } } } };
    }
    
    return await prisma.leaveRequest.findMany({
      where,
      include: {
        user: {
          include: {
            details: {
              include: {
                department: true,
                designation: true,
                role: true,
                payroll_group: true,
                user_types: true,
                team: true
              }
            }
          }
        },
        leave_policy: true
      },
      orderBy: { created_at: 'asc' }
    });
  }


  async handleLeaveAction(requestId: number, approverId: number, data: {
    status: 'APPROVED' | 'REJECTED';
    rejection_reason?: string;
  }) {
    const request = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: {
        leave_policy: true,
        user: {
          include: {
            details: {
              include: {
                department: {
                  include: {
                    branches: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!request) {
      throw new AppError('Leave request not found', 404);
    }

    // Verify cross-tenant isolation
    const approver = await prisma.user.findUnique({
      where: { id: approverId },
      include: {
        details: {
          include: {
            department: {
              include: {
                branches: true
              }
            }
          }
        },
        roles: {
          include: {
            role: true
          }
        }
      }
    });

    const requestOrgId = request.user?.details?.department?.branches?.organization_id;
    const approverOrgId = approver?.details?.department?.branches?.organization_id;
    const isSuperAdmin = (approver?.roles || []).some((ur: any) =>
      ['SUPER ADMIN', 'SUPER_ADMIN'].includes(ur.role.role_name.toUpperCase())
    );

    if (!isSuperAdmin && requestOrgId !== approverOrgId) {
      throw new AppError('Unauthorized: Access denied to this leave request', 403);
    }

    const oldStatus = request.status;
    const newStatus = data.status;

    // If status is the same, just update metadata
    if (oldStatus === newStatus) {
      return await prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          approved_by: approverId,
          rejection_reason: data.rejection_reason || request.rejection_reason,
          updated_at: new Date()
        }
      });
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      let balanceAction: 'DEDUCT' | 'RESTORE' | 'NONE' = 'NONE';

      if (oldStatus !== 'APPROVED' && newStatus === 'APPROVED') {
        balanceAction = 'DEDUCT';
      } else if (oldStatus === 'APPROVED' && newStatus !== 'APPROVED') {
        balanceAction = 'RESTORE';
      }

      const year = new Date(request.start_date).getFullYear();

      if (balanceAction === 'DEDUCT') {
        const leaveBalance = await tx.leaveBalance.findUnique({
          where: {
            user_id_leave_policy_id_year: {
              user_id: request.user_id,
              leave_policy_id: request.leave_policy_id,
              year: year
            }
          }
        });

        if (!leaveBalance || leaveBalance.balance < request.duration) {
          throw new AppError('Insufficient leave balance for this action', 400);
        }

        await tx.leaveBalance.update({
          where: { id: leaveBalance.id },
          data: {
            balance: { decrement: request.duration },
            used: { increment: request.duration }
          }
        });
      } else if (balanceAction === 'RESTORE') {
        await tx.leaveBalance.update({
          where: {
            user_id_leave_policy_id_year: {
              user_id: request.user_id,
              leave_policy_id: request.leave_policy_id,
              year: year
            }
          },
          data: {
            balance: { increment: request.duration },
            used: { decrement: request.duration }
          }
        });
      }

      // Update Request status and other fields
      return await tx.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: newStatus,
          approved_by: approverId,
          rejection_reason: data.rejection_reason || null,
          updated_at: new Date()
        }
      });
    });

    // Create notification in DB and trigger WebSocket event to employee & admins
    try {
        const adminUsers = await prisma.user.findMany({
            where: {
                OR: [
                    { roles: { some: { role: { role_name: { in: ['tenant admin', 'tenant_admin', 'CEO', 'ceo', 'admin', 'ADMIN', 'super admin', 'SUPER ADMIN'] } } } } },
                    { details: { role: { role_name: { in: ['tenant admin', 'tenant_admin', 'CEO', 'ceo', 'admin', 'ADMIN', 'super admin', 'SUPER ADMIN'] } } } }
                ]
            },
            select: { id: true }
        });

        const recipientIds = new Set();
        recipientIds.add(request.user_id);
        for (const u of adminUsers) {
            recipientIds.add(u.id);
        }
        recipientIds.delete(approverId);

        for (const targetUserId of recipientIds) {
            if (!targetUserId || typeof targetUserId !== 'number') continue;
            const notification = await notificationService.create({
                user_id: targetUserId as number,
                title: targetUserId === request.user_id ? `Leave Request ${newStatus}` : `Leave Request ${newStatus} (Admin Info)`,
                message: targetUserId === request.user_id 
                    ? `Your leave request has been ${newStatus.toLowerCase()}.`
                    : `Leave request for employee ID ${request.user_id} has been ${newStatus.toLowerCase()} by approver ID ${approverId}.`,
                type: 'leave',
                metadata: {
                    leave_id: request.id,
                    status: newStatus,
                    start_date: request.start_date,
                    end_date: request.end_date,
                    policy_name: request.leave_policy.policy_name
                },
                related_module: 'leave',
                related_id: request.id
            });

            webSocketService.sendNotification(targetUserId as number, targetUserId === request.user_id ? 'leave_status' : 'leave_request', notification);
        }
    } catch (e) {
        console.error('Leave status update notification error:', e);
    }
    
    // Update existing notifications (e.g., for the manager) to reflect the new status
    // This ensures that if the manager opens the notification again, the buttons are gone
    const relatedNotifications = await prisma.notification.findMany({
        where: {
            related_module: 'leave',
            related_id: requestId,
        }
    });

    for (const n of relatedNotifications) {
        const currentMetadata = n.metadata as any || {};
        const updatedNotification = await prisma.notification.update({
            where: { id: n.id },
            data: {
                metadata: {
                    ...currentMetadata,
                    status: newStatus
                }
            }
        });
        webSocketService.sendNotification(n.user_id, 'notification_update', updatedNotification);
    }

    // Global broadcast for real-time dashboard updates
    webSocketService.broadcast('leave_action_processed', { 
        requestId, 
        status: newStatus,
        handledAt: new Date()
    });

    return updatedRequest;
  }

  async getMyLeaveBalance(userId: number, year: number) {
    const policies = await prisma.leavePolicy.findMany();
    const balances = await prisma.leaveBalance.findMany({
      where: { user_id: userId, year: year }
    });

    // Merge balances with policies to ensure every policy has a balance (real or virtual)
    return policies.map(policy => {
      const userBalance = balances.find(b => b.leave_policy_id === policy.id);
      return {
        leave_policy_id: policy.id,
        policy_name: policy.policy_name,
        leave_type: policy.leave_type,
        balance: userBalance ? userBalance.balance : policy.days_per_year,
        used: userBalance ? userBalance.used : 0,
        total_days: policy.days_per_year,
        year: year
      };
    });
  }

  async getAdminStats(orgId?: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const orgFilter = orgId ? { user: { details: { department: { branches: { organization_id: orgId } } } } } : {};

    const [pendingCount, approvedThisMonthCount, rejectedThisMonthCount, outToday] = await Promise.all([
      prisma.leaveRequest.count({ where: { status: 'PENDING', ...orgFilter } }),
      prisma.leaveRequest.count({
        where: {
          status: 'APPROVED',
          updated_at: { gte: startOfMonth },
          ...orgFilter
        }
      }),
      prisma.leaveRequest.count({
        where: {
          status: 'REJECTED',
          updated_at: { gte: startOfMonth },
          ...orgFilter
        }
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          start_date: { lte: today },
          end_date: { gte: today },
          ...orgFilter
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              details: { select: { first_name: true, last_name: true, employee_id: true } }
            }
          }
        }
      })
    ]);

    // Added: Department-wise analytics
    const departments = await prisma.department.findMany({
      where: orgId ? { branches: { organization_id: orgId } } : undefined,
      include: {
        userDetails: {
          include: {
            user: {
              include: {
                leaveRequests: {
                  where: { status: 'APPROVED' }
                }
              }
            }
          }
        }
      }
    });

    const department_analytics = (departments as any[]).map(dept => ({
      name: dept.department_name,
      employees: dept.userDetails.length,
      leaves: dept.userDetails.reduce((sum: number, detail: any) => sum + (detail.user?.leaveRequests?.length || 0), 0)
    }));

    return {
      pending_requests: pendingCount,
      approved_this_month: approvedThisMonthCount,
      rejected_this_month: rejectedThisMonthCount,
      out_today_count: outToday.length,
      out_today_employees: outToday.map(r => ({
        user_id: r.user_id,
        name: `${r.user.details?.first_name || ''} ${r.user.details?.last_name || ''}`.trim(),
        employee_id: r.user.details?.employee_id
      })),
      department_analytics
    };
  }

  async getLeaveHistory(params: {
    search?: string;
    user_id?: number;
    leave_policy_id?: number;
    status?: string;
    reporting_manager_id?: number;
    page?: number;
    limit?: number;
    orgId?: number;
  }) {
    const { search, user_id, leave_policy_id, status, reporting_manager_id, page = 1, limit = 10, orgId } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (orgId && !user_id && !reporting_manager_id) {
      where.user = { details: { department: { branches: { organization_id: orgId } } } };
    }

    if (user_id) where.user_id = user_id;
    if (leave_policy_id) where.leave_policy_id = leave_policy_id;
    
    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (reporting_manager_id) {
      where.reporting_manager_id = reporting_manager_id;
    }

    if (search) {
      where.OR = [
        { user: { details: { first_name: { contains: search } } } },
        { user: { details: { last_name: { contains: search } } } },
        { user: { details: { employee_id: { contains: search } } } }
      ];
    }

    const [total, records] = await Promise.all([
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            include: {
              details: {
                include: {
                  department: true,
                  designation: true,
                  role: true,
                  payroll_group: true,
                  user_types: true,
                  team: true
                }
              }
            }
          },
          leave_policy: true,
          approver: { select: { username: true } }
        },
        orderBy: { created_at: 'desc' }
      })
    ]);

    const currentYear = new Date().getFullYear();
    const recordsWithSummary = await Promise.all(records.map(async (r) => {
      const yearSummary = await prisma.leaveRequest.aggregate({
        where: {
          user_id: r.user_id,
          status: 'APPROVED',
          start_date: {
            gte: new Date(currentYear, 0, 1),
            lte: new Date(currentYear, 11, 31)
          }
        },
        _sum: { duration: true }
      });

      return {
        ...r,
        total_leaves_taken_this_year: yearSummary._sum.duration || 0
      };
    }));

    return {
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
      data: recordsWithSummary
    };
  }
}

export const leaveService = new LeaveService();
