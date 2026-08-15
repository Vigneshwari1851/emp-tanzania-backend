import prisma from '../../shared/prisma/client';
import { AppError } from '../../middlewares/error.middleware';
import { Prisma } from '@prisma/client';
import { webSocketService } from './websocket.service';

export class NotificationService {
    // 1. Create a Notification (Internal/System use)
    async create(data: { user_id: number; title: string; message: string; type?: string; metadata?: any; related_module?: string; related_id?: number }) {
        const notification = await prisma.notification.create({
            data: {
                user_id: data.user_id,
                title: data.title,
                message: data.message,
                type: data.type || 'INFO',
                metadata: data.metadata || null,
                related_module: data.related_module || null,
                related_id: data.related_id || null,
            } as any
        });
        
        // Push notification via WebSocket
        webSocketService.sendNotification(data.user_id, 'notification', notification);
        
        return notification;
    }

    async getMyNotifications(userId: number, options: { page?: number; limit?: number; unreadOnly?: boolean } = {}) {
        // Auto-sync missing Tax Declaration notifications for HR / Finance / Admin users
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: {
                    roles: { include: { role: true } },
                    details: { include: { role: true } }
                }
            });

            if (user) {
                const roleNames = [
                    (user as any).role || '',
                    user.details?.role?.role_name || '',
                    ...(user.roles || []).map(r => r.role?.role_name || (r as any).role_name || '')
                ].join(' ').toUpperCase();

                const isHR = roleNames.includes('HR') || roleNames.includes('HUMAN') || roleNames.includes('ADMIN') || roleNames.includes('SUPER');
                const isFinance = roleNames.includes('FINANCE') || roleNames.includes('PAYROLL') || roleNames.includes('ACCOUNT') || roleNames.includes('ADMIN') || roleNames.includes('SUPER');
                
                // Find direct reportees for manager matching
                const directReports = await prisma.userDetail.findMany({
                    where: { reporting_manager_id: userId },
                    select: { user_id: true }
                });
                const directReportIds = new Set(directReports.map(d => d.user_id));
                const isManager = roleNames.includes('MANAGER') || roleNames.includes('LEAD') || roleNames.includes('HEAD') || directReportIds.size > 0;

                // ── 1. Auto-sync Tax Declarations ──
                const pendingTaxStatuses: string[] = [];
                if (isManager || isHR) pendingTaxStatuses.push('Pending Manager Approval', 'Pending HR Approval', 'Pending');
                if (isFinance) pendingTaxStatuses.push('Pending Finance Approval');

                if (pendingTaxStatuses.length > 0) {
                    const pendingDecls = await prisma.taxDeclaration.findMany({
                        where: { status: { in: pendingTaxStatuses } },
                        include: {
                            user: {
                                include: {
                                    details: { select: { first_name: true, last_name: true, reporting_manager_id: true } }
                                }
                            }
                        }
                    });

                    for (const decl of pendingDecls) {
                        if (decl.user_id === userId) continue;
                        const isDirectManager = decl.user?.details?.reporting_manager_id === userId || directReportIds.has(decl.user_id);
                        if (isDirectManager || isHR || isFinance) {
                            const existing = await prisma.notification.findFirst({
                                where: {
                                    user_id: userId,
                                    related_module: 'tax_declaration',
                                    related_id: decl.id
                                }
                            });

                            if (!existing) {
                                const empName = decl.user?.details ? `${decl.user.details.first_name || ''} ${decl.user.details.last_name || ''}`.trim() : decl.user?.username || 'Employee';
                                await prisma.notification.create({
                                    data: {
                                        user_id: userId,
                                        title: `📜 Tax Declaration - ${decl.status}`,
                                        message: `${empName} submitted a Tax Declaration for Section ${decl.section} (₹${decl.amount}) for FY ${decl.financial_year}. Status: ${decl.status}.`,
                                        type: 'TAX_DECLARATION',
                                        related_module: 'tax_declaration',
                                        related_id: decl.id,
                                        is_read: false
                                    } as any
                                });
                            }
                        }
                    }
                }

                // ── 2. Auto-sync Reimbursements ──
                const claimStatuses: string[] = [];
                if (isManager) claimStatuses.push('Submitted', 'Pending Manager Approval', 'Pending', 'submitted');
                if (isHR) claimStatuses.push('pending_hr', 'Pending HR Approval', 'waiting_hr', 'Waiting HR Approval');
                if (isFinance) claimStatuses.push('pending_finance', 'Pending Finance Approval', 'waiting_payout', 'Ready To Pay', 'approved');

                if (claimStatuses.length > 0) {
                    const pendingClaims = await prisma.expenseClaim.findMany({
                        where: { status: { in: claimStatuses } },
                        include: {
                            user: {
                                include: {
                                    details: { select: { first_name: true, last_name: true, reporting_manager_id: true } }
                                }
                            }
                        }
                    });

                    for (const claim of pendingClaims) {
                        if (claim.user_id === userId) continue;
                        const isDirectManager = claim.user?.details?.reporting_manager_id === userId || directReportIds.has(claim.user_id);
                        if (isDirectManager || isHR || isFinance) {
                            const existing = await prisma.notification.findFirst({
                                where: {
                                    user_id: userId,
                                    related_module: 'reimbursement',
                                    related_id: claim.id
                                }
                            });

                            if (!existing) {
                                const empName = claim.user?.details ? `${claim.user.details.first_name || ''} ${claim.user.details.last_name || ''}`.trim() : claim.user?.username || 'Employee';
                                await prisma.notification.create({
                                    data: {
                                        user_id: userId,
                                        title: `🧾 Reimbursement Claim - ${claim.status}`,
                                        message: `${empName} submitted a reimbursement claim for ${claim.type} (₹${Number(claim.amount).toLocaleString()}). Status: ${claim.status}.`,
                                        type: 'REIMBURSEMENT',
                                        related_module: 'reimbursement',
                                        related_id: claim.id,
                                        metadata: { claimId: claim.id, amount: claim.amount, type: claim.type },
                                        is_read: false
                                    } as any
                                });
                            }
                        }
                    }
                }

                // ── 3. Auto-sync Loans & Advances ──
                try {
                    // 3a. Loan Applications (loanApplication)
                    const loanStatuses = ['SUBMITTED', 'PENDING_STEP_1', 'PENDING_STEP_2', 'PENDING_STEP_3', 'PENDING'];
                    const pendingLoans = await prisma.loanApplication.findMany({
                        where: {
                            status: { in: loanStatuses },
                            isActive: true
                        },
                        include: {
                            loanType: true,
                            userDetail: {
                                include: { user: true }
                            }
                        }
                    });

                    for (const loan of pendingLoans) {
                        if (loan.userDetail?.user_id === userId) continue;
                        const isDirectManager = loan.userDetail?.reporting_manager_id === userId || (loan.userDetail?.user_id && directReportIds.has(loan.userDetail.user_id));
                        
                        let workflowSteps = [];
                        if (loan.workflowSnapshot) {
                            try {
                                workflowSteps = JSON.parse(loan.workflowSnapshot);
                            } catch (e) {
                                workflowSteps = (loan.loanType as any)?.approvalWorkflow || [];
                            }
                        } else {
                            workflowSteps = (loan.loanType as any)?.approvalWorkflow || [];
                        }

                        const currentStepWorkflow = workflowSteps.find((s: any) => s.stepOrder === loan.currentStep);
                        if (!currentStepWorkflow) continue;

                        const stepRole = currentStepWorkflow.roleName.toUpperCase();
                        let shouldNotify = false;

                        if (stepRole === 'MANAGER' || stepRole === 'REPORTING MANAGER') {
                            shouldNotify = isDirectManager;
                        } else if (stepRole === 'HR' || stepRole === 'HR MANAGER' || stepRole === 'HR_MANAGER' || stepRole.includes('HR')) {
                            shouldNotify = isHR;
                        } else if (stepRole === 'FINANCE' || stepRole === 'FINANCE MANAGER' || stepRole === 'FINANCE_MANAGER' || stepRole.includes('FINANCE') || stepRole.includes('DISBURSAL')) {
                            shouldNotify = isFinance;
                        } else {
                            shouldNotify = roleNames.includes(stepRole.toUpperCase());
                        }

                        if (shouldNotify) {
                            const existing = await prisma.notification.findFirst({
                                where: {
                                    user_id: userId,
                                    related_module: 'loans-advances',
                                    related_id: loan.id
                                }
                            });

                            if (!existing) {
                                const empName = loan.userDetail ? `${loan.userDetail.first_name || ''} ${loan.userDetail.last_name || ''}`.trim() : 'Employee';
                                await prisma.notification.create({
                                    data: {
                                        user_id: userId,
                                        title: `💰 Loan Application - ${loan.loanType?.name || 'Loan'}`,
                                        message: `${empName} submitted a ${loan.loanType?.name || 'Loan'} application (${loan.applicationNumber} - ₹${Number(loan.requestedAmount).toLocaleString()}). Status: ${loan.status}.`,
                                        type: 'LOANS_ADVANCES',
                                        related_module: 'loans-advances',
                                        related_id: loan.id,
                                        metadata: { loanId: loan.id, amount: loan.requestedAmount, type: loan.loanType?.name },
                                        is_read: false
                                    } as any
                                });
                            }
                        }
                    }

                    // 3b. Direct Loans (loan)
                    const directPendingStatuses = ['PENDING_MANAGER', 'PENDING_HR', 'PENDING_FINANCE'];
                    const pendingDirectLoans = await prisma.loan.findMany({
                        where: {
                            status: { in: directPendingStatuses },
                            isActive: true
                        },
                        include: {
                            userDetail: { include: { user: true } }
                        }
                    });

                    for (const loan of pendingDirectLoans) {
                        if (loan.userDetail?.user_id === userId) continue;
                        const isDirectManager = loan.reporting_manager_id === userId || loan.userDetail?.reporting_manager_id === userId || (loan.userDetail?.user_id && directReportIds.has(loan.userDetail.user_id));
                        const shouldNotify = 
                            (loan.status === 'PENDING_MANAGER' && (isDirectManager || isHR || isManager)) ||
                            (loan.status === 'PENDING_HR' && isHR) ||
                            (loan.status === 'PENDING_FINANCE' && isFinance);

                        if (shouldNotify) {
                            const existing = await prisma.notification.findFirst({
                                where: {
                                    user_id: userId,
                                    related_module: 'loans-advances',
                                    related_id: loan.id
                                }
                            });

                            if (!existing) {
                                const empName = loan.userDetail ? `${loan.userDetail.first_name || ''} ${loan.userDetail.last_name || ''}`.trim() : 'Employee';
                                await prisma.notification.create({
                                    data: {
                                        user_id: userId,
                                        title: `💰 New Loan Request`,
                                        message: `${empName} requested a loan of ₹${Number(loan.principalAmount).toLocaleString()}. Status: ${loan.status}.`,
                                        type: 'LOANS_ADVANCES',
                                        related_module: 'loans-advances',
                                        related_id: loan.id,
                                        metadata: { loanId: loan.id, amount: loan.principalAmount, status: loan.status },
                                        is_read: false
                                    } as any
                                });
                            }
                        }
                    }

                    // 3c. Direct Advances (advance)
                    const pendingDirectAdvances = await prisma.advance.findMany({
                        where: {
                            status: { in: directPendingStatuses },
                            isActive: true
                        },
                        include: {
                            userDetail: { include: { user: true } }
                        }
                    });

                    for (const adv of pendingDirectAdvances) {
                        if (adv.userDetail?.user_id === userId) continue;
                        const isDirectManager = adv.reporting_manager_id === userId || adv.userDetail?.reporting_manager_id === userId || (adv.userDetail?.user_id && directReportIds.has(adv.userDetail.user_id));
                        const shouldNotify = 
                            (adv.status === 'PENDING_MANAGER' && (isDirectManager || isHR || isManager)) ||
                            (adv.status === 'PENDING_HR' && isHR) ||
                            (adv.status === 'PENDING_FINANCE' && isFinance);

                        if (shouldNotify) {
                            const existing = await prisma.notification.findFirst({
                                where: {
                                    user_id: userId,
                                    related_module: 'loans-advances',
                                    related_id: adv.id
                                }
                            });

                            if (!existing) {
                                const empName = adv.userDetail ? `${adv.userDetail.first_name || ''} ${adv.userDetail.last_name || ''}`.trim() : 'Employee';
                                await prisma.notification.create({
                                    data: {
                                        user_id: userId,
                                        title: `💵 New Salary Advance Request`,
                                        message: `${empName} requested a salary advance of ₹${Number(adv.principalAmount).toLocaleString()}. Status: ${adv.status}.`,
                                        type: 'LOANS_ADVANCES',
                                        related_module: 'loans-advances',
                                        related_id: adv.id,
                                        metadata: { advanceId: adv.id, amount: adv.principalAmount, status: adv.status },
                                        is_read: false
                                    } as any
                                });
                            }
                        }
                    }
                } catch (loanSyncErr) {
                    console.error('Loans & Advances notification sync error:', loanSyncErr);
                }

                // ── 4. Auto-sync Exit / Resignation Requests ──
                try {
                    const pendingExitRequests = await prisma.exitRequest.findMany({
                        where: {
                            status: { in: ['PENDING_ACCEPTANCE', 'NEGOTIATION_PENDING', 'RESIGNATION_ACCEPTED', 'OFFBOARDING'] }
                        },
                        include: {
                            user: {
                                include: {
                                    details: { select: { first_name: true, last_name: true, reporting_manager_id: true } }
                                }
                            }
                        }
                    });

                    for (const exitReq of pendingExitRequests) {
                        if (exitReq.user_id === userId) continue;

                        const isDirectManager = exitReq.reporting_manager_id === userId 
                            || exitReq.user?.details?.reporting_manager_id === userId 
                            || directReportIds.has(exitReq.user_id);

                        if (isDirectManager || isHR) {
                            const existing = await prisma.notification.findFirst({
                                where: {
                                    user_id: userId,
                                    related_module: 'exit',
                                    related_id: exitReq.id
                                }
                            });

                            if (!existing) {
                                const empName = exitReq.user?.details 
                                    ? `${exitReq.user.details.first_name || ''} ${exitReq.user.details.last_name || ''}`.trim() 
                                    : exitReq.user?.username || 'An employee';

                                await prisma.notification.create({
                                    data: {
                                        user_id: userId,
                                        title: isDirectManager ? 'New Exit Request' : 'New Resignation Submitted',
                                        message: isDirectManager 
                                            ? `An exit request has been initiated by ${empName}. Approval is required within 3 days.`
                                            : `${empName} has submitted their resignation.`,
                                        type: 'exit',
                                        related_module: 'exit',
                                        related_id: exitReq.id,
                                        metadata: {
                                            exit_id: exitReq.id,
                                            employee_name: empName,
                                            exit_type: exitReq.exit_type,
                                            last_working_day: exitReq.last_working_day,
                                            status: exitReq.status
                                        },
                                        is_read: false
                                    } as any
                                });
                            }
                        }
                    }
                } catch (exitSyncErr) {
                    console.error('Exit notification sync error:', exitSyncErr);
                }
            }
        } catch (syncErr) {
            console.error('Notification auto-sync error:', syncErr);
        }

        const page = options.page || 1;
        const limit = options.limit || 10;
        const skip = (page - 1) * limit;

        const where: Prisma.NotificationWhereInput = {
            user_id: userId,
        };

        if (options.unreadOnly) {
            where.is_read = false;
        }

        const [total, notifications] = await Promise.all([
            prisma.notification.count({ where }),
            prisma.notification.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
            }),
        ]);

        // Enrich Leave Notifications with dynamic status if missing or to ensure accuracy
        const leaveRequestsIds = notifications
            .filter(n => n.related_module === 'leave' && n.related_id)
            .map(n => n.related_id as number);

        if (leaveRequestsIds.length > 0) {
            const leaveRequests = await prisma.leaveRequest.findMany({
                where: { id: { in: leaveRequestsIds } },
                select: { id: true, status: true }
            });

            const statusMap = new Map(leaveRequests.map(lr => [lr.id, lr.status]));

            notifications.forEach(n => {
                if (n.related_module === 'leave' && n.related_id) {
                    const currentStatus = statusMap.get(n.related_id);
                    if (currentStatus) {
                        n.metadata = {
                            ...(n.metadata as any || {}),
                            status: currentStatus
                        };
                    }
                }
            });
        }

        return {
            total,
            page,
            limit,
            total_pages: Math.ceil(total / limit),
            data: notifications,
        };
    }

    async getUnreadCount(userId: number) {
        const count = await prisma.notification.count({
            where: {
                user_id: userId,
                is_read: false
            }
        });
        return { count };
    }

    async markAsRead(notificationId: number, userId: number) {
        const notification = await prisma.notification.findFirst({
            where: { id: notificationId, user_id: userId },
        });

        if (!notification) {
            throw new AppError('Notification not found', 404);
        }

        if (notification.is_read) {
            return notification; 
        }

        return await prisma.notification.update({
            where: { id: notificationId },
            data: {
                is_read: true,
                read_at: new Date(),
            }
        });
    }

    async markAllAsRead(userId: number) {
        const result = await prisma.notification.updateMany({
            where: {
                user_id: userId,
                is_read: false,
            },
            data: {
                is_read: true,
                read_at: new Date(),
            }
        });

        return { message: `${result.count} notifications marked as read` };
    }

    async updateMetadata(notificationId: number, userId: number, metadata: any) {
        const notification = await prisma.notification.findFirst({
            where: { id: notificationId, user_id: userId },
        });

        if (!notification) {
            throw new AppError('Notification not found', 404);
        }

        // Merge existing metadata with new metadata
        const updatedMetadata = {
            ...(notification.metadata as any || {}),
            ...metadata
        };

        return await prisma.notification.update({
            where: { id: notificationId },
            data: {
                metadata: updatedMetadata
            }
        });
    }

    async delete(notificationId: number, userId: number) {
        const notification = await prisma.notification.findFirst({
            where: { id: notificationId, user_id: userId },
        });

        if (!notification) {
            throw new AppError('Notification not found', 404);
        }

        await prisma.notification.delete({
            where: { id: notificationId }
        });

        return { message: 'Notification deleted successfully' };
    }

    async sendWish(senderId: number, recipientId: number, type: 'birthday' | 'anniversary') {
        const sender = await prisma.userDetail.findUnique({
            where: { user_id: senderId },
            select: { first_name: true, last_name: true }
        });

        const senderName = sender
            ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim()
            : 'A colleague';

        const title = type === 'birthday' ? '🎂 Birthday Wish!' : '🎉 Work Anniversary Wish!';
        const message = type === 'birthday'
            ? `${senderName} wished you a happy birthday! 🎂`
            : `${senderName} congratulated you on your work anniversary! 🎉`;

        const notification = await prisma.notification.create({
            data: {
                user_id: recipientId,
                title,
                message,
                type: 'WISH',
                metadata: { sender_id: senderId, wish_type: type },
                related_module: 'wish',
            } as any
        });

        webSocketService.sendNotification(recipientId, 'notification', notification);

        return notification;
    }
}

export const notificationService = new NotificationService();
