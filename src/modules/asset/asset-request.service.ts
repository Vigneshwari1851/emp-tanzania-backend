import prisma from '../../config/prisma';
import { notificationService } from '../notifications/notification.service';

export class AssetRequestService {
  async createRequest(data: {
    organizationId: number;
    userId: number;
    assetCategoryId?: number;
    specificAssetId?: number;
    requestType: string;
    subCategory?: string;
    reason?: string;
    priority?: string;
  }) {
    const request = await prisma.assetRequest.create({
      data: {
        organization_id: data.organizationId,
        user_id: data.userId,
        asset_category_id: data.assetCategoryId,
        specific_asset_id: data.specificAssetId,
        request_type: data.requestType,
        sub_category: data.subCategory,
        reason: data.reason,
        priority: data.priority || 'MEDIUM',
        status: 'PENDING'
      }
    });

    // Notify admins
    const admins = await prisma.user.findMany({
      where: {
        roles: { some: { role: { role_name: { in: ['super admin', 'admin', 'ceo', 'CEO', 'System Administrator', 'SYSTEM ADMINISTRATOR'] } } } },
        status: true
      }
    });

    for (const admin of admins) {
      await notificationService.create({
        user_id: admin.id,
        title: 'New Asset Request',
        message: `A new asset request (${data.requestType}) has been submitted.`,
        type: 'INFO'
      });
    }
    return request;
  }

  async getRequests(filters: { organizationId: number; userId?: number; status?: string }) {
    const where: any = { organization_id: filters.organizationId };
    if (filters.userId) where.user_id = filters.userId;
    if (filters.status) where.status = filters.status;

    return prisma.assetRequest.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, email: true, details: { select: { first_name: true, last_name: true } } } },
        asset_category: true,
        specific_asset: true,
        assigned_asset: true,
        approver: { select: { id: true, details: { select: { first_name: true, last_name: true } } } }
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async processRequest(
    id: number,
    organizationId: number,
    adminId: number,
    action: 'APPROVE' | 'REJECT' | 'FULFILL',
    notes?: string,
    assignedAssetId?: number
  ) {
    const request = await prisma.assetRequest.findFirst({
      where: { id, organization_id: organizationId },
      include: { specific_asset: true, user: { include: { details: true } } }
    });

    if (!request) throw new Error('Asset request not found');

    if (action === 'REJECT') {
      await prisma.assetRequest.update({
        where: { id },
        data: { status: 'REJECTED', approved_by: adminId, notes }
      });
      await notificationService.create({
        user_id: request.user_id,
        title: 'Asset Request Rejected',
        message: `Your asset request has been rejected. Notes: ${notes || 'None'}`,
        type: 'ALERT'
      });
      return { success: true, message: 'Request rejected' };
    }

    if (action === 'APPROVE') {
      // Just mark as approved but not yet fulfilled
      await prisma.assetRequest.update({
        where: { id },
        data: { status: 'APPROVED', approved_by: adminId, notes }
      });
      await notificationService.create({
        user_id: request.user_id,
        title: 'Asset Request Approved',
        message: `Your asset request has been approved and is waiting for fulfillment. Notes: ${notes || 'None'}`,
        type: 'SUCCESS'
      });
      return { success: true, message: 'Request approved. Waiting for fulfillment.' };
    }

    if (action === 'FULFILL') {
      if (!assignedAssetId) throw new Error('An asset must be selected to fulfill the request');

      const assetToAssign = await prisma.asset.findFirst({
        where: { id: assignedAssetId, organization_id: organizationId, status: 'AVAILABLE' }
      });

      if (!assetToAssign) throw new Error('Selected asset is not available');

      await prisma.$transaction(async (tx) => {
        // Mark request as fulfilled
        await tx.assetRequest.update({
          where: { id },
          data: { status: 'FULFILLED', approved_by: adminId, notes, assigned_asset_id: assignedAssetId }
        });

        // Create assignment
        await tx.assetAssignment.create({
          data: {
            organization_id: organizationId,
            asset_id: assignedAssetId,
            user_id: request.user_id,
            status: 'ACTIVE'
          }
        });

        // Update new asset status
        await tx.asset.update({
          where: { id: assignedAssetId },
          data: { status: 'ASSIGNED' }
        });

        const employeeName = request.user?.details ? `${request.user.details.first_name} ${request.user.details.last_name}` : request.user.email;

        // Log history for new asset
        await tx.assetHistory.create({
          data: {
            organization_id: organizationId,
            asset_id: assignedAssetId,
            action_type: 'ASSIGN',
            field_changed: 'status',
            old_value: 'AVAILABLE',
            new_value: `Assigned to ${employeeName} (Request Fulfill)`,
            changed_by_id: adminId
          }
        });

        // If replacement or repair, handle old asset
        if (request.specific_asset_id && (request.request_type === 'REPLACEMENT' || request.request_type === 'REPAIR')) {
          const newStatus = request.request_type === 'REPAIR' ? 'MAINTENANCE' : 'RETURNED';
          
          await tx.asset.update({
            where: { id: request.specific_asset_id },
            data: { status: newStatus }
          });

          // End old assignment if exists
          const activeAssignment = await tx.assetAssignment.findFirst({
            where: { asset_id: request.specific_asset_id, user_id: request.user_id, status: 'ACTIVE' }
          });
          if (activeAssignment) {
            await tx.assetAssignment.update({
              where: { id: activeAssignment.id },
              data: { status: 'RETURNED', return_date: new Date() }
            });
          }

          await tx.assetHistory.create({
            data: {
              organization_id: organizationId,
              asset_id: request.specific_asset_id,
              action_type: request.request_type === 'REPAIR' ? 'MAINTENANCE' : 'UNASSIGN',
              field_changed: 'status',
              old_value: 'ASSIGNED',
              new_value: `Replaced by ${assetToAssign.name} (${assetToAssign.asset_code || assetToAssign.serial_number})`,
              changed_by_id: adminId
            }
          });
        }
      });

      await notificationService.create({
        user_id: request.user_id,
        title: 'Asset Request Fulfilled',
        message: `Your asset request has been fulfilled with ${assetToAssign.name} (${assetToAssign.asset_code || assetToAssign.serial_number}).`,
        type: 'INFO'
      });

      return { success: true, message: 'Request fulfilled and asset assigned' };
    }

    throw new Error('Invalid action');
  }
}
