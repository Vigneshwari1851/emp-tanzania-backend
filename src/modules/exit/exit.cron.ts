import cron from 'node-cron';
import prisma from '../../shared/prisma/client';
import { EXIT_STATUS } from './exit.service';
import { notificationService } from '../notifications/notification.service';
import { webSocketService } from '../notifications/websocket.service';

/**
 * Background task to check for SLA breaches and trigger escalations
 * Runs every day at 12:00 AM
 */
export const initExitCron = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Checking for offboarding SLA breaches...');
    
    try {
      const now = new Date();

      // 1. Check for Manager Approval SLA breaches
      const overdueApprovals = await prisma.exitRequest.findMany({
        where: {
          status: { in: [EXIT_STATUS.PENDING_ACCEPTANCE, EXIT_STATUS.NEGOTIATION_PENDING] },
          sla_deadline: { lt: now },
          is_hr_override: false
        },
        include: {
          user: { include: { details: true } },
          reporting_manager: { include: { details: true } }
        }
      });

      for (const request of overdueApprovals) {
        const employeeName = `${request.user.details?.first_name} ${request.user.details?.last_name}`;
        
        // Notify HR
        const hrUsers = await prisma.user.findMany({
          where: { 
            roles: { 
              some: { 
                role: { 
                  role_name: { in: ['HR', 'ADMIN', 'SUPER ADMIN', 'CEO', 'SYSTEM ADMINISTRATOR', 'hr', 'admin', 'super admin', 'ceo', 'system administrator'] } 
                } 
              } 
            } 
          }
        });

        for (const hr of hrUsers) {
          const notification = await notificationService.create({
            user_id: hr.id,
            title: 'SLA Breach: Resignation Pending',
            message: `Resignation for ${employeeName} is overdue for manager approval. SLA deadline was ${request.sla_deadline?.toLocaleDateString()}.`,
            type: 'exit_alert',
            metadata: {
              exit_id: request.id,
              employee_name: employeeName,
              breach_type: 'MANAGER_APPROVAL'
            },
            related_module: 'exit',
            related_id: request.id
          });
          webSocketService.sendNotification(hr.id, 'exit_sla_breach', notification);
        }
      }

      // 2. Check for Clearance Task SLA breaches
      const overdueTasks = await prisma.exitClearanceTask.findMany({
        where: {
          status: 'PENDING',
          sla_deadline: { lt: now }
        },
        include: {
          exit_request: { include: { user: { include: { details: true } } } }
        }
      });

      for (const task of overdueTasks) {
        const employeeName = `${task.exit_request.user.details?.first_name} ${task.exit_request.user.details?.last_name}`;
        
        // Notify HR and Department
        const notification = await notificationService.create({
          user_id: task.exit_request.user_id, // Also notify employee (optional, maybe not)
          title: 'SLA Breach: Clearance Task',
          message: `Clearance task "${task.task_name}" for ${employeeName} is overdue.`,
          type: 'exit_alert',
          metadata: {
            exit_id: task.exit_request_id,
            task_id: task.id,
            department: task.department
          },
          related_module: 'exit',
          related_id: task.exit_request_id
        });

        // Actually notify HR team for bottlenecks
        const hrUsers = await prisma.user.findMany({
          where: {
            OR: [
              { roles: { some: { role: { role_name: { in: ['HR', 'hr', 'CEO', 'SYSTEM ADMINISTRATOR', 'System Administrator', 'SUPER ADMIN', 'super admin'] } } } } },
              { details: { department: { department_name: { in: ['HR', 'Human Resources'] } } } }
            ]
          }
        });

        for (const hr of hrUsers) {
          webSocketService.sendNotification(hr.id, 'exit_task_sla_breach', notification);
        }
      }

    } catch (error) {
      console.error('[Cron Error] Exit SLA check failed:', error);
    }
  });
};
