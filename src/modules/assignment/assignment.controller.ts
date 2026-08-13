import { Response } from 'express';
import prisma from '../../config/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { notificationService } from '../notifications/notification.service';

export const getAssignments = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.orgId || 1;



  try {
    const assignments = await prisma.assetAssignment.findMany({
      include: {
        asset: { 
          include: { 
            category: { select: { name: true } } 
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            details: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });
    res.json({ success: true, data: assignments });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
};

export const assignAsset = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.orgId || 1;
  // Fallback to legacy single assetId for backwards compatibility, but prefer assetIds array
  const { assetId, assetIds: requestedAssetIds, userId, issueDate, returnDate } = req.body;

  const assetIds: number[] = requestedAssetIds || (assetId ? [assetId] : []);

  if (!assetIds.length) {
    return res.status(400).json({ error: 'No assets provided for assignment' });
  }

  try {
    const assets = await prisma.asset.findMany({ 
      where: { id: { in: assetIds }, organization_id: tenantId } 
    });

    if (assets.length !== assetIds.length) {
      return res.status(400).json({ error: 'One or more assets not found' });
    }

    const unavailableAssets = assets.filter(a => a.status !== 'AVAILABLE');
    if (unavailableAssets.length > 0) {
      return res.status(400).json({ 
        error: `Assets are not available for assignment: ${unavailableAssets.map(a => a.name).join(', ')}` 
      });
    }

    const employee = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      include: { details: true }
    });
    const employeeName = employee?.details
      ? `${employee.details.first_name || ''} ${employee.details.last_name || ''}`.trim()
      : employee?.username || `ID: ${userId}`;

    const newAssignments = await prisma.$transaction(async (tx) => {
      const assignments = [];
      
      for (const asset of assets) {
        const newAssignment = await tx.assetAssignment.create({
          data: {
            organization_id: tenantId,
            asset_id: asset.id,
            user_id: parseInt(userId),
            issue_date: new Date(issueDate),
            expected_return: returnDate ? new Date(returnDate) : null,
            status: 'ACTIVE'
          }
        });

        await tx.asset.update({
          where: { id: asset.id },
          data: { status: 'ASSIGNED' }
        });

        // Log assignment history
        await tx.assetHistory.create({
          data: {
            organization_id: tenantId,
            asset_id: asset.id,
            action_type: 'ASSIGN',
            field_changed: 'status',
            old_value: 'AVAILABLE',
            new_value: `Assigned to ${employeeName}`,
            changed_by_id: req.user?.id
          }
        });
        
        assignments.push(newAssignment);
      }
      return assignments;
    });

    // Create system notifications
    for (const asset of assets) {
      try {
        await notificationService.create({
          user_id: parseInt(userId),
          title: 'Asset Assigned',
          message: `An asset "${asset.name}" (${asset.serial_number || 'N/A'}) has been assigned to you.`,
          type: 'INFO',
          related_module: 'asset',
          related_id: asset.id
        });
      } catch (err) {
        console.error('Error creating notification:', err);
      }
    }

    res.json({ success: true, data: newAssignments });
  } catch (error) {
    console.error('Error assigning assets:', error);
    res.status(500).json({ error: 'Failed to assign assets' });
  }
};

export const returnAsset = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.orgId || 1;
  const { id } = req.params; // assetId
  const { remarks } = req.body;

  try {
    const assignment = await prisma.assetAssignment.findFirst({
      where: { 
        asset_id: parseInt(id as string), 
        organization_id: tenantId, 
        status: { in: ['ACTIVE', 'RETURN_REQUESTED', 'RETURN_ACCEPTED'] }
      },
      orderBy: { issue_date: 'desc' },
      include: { 
        asset: true,
        user: {
          include: { details: true }
        }
      }
    });

    if (!assignment) {
      // Self-healing: Check if the asset exists and is marked as ASSIGNED.
      // If so, heal the inconsistency by resetting it to AVAILABLE.
      const asset = await prisma.asset.findFirst({
        where: { id: parseInt(id as string), organization_id: tenantId }
      });
      if (asset && asset.status === 'ASSIGNED') {
        await prisma.asset.update({
          where: { id: asset.id },
          data: { status: 'AVAILABLE' }
        });
        return res.json({ success: true, message: 'Asset status reset to Available (no active assignment record existed)' });
      }
      return res.status(404).json({ error: 'No active assignment found for this asset' });
    }

    const custodianName = assignment.user?.details
      ? `${assignment.user.details.first_name || ''} ${assignment.user.details.last_name || ''}`.trim()
      : assignment.user?.username || `ID: ${assignment.user_id}`;

    await prisma.$transaction(async (tx) => {
      await tx.assetAssignment.update({
        where: { id: assignment.id },
        data: {
          status: 'RETURNED',
          return_date: new Date(),
          notes: remarks || null
        }
      });

      await tx.asset.update({
        where: { id: parseInt(id as string) },
        data: { status: 'AVAILABLE' }
      });

      // Log unassignment history
      await tx.assetHistory.create({
        data: {
          organization_id: tenantId,
          asset_id: parseInt(id as string),
          action_type: 'UNASSIGN',
          field_changed: 'status',
          old_value: 'ASSIGNED',
          new_value: `Returned by ${custodianName}.${remarks ? ` Remarks: ${remarks}` : ''}`,
          changed_by_id: req.user?.id
        }
      });
    });

    // Create system notification & dispatch WebSocket event to the returning employee
    try {
      const assetName = assignment.asset?.name || 'Asset';
      const assetSerial = assignment.asset?.serial_number || 'N/A';
      await notificationService.create({
        user_id: assignment.user_id,
        title: 'Asset Returned Successfully',
        message: `Your assigned asset "${assetName}" (${assetSerial}) has been marked as returned.`,
        type: 'INFO',
        related_module: 'asset',
        related_id: assignment.asset_id
      });
    } catch (notifError) {
      console.error('Failed to create return notification:', notifError);
    }

    res.json({ success: true, message: 'Asset returned successfully' });
  } catch (error) {
    console.error('Error returning asset:', error);
    res.status(500).json({ error: 'Failed to return asset' });
  }
};

export const requestReturn = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.orgId || 1;
  const { id } = req.params; // assetId

  try {
    const assignment = await prisma.assetAssignment.findFirst({
      where: { asset_id: parseInt(Array.isArray(id) ? id[0] : id), organization_id: tenantId, status: 'ACTIVE' },
      orderBy: { issue_date: 'desc' },
      include: { asset: true }
    });

    if (!assignment) return res.status(404).json({ error: 'No active assignment found for this asset' });

    await prisma.assetAssignment.update({
      where: { id: assignment.id },
      data: { status: 'RETURN_REQUESTED' }
    });

    try {
      await notificationService.create({
        user_id: assignment.user_id,
        title: 'Return Requested',
        message: `Admin has requested the return of "${assignment.asset.name}" (${assignment.asset.serial_number || 'N/A'}). Please accept this request to proceed.`,
        type: 'ALERT',
        related_module: 'asset',
        related_id: assignment.asset_id
      });
    } catch (notifErr) {
      console.error('Failed to notify employee of return request:', notifErr);
    }

    res.json({ success: true, message: 'Return requested successfully' });
  } catch (error) {
    console.error('Error requesting return:', error);
    res.status(500).json({ error: 'Failed to request return' });
  }
};

export const acceptReturn = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.orgId || 1;
  const { id } = req.params; // assetId

  try {
    const assignment = await prisma.assetAssignment.findFirst({
      where: { asset_id: parseInt(Array.isArray(id) ? id[0] : id), organization_id: tenantId, status: 'RETURN_REQUESTED' },
      orderBy: { issue_date: 'desc' },
      include: { asset: true, user: true }
    });

    if (!assignment) return res.status(404).json({ error: 'No pending return request found' });

    await prisma.assetAssignment.update({
      where: { id: assignment.id },
      data: { status: 'RETURN_ACCEPTED' }
    });

    res.json({ success: true, message: 'Return accepted successfully' });
  } catch (error) {
    console.error('Error accepting return:', error);
    res.status(500).json({ error: 'Failed to accept return' });
  }
};
export const getMyAssets = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.orgId || 1;
  const userId = req.user?.id;

  try {
    const assignments = await prisma.assetAssignment.findMany({
      where: { organization_id: tenantId, user_id: userId, is_deleted: false },
      include: {
        asset: {
          include: {
            category: { select: { name: true } }
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            details: { select: { first_name: true, last_name: true } }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });
    res.json({ success: true, data: assignments });
  } catch (error) {
    console.error('Error fetching my assets:', error);
    res.status(500).json({ error: 'Failed to fetch my assets' });
  }
};



