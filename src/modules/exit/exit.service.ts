import prisma from '../../shared/prisma/client';
import { AppError } from '../../middlewares/error.middleware';
import { notificationService } from '../notifications/notification.service';
import { webSocketService } from '../notifications/websocket.service';

export const EXIT_STATUS = {
  PENDING_ACCEPTANCE: 'PENDING_ACCEPTANCE',
  NEGOTIATION_PENDING: 'NEGOTIATION_PENDING',
  RESIGNATION_ACCEPTED: 'RESIGNATION_ACCEPTED',
  OFFBOARDING: 'OFFBOARDING',
  ASSET_HANDOVER: 'ASSET_HANDOVER',
  IT_CLEARANCE: 'IT_CLEARANCE',
  EXIT_INTERVIEW: 'EXIT_INTERVIEW',
  CLEARANCE: 'CLEARANCE',
  FINAL_SETTLEMENT: 'FINAL_SETTLEMENT',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED'
};

export class ExitService {
  async initiateExit(userId: number, data: {
    exit_type: string;
    notice_date: string;
    last_working_day: string;
    primary_reason: string;
    explanation?: string;
    notice_waiver: boolean;
    interview_pref?: string;
    handover_notes?: string;
    assets: Array<{ name: string; id: string; category: string; asset_id?: number; assignment_id?: number; return_status?: boolean; return_date?: string; condition?: string }>;
    acknowledged: boolean;
    kt_status?: string;
    kt_assignee_id?: number;
    kt_description?: string;
    kt_completion_date?: string;
    kt_verified_by_id?: number;
    kt_remarks?: string;
    reporting_manager_id?: number | string;
  }) {
    const numericUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;

    // 1. Notice Period Validation (TC-02)
    const noticeDate = new Date(data.notice_date);
    const lwd = new Date(data.last_working_day);
    const diffTime = Math.abs(lwd.getTime() - noticeDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const requiredNoticePeriod = 30; // Configurable default

    if (diffDays < requiredNoticePeriod && !data.notice_waiver) {
      throw new AppError(`The selected last working day does not meet the ${requiredNoticePeriod}-day notice period policy. Please request a waiver or adjust the date.`, 400);
    }

    // 2. Acknowledgement Validation
    if (!data.acknowledged) {
      throw new AppError('Acknowledgement of the offboarding policy is required', 400);
    }

    // 3. Check for existing active requests
    const existingRequest = await prisma.exitRequest.findFirst({
      where: { 
        user_id: numericUserId,
        status: { notIn: [EXIT_STATUS.COMPLETED, EXIT_STATUS.REJECTED] }
      }
    });

    if (existingRequest) {
      throw new AppError('You already have an active exit request in progress.', 400);
    }

    // 4. Fetch reporting manager
    const userDetail = await prisma.userDetail.findUnique({
      where: { user_id: numericUserId },
      include: {
        reporting_manager: {
          select: { id: true }
        }
      }
    });

    const resolvedManagerId = data.reporting_manager_id && Number(data.reporting_manager_id) > 0
      ? Number(data.reporting_manager_id)
      : (userDetail?.reporting_manager?.id || null);

    // 5. Calculate Manager SLA (3 business days)
    const slaDeadline = new Date();
    slaDeadline.setDate(slaDeadline.getDate() + 3);

    // 6. Create Exit Request in transaction
    const result = await prisma.$transaction(async (tx) => {
      const exitRequest = await tx.exitRequest.create({
        data: {
          user_id: numericUserId,
          exit_type: data.exit_type,
          notice_date: noticeDate,
          last_working_day: lwd,
          primary_reason: data.primary_reason,
          explanation: data.explanation,
          notice_waiver: data.notice_waiver,
          interview_pref: data.interview_pref,
          handover_notes: data.handover_notes,
          status: EXIT_STATUS.PENDING_ACCEPTANCE,
          acknowledged: data.acknowledged,
          progress_percentage: 10,
          notice_period_days: requiredNoticePeriod,
          sla_deadline: slaDeadline,
          // @ts-ignore
          reporting_manager_id: resolvedManagerId,
          kt_status: data.kt_status || 'Not Started',
          kt_assignee_id: data.kt_assignee_id ? Number(data.kt_assignee_id) : null,
          kt_description: data.kt_description || null,
          kt_completion_date: data.kt_completion_date ? new Date(data.kt_completion_date) : null,
          kt_verified_by_id: data.kt_verified_by_id ? Number(data.kt_verified_by_id) : null,
          kt_remarks: data.kt_remarks || null
        }
      });

      // Create Assets
      if (data.assets && data.assets.length > 0) {
        await tx.exitAsset.createMany({
          data: data.assets.map(asset => ({
            exit_request_id: exitRequest.id,
            asset_name: asset.name || (asset as any).asset_name,
            asset_serial_no: asset.id || (asset as any).asset_serial_no,
            category: asset.category,
            asset_id: asset.asset_id,
            assignment_id: asset.assignment_id,
            return_status: asset.return_status ?? false,
            return_date: asset.return_date ? new Date(asset.return_date) : null,
            condition: asset.condition || 'Pending Verification'
          }))
        });
      }

      // Create Initial Workflow History
      await tx.exitWorkflowHistory.create({
        data: {
          exit_request_id: exitRequest.id,
          action: 'INITIATED',
          comments: 'Exit request submitted by employee',
          actor_id: numericUserId
        }
      });

      return exitRequest;
    });

    // 7. Notify Manager & HR (TC-01)
    const user = await prisma.user.findUnique({
      where: { id: numericUserId },
      include: {
        details: {
          include: {
            reporting_manager: {
              select: { id: true }
            }
          }
        }
      }
    });
    const employeeName = `${user?.details?.first_name || ''} ${user?.details?.last_name || ''}`.trim() || user?.username || 'An employee';

    const managerId = resolvedManagerId || user?.details?.reporting_manager?.id || result.reporting_manager_id;

    // Notify Manager
    if (managerId) {
      const managerNotification = await notificationService.create({
        user_id: Number(managerId),
        title: 'New Exit Request',
        message: `An exit request has been initiated by ${employeeName}. Approval is required within 3 days.`,
        type: 'exit',
        metadata: {
          exit_id: result.id,
          employee_name: employeeName,
          exit_type: result.exit_type,
          last_working_day: result.last_working_day,
          status: 'PENDING'
        },
        related_module: 'exit',
        related_id: result.id
      });
      webSocketService.sendNotification(Number(managerId), 'notification', managerNotification);
      webSocketService.sendNotification(Number(managerId), 'exit_request', managerNotification);
    }

    // Notify HR & Admin Team
    const hrUsers = await prisma.user.findMany({
      where: { 
        is_deleted: false,
        status: true,
        OR: [
          { 
            roles: { 
              some: { 
                role: { 
                  role_name: { in: ['HR', 'ADMIN', 'SUPER ADMIN', 'CEO', 'SYSTEM ADMINISTRATOR', 'hr', 'admin', 'super admin', 'ceo', 'system administrator', 'HR_ADMIN', 'SUPER_ADMIN'] } 
                } 
              } 
            } 
          },
          { details: { role: { role_name: { in: ['HR', 'ADMIN', 'SUPER ADMIN', 'CEO', 'SYSTEM ADMINISTRATOR', 'hr', 'admin', 'super admin', 'ceo', 'system administrator', 'HR_ADMIN', 'SUPER_ADMIN'] } } } }
        ]
      },
      select: { id: true }
    });

    for (const hr of hrUsers) {
      if (managerId && Number(hr.id) === Number(managerId)) continue; // Avoid duplicate notification if manager is also HR
      const hrNotification = await notificationService.create({
        user_id: hr.id,
        title: 'New Resignation Submitted',
        message: `${employeeName} has submitted their resignation.`,
        type: 'exit',
        metadata: {
          exit_id: result.id,
          employee_name: employeeName,
          status: 'INITIATED'
        },
        related_module: 'exit',
        related_id: result.id
      });
      webSocketService.sendNotification(hr.id, 'notification', hrNotification);
      webSocketService.sendNotification(hr.id, 'exit_request_hr', hrNotification);
    }

    return result;
  }

  async getExitStats(userId: number, roles: string[], orgId?: number) {
    // Determine if user is a manager/admin to see all cases
    const normalizedRoles = roles.map(r => r.toUpperCase());
    const isAdmin = normalizedRoles.some(r => ['SUPER ADMIN', 'SUPER_ADMIN', 'ADMIN', 'CEO', 'SYSTEM ADMINISTRATOR'].includes(r));
    const isManager = normalizedRoles.some(r => ['MANAGER', 'TEAM MANAGER'].includes(r));

    const baseWhere: any = {};
    if (isAdmin) {
      if (orgId) {
        baseWhere.user = { details: { department: { branches: { organization_id: orgId } } } };
      }
    } else if (isManager) {
      baseWhere.reporting_manager_id = userId;
    } else {
      baseWhere.user_id = userId;
    }

    const [
      totalCases,
      initiated,
      inProgress,
      pendingClearance,
      completed,
      pendingMyApproval
    ] = await Promise.all([
      prisma.exitRequest.count({ where: baseWhere }),
      prisma.exitRequest.count({ where: { ...baseWhere, status: EXIT_STATUS.PENDING_ACCEPTANCE } }),
      prisma.exitRequest.count({ 
        where: { 
          ...baseWhere, 
          status: { in: [EXIT_STATUS.RESIGNATION_ACCEPTED, EXIT_STATUS.OFFBOARDING, EXIT_STATUS.CLEARANCE, EXIT_STATUS.FINAL_SETTLEMENT] } 
        } 
      }),
      prisma.exitRequest.count({ 
        where: { 
          ...baseWhere, 
          status: { in: [EXIT_STATUS.CLEARANCE] } 
        } 
      }),
      prisma.exitRequest.count({ where: { ...baseWhere, status: EXIT_STATUS.COMPLETED } }),
      prisma.exitRequest.count({ 
        where: { 
          status: { in: [EXIT_STATUS.PENDING_ACCEPTANCE, EXIT_STATUS.NEGOTIATION_PENDING] },
          // @ts-ignore
          reporting_manager_id: userId
        } 
      })
    ]);

    return {
      totalCases,
      initiated,
      inProgress,
      pendingClearance,
      completed,
      pendingMyApproval
    };
  }

  async getAllExitRequests(params: { search?: string; status?: string; userId?: number; roles?: string[]; orgId?: number }) {
    const { search, status, userId, roles = [], orgId } = params;
    const normalizedRoles = roles.map(r => r.toUpperCase());
    const isAdmin = normalizedRoles.some(r => ['SUPER ADMIN', 'SUPER_ADMIN', 'ADMIN', 'CEO', 'SYSTEM ADMINISTRATOR'].includes(r));
    const isManager = normalizedRoles.some(r => ['MANAGER', 'TEAM MANAGER'].includes(r));

    const where: any = {};

    // Apply role-based filtering
    if (isAdmin) {
      if (orgId) {
        where.user = { details: { department: { branches: { organization_id: orgId } } } };
      }
    } else if (isManager && userId) {
      // Managers see requests where they are the reporting manager
      // @ts-ignore
      where.reporting_manager_id = userId;
    } else if (userId) {
      // Employees see their own requests
      where.user_id = userId;
    }

    // Filter by status
    if (status && status !== 'All') {
      where.status = status;
    }

    // Search filter
    if (search) {
      where.OR = [
        { user: { details: { first_name: { contains: search } } } },
        { user: { details: { last_name: { contains: search } } } },
        { user: { details: { employee_id: { contains: search } } } }
      ];
    }

    return await prisma.exitRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            status: true,
            details: {
              select: {
                first_name: true,
                last_name: true,
                employee_id: true,
                profile_picture: true,
                phone: true,
                gender: true,
                date_of_birth: true,
                blood_group: true,
                base_salary: true,
                start_date: true,
                work_location: true,
                probation_period: true,
                employment_type: true,
                address: true,
                city: true,
                state: true,
                country: true,
                bank_name: true,
                account_number: true,
                ifsc_code: true,
                pan_number: true,
                aadhaar_number: true,
                shift_id: true,
                department: { select: { department_name: true } },
                designation: { select: { designation_name: true } },
                role: { select: { role_name: true } },
                team: { select: { team_name: true } },
                payroll_group: { select: { name: true } },
                user_types: { select: { name: true } },
                reporting_manager: {
                  select: {
                    username: true,
                    details: {
                      select: {
                        first_name: true,
                        last_name: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        assets: true
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async getMyExitRequests(userId: number) {
    return await prisma.exitRequest.findMany({
      where: { user_id: userId },
      include: { 
        assets: true,
        documents: true
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async negotiateLWD(id: string, proposedLwd: string, actorId: number, role: string) {
    const exitRequestId = parseInt(id, 10);
    const request = await prisma.exitRequest.findUnique({
      where: { id: exitRequestId },
      include: {
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

    if (!request) throw new AppError('Request not found', 404);

    // Verify cross-tenant isolation
    const actor = await prisma.user.findUnique({
      where: { id: actorId },
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
    const actorOrgId = actor?.details?.department?.branches?.organization_id;
    const isSuperAdmin = (actor?.roles || []).some((ur: any) =>
      ['SUPER ADMIN', 'SUPER_ADMIN'].includes(ur.role.role_name.toUpperCase())
    );

    if (!isSuperAdmin && requestOrgId !== actorOrgId) {
      throw new AppError('Unauthorized: Access denied to this exit request', 403);
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.exitRequest.update({
        where: { id: exitRequestId },
        data: {
          negotiated_lwd: new Date(proposedLwd),
          status: EXIT_STATUS.NEGOTIATION_PENDING,
          progress_percentage: 15
        }
      });

      await tx.exitWorkflowHistory.create({
        data: {
          exit_request_id: exitRequestId,
          action: 'LWD_NEGOTIATION',
          comments: `Manager proposed new LWD: ${new Date(proposedLwd).toLocaleDateString()}`,
          actor_id: actorId
        }
      });

      return updated;
    });

    // Notify Employee about the manager's LWD negotiation
    try {
      const managerName = `${actor?.details?.first_name || ''} ${actor?.details?.last_name || ''}`.trim() || 'Your Manager';
      const formattedLwd = new Date(proposedLwd).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
      console.log(`[LWD Notify] Sending to employee user_id=${request.user_id}, manager=${managerName}, lwd=${formattedLwd}`);
      const employeeNotification = await notificationService.create({
        user_id: request.user_id,
        title: '📅 LWD Negotiation — Manager Proposal',
        message: `${managerName} has proposed a new Last Working Day: ${formattedLwd}. Please review and accept or respond through your exit portal.`,
        type: 'exit',
        metadata: {
          exit_id: exitRequestId,
          proposed_lwd: proposedLwd,
          formatted_lwd: formattedLwd,
          manager_name: managerName,
          status: 'NEGOTIATION_PENDING'
        },
        related_module: 'exit',
        related_id: exitRequestId
      });
      // notificationService.create already sends 'notification' event via WebSocket internally.
      // Send 'lwd_negotiation' as a separate event so frontend can show a specific toast.
      webSocketService.sendNotification(request.user_id, 'lwd_negotiation', employeeNotification);
      console.log(`[LWD Notify] Notification created id=${employeeNotification.id}, WS event sent to user ${request.user_id}`);
    } catch (notifError) {
      console.error('[LWD Notify] Failed to send LWD negotiation notification to employee:', notifError);
    }
  }

  async updateExitStatus(id: string, status: string, approverId: number, interviewResponses?: any) {
    const exitRequestId = parseInt(id, 10);
    const exitRequest = await prisma.exitRequest.findUnique({
      where: { id: exitRequestId },
      include: { 
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

    if (!exitRequest) {
      throw new AppError('Exit request not found', 404);
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

    const requestOrgId = exitRequest.user?.details?.department?.branches?.organization_id;
    const approverOrgId = approver?.details?.department?.branches?.organization_id;
    const isSuperAdmin = (approver?.roles || []).some((ur: any) =>
      ['SUPER ADMIN', 'SUPER_ADMIN'].includes(ur.role.role_name.toUpperCase())
    );

    if (!isSuperAdmin && requestOrgId !== approverOrgId) {
      throw new AppError('Unauthorized: Access denied to this exit request', 403);
    }

    const updated = await prisma.$transaction(async (tx) => {
      let progress = 0;
      switch (status) {
        case EXIT_STATUS.PENDING_ACCEPTANCE: progress = 10; break;
        case EXIT_STATUS.NEGOTIATION_PENDING: progress = 15; break;
        case EXIT_STATUS.RESIGNATION_ACCEPTED: progress = 25; break;
        case EXIT_STATUS.OFFBOARDING: progress = 35; break;
        case EXIT_STATUS.ASSET_HANDOVER: progress = 45; break;
        case EXIT_STATUS.IT_CLEARANCE: progress = 60; break;
        case EXIT_STATUS.CLEARANCE: progress = 65; break;
        case EXIT_STATUS.EXIT_INTERVIEW: progress = 75; break;
        case EXIT_STATUS.FINAL_SETTLEMENT: progress = 90; break;
        case EXIT_STATUS.COMPLETED: progress = 100; break;
        case EXIT_STATUS.REJECTED: progress = 0; break;
      }

      // 1. Update status
      const updateData: any = {
        status,
        progress_percentage: progress
      };
      if (status === EXIT_STATUS.RESIGNATION_ACCEPTED && exitRequest.negotiated_lwd) {
        updateData.last_working_day = exitRequest.negotiated_lwd;
      }

      const updatedRequest = await tx.exitRequest.update({
        where: { id: exitRequestId },
        data: updateData
      });

      // 1.1 Create Interview Response if provided
      if (interviewResponses) {
        await tx.exitInterviewResponse.upsert({
          where: { exit_request_id: exitRequestId },
          create: {
            exit_request_id: exitRequestId,
            data: interviewResponses.data || {}
          },
          update: {
            data: interviewResponses.data || {}
          }
        });
      }

      // 2. Add Workflow History record
      let actionLabel = status;
      let comment = `Request moved to ${status.toLowerCase()} phase`;

      if (status === EXIT_STATUS.RESIGNATION_ACCEPTED) {
        actionLabel = 'MANAGER_APPROVED';
        comment = 'Manager has accepted the resignation request.';
      }

      await tx.exitWorkflowHistory.create({
        data: {
          exit_request_id: exitRequestId,
          action: actionLabel,
          comments: comment,
          actor_id: approverId
        }
      });

      // 3. Auto-generate clearance tasks if status is OFFBOARDING (Phase 3 Trigger - TC-09)
      if (status === EXIT_STATUS.OFFBOARDING) {
        const taskSla = new Date();
        taskSla.setDate(taskSla.getDate() + 7); // Default 7 days for clearance

        const tasks = [
          { name: 'IT', task: 'Asset Audit & Recovery', sla: taskSla },
          { name: 'IT', task: 'Access Deprovisioning', sla: taskSla },
          { name: 'Finance', task: 'Final Settlement Calculation', sla: taskSla },
          { name: 'HR', task: 'Exit Interview Scheduling', sla: taskSla },
          { name: 'HR', task: 'Document Checklist Verification', sla: taskSla },
          { name: 'Manager', task: 'Knowledge Transfer & Handover', sla: taskSla }
        ];

        // Check if employee has assets
        const hasAssets = await tx.exitAsset.count({ where: { exit_request_id: exitRequestId } });
        const finalTasks = hasAssets > 0 ? tasks : tasks.filter(t => t.task !== 'Asset Audit & Recovery');

        await tx.exitClearanceTask.createMany({
          data: finalTasks.map(d => ({
            exit_request_id: exitRequestId,
            task_name: d.task,
            department: d.name,
            status: 'PENDING',
            sla_deadline: d.sla
          }))
        });
      }

      // 4. Create Settlement Record if status is FINAL_SETTLEMENT
      if (status === EXIT_STATUS.FINAL_SETTLEMENT) {
        // ── Auto-calculate F&F Settlement ───────────────────────────────
        const userId = exitRequest.user_id;

        // Fetch latest payslip for salary reference
        const lastPayslip = await tx.payslip.findFirst({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' }
        });

        // Fetch employee joining date and base salary compensation details
        const userDetail = await tx.userDetail.findUnique({
          where: { user_id: userId },
          select: { id: true, joining_date: true, start_date: true, base_salary: true, compensation_breakdown: true }
        });

        // Fetch earned leave balance from leave balances
        const leaveBalances = await tx.leaveBalance.findMany({
          where: { user_id: userId },
          include: { leave_policy: true }
        });
        const leaveBalRecord = leaveBalances.find(b => 
          b.leave_policy?.policy_name?.toLowerCase().includes('earned')
        );
        const earnedLeaveBalance = leaveBalRecord ? Number(leaveBalRecord.balance) : 0;

        const lwd = exitRequest.last_working_day || new Date();
        const joiningDate = userDetail?.joining_date || userDetail?.start_date || lwd;
        const yearsOfService = Math.max(0,
          (lwd.getTime() - new Date(joiningDate).getTime()) / (1000 * 60 * 60 * 24 * 365)
        );

        // Fetch statutory settings dynamically from database
        const getSettingVal = async (key: string, fallback: number): Promise<number> => {
          try {
            const setting = await tx.systemSetting.findUnique({
              where: { key }
            });
            if (setting && setting.value) {
              const val = parseFloat(setting.value);
              if (!isNaN(val)) return val;
            }
          } catch (e) {
            console.error(`Error loading system setting ${key}:`, e);
          }
          return fallback;
        };

        const gratuityYears = await getSettingVal('GRATUITY_YEARS_THRESHOLD', 5);
        const gratuityMult = await getSettingVal('GRATUITY_MULTIPLIER', 15);
        const gratuityDiv = await getSettingVal('GRATUITY_DIVISOR', 26);
        const leaveDiv = await getSettingVal('LEAVE_ENCASHMENT_DIVISOR', 30);

        // Monthly Basic calculation (Falls back to 40% of UserDetail.base_salary if no payslip is found)
        let monthlyBasic = 0;
        if (lastPayslip) {
          const breakdown: any = lastPayslip?.breakdown || {};
          const earnings: any = breakdown.earnings || {};
          monthlyBasic = Number(
            earnings['Basic'] || earnings['Basic Salary'] || (Number(lastPayslip?.gross_amount || 0) * 0.4)
          );
        } else if (userDetail?.base_salary) {
          monthlyBasic = Number(userDetail.base_salary) * 0.4; // Standard 40% basic pay ratio
        }
        const dailyBasic = monthlyBasic / leaveDiv;

        // ── Gratuity: (Multiplier/Divisor) × monthly basic × years of service
        // Applicable only if employee served >= years threshold (or waived by org)
        const gratuity = yearsOfService >= gratuityYears
          ? Math.round((monthlyBasic * gratuityMult / gratuityDiv) * yearsOfService)
          : 0;

        // ── Leave Encashment: (monthly basic / Leave Divisor) × earned leave balance ─
        const leaveEncashment = Math.round(dailyBasic * earnedLeaveBalance);

        // ── Notice Pay Recovery: if notice not served ───────────────────
        const noticePeriodDays = exitRequest.notice_period_days || 0;
        const actualNoticeDays = exitRequest.last_working_day && exitRequest.notice_date
          ? Math.ceil((new Date(exitRequest.last_working_day).getTime() - new Date(exitRequest.notice_date).getTime()) / (1000 * 60 * 60 * 24))
          : noticePeriodDays;
        const shortfallDays = Math.max(0, noticePeriodDays - actualNoticeDays);
        const noticePay = exitRequest.notice_waiver ? 0 : -Math.round(dailyBasic * shortfallDays);

        // ── Last Month's Salary (prorated) ──────────────────────────────
        // If no payslip exists (e.g. for seeded/new users during testing), 
        // we automatically fetch base_salary and prorate it dynamically by active days in final month!
        let lastMonthSalary = 0;
        if (lastPayslip) {
          lastMonthSalary = Number(lastPayslip.net_amount || 0);
        } else if (userDetail?.base_salary) {
          const lwdDate = new Date(lwd);
          const daysInMonth = new Date(lwdDate.getFullYear(), lwdDate.getMonth() + 1, 0).getDate();
          const activeDays = lwdDate.getDate(); // Days worked in final exit month
          lastMonthSalary = Math.round((Number(userDetail.base_salary) / daysInMonth) * activeDays);
        }

        let autoLoanRecovery = 0;
        let autoAdvanceRecovery = 0;
        
        try {
          const activeLoans = await tx.loan.findMany({ where: { userDetailId: userDetail?.id, isActive: true } });
          autoLoanRecovery = activeLoans.reduce((sum: number, loan: any) => sum + Number(loan.outstandingBalance), 0);
          
          const activeAdvances = await tx.advance.findMany({ where: { userDetailId: userDetail?.id, isActive: true } });
          autoAdvanceRecovery = activeAdvances.reduce((sum: number, adv: any) => sum + Number(adv.outstandingBalance), 0);
        } catch (e) {
          console.error('Error fetching loans for F&F recovery:', e);
        }

        const totalEarnings = lastMonthSalary + gratuity + leaveEncashment + (noticePay > 0 ? noticePay : 0);
        const totalDeductions = (noticePay < 0 ? Math.abs(noticePay) : 0) + autoAdvanceRecovery + autoLoanRecovery;
        const netPayable = totalEarnings - totalDeductions;

        await tx.exitSettlement.upsert({
          where: { exit_request_id: exitRequestId },
          create: {
            exit_request_id: exitRequestId,
            total_earnings: totalEarnings,
            total_deductions: totalDeductions,
            net_payable: netPayable,
            gratuity: gratuity,
            leave_encashment: leaveEncashment,
            notice_pay: noticePay,
            data: {
              yearsOfService: parseFloat(yearsOfService.toFixed(2)),
              monthlyBasic,
              earnedLeaveBalance,
              lastMonthSalary,
              shortfallDays,
              salaryAdvanceRecovery: autoAdvanceRecovery,
              loanRecovery: autoLoanRecovery,
              additionalDeductions: 0
            }
          },
          update: {
            total_earnings: totalEarnings,
            total_deductions: totalDeductions,
            net_payable: netPayable,
            gratuity: gratuity,
            leave_encashment: leaveEncashment,
            notice_pay: noticePay,
            data: {
              yearsOfService: parseFloat(yearsOfService.toFixed(2)),
              monthlyBasic,
              earnedLeaveBalance,
              lastMonthSalary,
              shortfallDays,
              salaryAdvanceRecovery: autoAdvanceRecovery,
              loanRecovery: autoLoanRecovery,
              additionalDeductions: 0
            }
          }
        });
      }

      // 5. Deactivate user and close loans/advances if status is COMPLETED
      if (status === EXIT_STATUS.COMPLETED) {
        await tx.user.update({
          where: { id: exitRequest.user_id },
          data: { 
            status: false,
            // Also update any related auth tokens or sessions if needed
          }
        });
        
        await tx.userDetail.update({
          where: { user_id: exitRequest.user_id },
          data: { exit_date: new Date() }
        });

        // Close any active loans and advances
        await tx.loan.updateMany({
          where: { userDetailId: exitRequest.user.details?.id, isActive: true },
          data: { isActive: false, outstandingBalance: 0 }
        });

        await tx.advance.updateMany({
          where: { userDetailId: exitRequest.user.details?.id, isActive: true },
          data: { isActive: false, outstandingBalance: 0 }
        });
      }
    });

    // Refetch with all relations to ensure frontend is perfectly synced
    // Using a direct findUnique here to be 100% sure we get the latest DB state
    const finalResult = await prisma.exitRequest.findUnique({
      where: { id: exitRequestId },
      include: {
        user: { include: { details: { include: { department: true, team: true, reporting_manager: { include: { details: true } }, loans: { where: { isActive: true } }, advances: { where: { isActive: true } } } } } },
        assets: true,
        documents: true,
        clearance_tasks: true,
        workflow_history: { include: { actor: { include: { details: true } } }, orderBy: { created_at: 'asc' } },
        interview_responses: true,
        settlement_data: true
      }
    });

    if (!finalResult) {
      throw new AppError('Updated exit request not found', 404);
    }

    // Notify Employee
    const notification = await notificationService.create({
      user_id: exitRequest.user_id,
      title: `Exit Request Update`,
      message: status === 'ASSET_HANDOVER' ? 'Your exit request has been approved by Admin. Asset handover process started.' : `Your exit request status is now ${status}.`,
      type: 'exit',
      metadata: {
        exit_id: finalResult.id,
        status: finalResult.status
      },
      related_module: 'exit',
      related_id: finalResult.id
    });

    // Send real-time update to the employee
    webSocketService.sendNotification(exitRequest.user_id, 'exit_request_update', {
      ...notification,
      request: finalResult
    });

    // Notify HR / Admins for Clearance & Approvals
    if (['ASSET_HANDOVER', 'IT_CLEARANCE', 'CLEARANCE'].includes(status)) {
      try {
        const employeeName = `${exitRequest.user?.details?.first_name || ''} ${exitRequest.user?.details?.last_name || ''}`.trim() || exitRequest.user?.username || 'Employee';
        const hrUsers = await prisma.user.findMany({
          where: {
            is_deleted: false,
            OR: [
              { roles: { some: { role: { role_name: { in: ['HR', 'ADMIN', 'SUPER ADMIN', 'CEO', 'SYSTEM ADMINISTRATOR', 'hr', 'admin', 'super admin', 'ceo', 'system administrator', 'HR_ADMIN', 'SUPER_ADMIN'] } } } } },
              { details: { role: { role_name: { in: ['HR', 'ADMIN', 'SUPER ADMIN', 'CEO', 'SYSTEM ADMINISTRATOR', 'hr', 'admin', 'super admin', 'ceo', 'system administrator', 'HR_ADMIN', 'SUPER_ADMIN'] } } } }
            ]
          },
          select: { id: true }
        });

        for (const hr of hrUsers) {
          const hrNotif = await notificationService.create({
            user_id: hr.id,
            title: 'Action Required: Clearance Pending',
            message: `Resignation status updated for ${employeeName}. Please work on employee clearance.`,
            type: 'exit',
            metadata: {
              exit_id: finalResult.id,
              employee_name: employeeName,
              status: finalResult.status
            },
            related_module: 'exit',
            related_id: finalResult.id
          });
          webSocketService.sendNotification(hr.id, 'notification', hrNotif);
        }
      } catch (hrNotifError) {
        console.error('Failed to notify HR team of clearance:', hrNotifError);
      }
    }

    // Notify Finance Team for Final Settlement
    if (status === 'FINAL_SETTLEMENT') {
      try {
        const employeeName = `${exitRequest.user?.details?.first_name || ''} ${exitRequest.user?.details?.last_name || ''}`.trim() || exitRequest.user?.username || 'Employee';
        const financeUsers = await prisma.user.findMany({
          where: {
            is_deleted: false,
            OR: [
              {
                roles: {
                  some: {
                    role: {
                      role_name: {
                        in: ['FINANCE', 'FINANCE_ADMIN', 'ACCOUNTANT', 'finance', 'accountant']
                      }
                    }
                  }
                }
              },
              {
                details: {
                  role: {
                    role_name: {
                      in: ['FINANCE', 'FINANCE_ADMIN', 'ACCOUNTANT', 'finance', 'accountant']
                    }
                  }
                }
              }
            ]
          },
          select: { id: true }
        });

        for (const fin of financeUsers) {
          const finNotification = await notificationService.create({
            user_id: fin.id,
            title: 'Action Required: Final Settlement',
            message: `Exit Interview completed for ${employeeName}. Please process full & final settlement.`,
            type: 'exit',
            metadata: {
              exit_id: finalResult.id,
              employee_name: employeeName,
              status: 'FINAL_SETTLEMENT'
            },
            related_module: 'exit',
            related_id: finalResult.id
          });
          webSocketService.sendNotification(fin.id, 'notification', finNotification);
        }
      } catch (e) {
        console.error('Failed to notify finance team of final settlement:', e);
      }
    }

    return finalResult;
  }

  async getExitRequestById(id: string | number) {
    const exitRequestId = typeof id === 'string' ? parseInt(id, 10) : id;
    const request = await prisma.exitRequest.findUnique({
      where: { id: exitRequestId },
      include: {
        user: {
          include: {
            details: {
              include: {
                department: true,
                team: true,
                reporting_manager: {
                  include: {
                    details: true
                  }
                },
                loans: { where: { isActive: true } },
                advances: { where: { isActive: true } }
              }
            }
          }
        },
        assets: true,
        documents: true,
        clearance_tasks: true,
        workflow_history: {
          include: {
            actor: {
              include: {
                details: true
              }
            }
          },
          orderBy: { created_at: 'asc' }
        },
        interview_responses: true,
        settlement_data: true,
        kt_assignee: {
          include: {
            details: true
          }
        },
        kt_verified_by: {
          include: {
            details: true
          }
        }
      }
    });

    // Auto-seed clearance tasks for active requests so Clearance Checklist is always populated
    if (request && request.status !== 'REJECTED') {
      const requiredTasks = [
        { name: 'IT', task: 'Email disable' },
        { name: 'IT', task: 'System access revoke' },
        { name: 'IT', task: 'Data backup / transfer' },
        { name: 'Security', task: 'Security clearance & badge return' },
        { name: 'Finance', task: 'Expense & travel claim clearance' },
        { name: 'HR', task: 'Knowledge transfer & HR clearance' }
      ];

      const existingTaskNames = request.clearance_tasks.map((t: any) => t.task_name);
      const missingTasks = requiredTasks.filter(rt => !existingTaskNames.includes(rt.task));

      if (missingTasks.length > 0) {
        await prisma.exitClearanceTask.createMany({
          data: missingTasks.map(mt => ({
            exit_request_id: exitRequestId,
            task_name: mt.task,
            department: mt.name,
            status: 'PENDING'
          }))
        });
        
        // Return the updated request with new tasks
        return await prisma.exitRequest.findUnique({
          where: { id: exitRequestId },
          include: {
            user: { include: { details: { include: { department: true, team: true, reporting_manager: { include: { details: true } } } } } },
            assets: true,
            documents: true,
            clearance_tasks: true,
            workflow_history: { include: { actor: { include: { details: true } } }, orderBy: { created_at: 'asc' } },
            interview_responses: true,
            settlement_data: true
          }
        });
      }
    }

    return request;
  }

  async updateAssetStatus(assetId: number, returnStatus: boolean) {
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update ExitAsset record
      const exitAsset = await tx.exitAsset.update({
        where: { id: assetId },
        data: { return_status: returnStatus },
        include: {
          exit_request: {
            include: {
              assets: true
            }
          }
        }
      });

      // 2. If returned, automate main Asset module updates
      if (returnStatus && exitAsset.asset_id) {
        // Update Asset status to AVAILABLE
        await tx.asset.update({
          where: { id: exitAsset.asset_id },
          data: { status: 'AVAILABLE' }
        });

        // Update Assignment to RETURNED
        if (exitAsset.assignment_id) {
          await tx.assetAssignment.update({
            where: { id: exitAsset.assignment_id },
            data: { 
              status: 'RETURNED',
              return_date: new Date()
            }
          });
        }

        // Get organization_id from asset
        const asset = await tx.asset.findUnique({
          where: { id: exitAsset.asset_id },
          select: { organization_id: true }
        });

        // Add history log
        await tx.assetHistory.create({
          data: {
            organization_id: asset?.organization_id || 1, 
            asset_id: exitAsset.asset_id,
            action_type: 'RETURNED',
            field_changed: 'status',
            old_value: 'ASSIGNED',
            new_value: 'AVAILABLE',
            changed_by_id: 1 // System actor
          }
        });
      }

      // 3. Auto-clearance of IT task if all assets are returned
      const allAssets = exitAsset.exit_request.assets;
      const allReturned = allAssets.every(a => a.return_status);

      if (allReturned) {
        const itClearanceTask = await tx.exitClearanceTask.findFirst({
          where: {
            exit_request_id: exitAsset.exit_request_id,
            task_name: 'Asset Audit & Recovery',
            status: 'PENDING'
          }
        });

        if (itClearanceTask) {
          await tx.exitClearanceTask.update({
            where: { id: itClearanceTask.id },
            data: { 
              status: 'COMPLETED',
              completion_date: new Date(),
              remarks: 'Auto-completed via Asset Module integration.'
            }
          });
        }
      }

      return exitAsset;
    });

    return updated;
  }

  async updateClearanceTaskStatus(taskId: number, status: string, proofUrl?: string, proofType?: string) {
    const updated = await prisma.exitClearanceTask.update({
      where: { id: taskId },
      data: { 
        status,
        proof_url: proofUrl,
        proof_type: proofType,
        completion_date: status === 'COMPLETED' ? new Date() : null
      },
      include: {
        exit_request: {
          include: {
            clearance_tasks: true
          }
        }
      }
    });

    // Check if all tasks for this request are completed to move to CLEARANCE phase
    const allTasks = await prisma.exitClearanceTask.findMany({
      where: { exit_request_id: updated.exit_request_id }
    });

    const allDone = allTasks.every(t => t.status === 'COMPLETED');
    if (allDone && updated.exit_request.status === EXIT_STATUS.OFFBOARDING) {
      await this.updateExitStatus(updated.exit_request_id.toString(), EXIT_STATUS.CLEARANCE, 1); // 1 as system actor
    }

    return updated;
  }

  async withdrawResignation(id: string, userId: number) {
    const exitRequestId = parseInt(id, 10);
    const request = await prisma.exitRequest.findUnique({
      where: { id: exitRequestId }
    });

    if (!request) throw new AppError('Request not found', 404);
    if (request.user_id !== userId) throw new AppError('Unauthorized', 403);
    if (![EXIT_STATUS.PENDING_ACCEPTANCE, EXIT_STATUS.NEGOTIATION_PENDING].includes(request.status)) {
      throw new AppError('Cannot withdraw resignation at this stage.', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.exitRequest.update({
        where: { id: exitRequestId },
        data: { status: 'WITHDRAWN' }
      });

      await tx.exitWorkflowHistory.create({
        data: {
          exit_request_id: exitRequestId,
          action: 'WITHDRAWN',
          comments: 'Employee withdrew the resignation request.',
          actor_id: userId
        }
      });

      return updated;
    });
  }

  async updateSettlement(exitRequestId: number | string, payload: any) {
    const id = typeof exitRequestId === 'string' ? parseInt(exitRequestId, 10) : exitRequestId;
    const { total_earnings, gratuity, leave_encashment, notice_pay, salaryAdvanceRecovery, loanRecovery, additionalDeductions } = payload;
    
    const calculatedNoticePay = Number(notice_pay || 0);
    const calculatedAdvance = Number(salaryAdvanceRecovery || 0);
    const calculatedLoan = Number(loanRecovery || 0);
    const calculatedAdd = Number(additionalDeductions || 0);
    
    const totalDeductions = (calculatedNoticePay < 0 ? Math.abs(calculatedNoticePay) : 0) + calculatedAdvance + calculatedLoan + calculatedAdd;
    const totalEarnings = Number(total_earnings || 0);
    const netPayable = totalEarnings - totalDeductions;
    
    const currentSettlement = await prisma.exitSettlement.findUnique({
      where: { exit_request_id: id }
    });
    
    const existingData = (currentSettlement?.data as any) || {};
    const updatedData = {
      ...existingData,
      salaryAdvanceRecovery: calculatedAdvance,
      loanRecovery: calculatedLoan,
      additionalDeductions: calculatedAdd
    };
    
    await prisma.exitSettlement.update({
      where: { exit_request_id: id },
      data: {
        total_earnings: totalEarnings,
        total_deductions: totalDeductions,
        net_payable: netPayable,
        gratuity: gratuity ? Number(gratuity) : undefined,
        leave_encashment: leave_encashment ? Number(leave_encashment) : undefined,
        notice_pay: notice_pay ? Number(notice_pay) : undefined,
        data: updatedData
      }
    });
    
    return prisma.exitRequest.findUnique({
      where: { id: id },
      include: {
        user: { include: { details: { include: { department: true, team: true, reporting_manager: { include: { details: true } }, loans: { where: { isActive: true } }, advances: { where: { isActive: true } } } } } },
        assets: true,
        documents: true,
        clearance_tasks: true,
        workflow_history: { include: { actor: { include: { details: true } } }, orderBy: { created_at: 'asc' } },
        interview_responses: true,
        settlement_data: true
      }
    });
  }

  async hrOverride(id: string, status: string, hrId: number, comments: string) {
    const exitRequestId = parseInt(id, 10);
    const request = await prisma.exitRequest.findUnique({
      where: { id: exitRequestId }
    });

    if (!request) throw new AppError('Request not found', 404);

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.exitRequest.update({
        where: { id: exitRequestId },
        data: { 
          status,
          is_hr_override: true,
          progress_percentage: status === EXIT_STATUS.RESIGNATION_ACCEPTED ? 25 : 0
        }
      });

      await tx.exitWorkflowHistory.create({
        data: {
          exit_request_id: exitRequestId,
          action: 'HR_OVERRIDE',
          comments: `HR Override Action: ${status}. Reason: ${comments}`,
          actor_id: hrId
        }
      });

      return updated;
    });
  }

  async updateExitRequest(id: string | number, data: any) {
    const exitRequestId = typeof id === 'string' ? parseInt(id, 10) : id;
    
    const updateData: any = {};
    if (data.exit_type !== undefined) updateData.exit_type = data.exit_type;
    if (data.notice_date !== undefined) updateData.notice_date = new Date(data.notice_date);
    if (data.last_working_day !== undefined) updateData.last_working_day = new Date(data.last_working_day);
    if (data.primary_reason !== undefined) updateData.primary_reason = data.primary_reason;
    if (data.explanation !== undefined) updateData.explanation = data.explanation;
    if (data.notice_waiver !== undefined) updateData.notice_waiver = data.notice_waiver;
    if (data.interview_pref !== undefined) updateData.interview_pref = data.interview_pref;
    if (data.handover_notes !== undefined) updateData.handover_notes = data.handover_notes;
    
    if (data.kt_status !== undefined) updateData.kt_status = data.kt_status;
    if (data.kt_assignee_id !== undefined) updateData.kt_assignee_id = data.kt_assignee_id ? Number(data.kt_assignee_id) : null;
    if (data.kt_description !== undefined) updateData.kt_description = data.kt_description;
    if (data.kt_completion_date !== undefined) updateData.kt_completion_date = data.kt_completion_date ? new Date(data.kt_completion_date) : null;
    if (data.kt_verified_by_id !== undefined) updateData.kt_verified_by_id = data.kt_verified_by_id ? Number(data.kt_verified_by_id) : null;
    if (data.kt_remarks !== undefined) updateData.kt_remarks = data.kt_remarks;

    // If KT is marked Completed, automatically update exit status & progress_percentage
    if (data.kt_status === 'Completed') {
      const currentReq = await prisma.exitRequest.findUnique({
        where: { id: exitRequestId },
        include: { assets: true }
      });
      if (currentReq && [EXIT_STATUS.PENDING_ACCEPTANCE, EXIT_STATUS.RESIGNATION_ACCEPTED, EXIT_STATUS.OFFBOARDING].includes(currentReq.status)) {
        const hasAssets = currentReq.assets && currentReq.assets.length > 0;
        const nextStatus = hasAssets ? EXIT_STATUS.ASSET_HANDOVER : EXIT_STATUS.IT_CLEARANCE;
        updateData.status = nextStatus;
        updateData.progress_percentage = nextStatus === EXIT_STATUS.ASSET_HANDOVER ? 45 : 60;
      }
    }

    const updatedResult = await prisma.$transaction(async (tx) => {
      await tx.exitRequest.update({
        where: { id: exitRequestId },
        data: updateData
      });

      if (data.assets) {
        await tx.exitAsset.deleteMany({
          where: { exit_request_id: exitRequestId }
        });

        if (data.assets.length > 0) {
          await tx.exitAsset.createMany({
            data: data.assets.map((asset: any) => ({
              exit_request_id: exitRequestId,
              asset_name: asset.name || asset.asset_name,
              asset_serial_no: asset.id || asset.asset_serial_no,
              category: asset.category,
              asset_id: asset.asset_id,
              assignment_id: asset.assignment_id,
              return_status: asset.return_status ?? false,
              return_date: asset.return_date ? new Date(asset.return_date) : null,
              condition: asset.condition || null
            }))
          });
        }
      }

      return await tx.exitRequest.findUnique({
        where: { id: exitRequestId },
        include: {
          user: {
            include: {
              details: true
            }
          },
          kt_assignee: {
            include: {
              details: true
            }
          },
          kt_verified_by: {
            include: {
              details: true
            }
          },
          assets: true
        }
      });
    });

    if (updateData.kt_assignee_id) {
      try {
        const exitingUserName = updatedResult?.user?.details ? `${updatedResult.user.details.first_name} ${updatedResult.user.details.last_name}` : (updatedResult?.user?.username || 'an employee');
        const notif = await notificationService.create({
          user_id: updateData.kt_assignee_id,
          title: 'Knowledge Transfer (KT) Assigned',
          message: `You have been assigned Knowledge Transfer (KT) handover responsibilities for ${exitingUserName}.`,
          type: 'EXIT_MANAGEMENT'
        });
        webSocketService.sendNotification(updateData.kt_assignee_id, 'notification', notif);
      } catch (notifError) {
        console.error('Failed to dispatch KT assignee notification:', notifError);
      }
    }

    // Notify Exiting Employee of KT updates
    if (updatedResult && (updateData.kt_assignee_id || updateData.kt_status || updateData.kt_description || updateData.kt_completion_date)) {
      try {
        const assigneeName = updatedResult.kt_assignee?.details
          ? `${updatedResult.kt_assignee.details.first_name} ${updatedResult.kt_assignee.details.last_name}`.trim()
          : (updatedResult.kt_assignee?.username || 'N/A');

        let message = `Your Knowledge Transfer (KT) details have been updated.`;
        if (updateData.kt_assignee_id) {
          message = `Your Knowledge Transfer (KT) has been assigned to ${assigneeName}.`;
        } else if (updateData.kt_status === 'Completed') {
          message = `Your Knowledge Transfer (KT) has been completed and verified.`;
        }

        const empNotif = await notificationService.create({
          user_id: updatedResult.user_id,
          title: 'KT Process Update',
          message: message,
          type: 'exit',
          metadata: {
            exit_id: updatedResult.id,
            status: updatedResult.status
          },
          related_module: 'exit',
          related_id: updatedResult.id
        });
        webSocketService.sendNotification(updatedResult.user_id, 'notification', empNotif);
      } catch (empNotifError) {
        console.error('Failed to dispatch employee KT update notification:', empNotifError);
      }
    }

    // Notify HR / Admins for Clearance & Approvals
    if (updatedResult && ['ASSET_HANDOVER', 'IT_CLEARANCE', 'CLEARANCE'].includes(updatedResult.status) && (updateData.status || updateData.kt_status === 'Completed')) {
      try {
        const employeeName = `${updatedResult.user?.details?.first_name || ''} ${updatedResult.user?.details?.last_name || ''}`.trim() || updatedResult.user?.username || 'Employee';
        const hrUsers = await prisma.user.findMany({
          where: {
            is_deleted: false,
            OR: [
              { roles: { some: { role: { role_name: { in: ['HR', 'ADMIN', 'SUPER ADMIN', 'CEO', 'SYSTEM ADMINISTRATOR', 'hr', 'admin', 'super admin', 'ceo', 'system administrator', 'HR_ADMIN', 'SUPER_ADMIN'] } } } } },
              { details: { role: { role_name: { in: ['HR', 'ADMIN', 'SUPER ADMIN', 'CEO', 'SYSTEM ADMINISTRATOR', 'hr', 'admin', 'super admin', 'ceo', 'system administrator', 'HR_ADMIN', 'SUPER_ADMIN'] } } } }
            ]
          },
          select: { id: true }
        });

        for (const hr of hrUsers) {
          const hrNotif = await notificationService.create({
            user_id: hr.id,
            title: 'Action Required: Clearance Pending',
            message: `KT phase completed for ${employeeName}. Please work on employee clearance.`,
            type: 'exit',
            metadata: {
              exit_id: updatedResult.id,
              employee_name: employeeName,
              status: updatedResult.status
            },
            related_module: 'exit',
            related_id: updatedResult.id
          });
          webSocketService.sendNotification(hr.id, 'notification', hrNotif);
        }
      } catch (hrNotifError) {
        console.error('Failed to notify HR team of clearance:', hrNotifError);
      }
    }

    return updatedResult;
  }
}

export const exitService = new ExitService();
