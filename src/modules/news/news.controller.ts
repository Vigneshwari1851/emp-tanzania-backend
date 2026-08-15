import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { newsService } from './news.service';
import { sendResponse } from '../../utils/response.util';

export const createNews = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.user?.id);
    const news = await newsService.create(userId, req.body);
    sendResponse(res, 201, true, 'News item created successfully', news);
  } catch (err) {
    next(err);
  }
};

export const updateNews = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const news = await newsService.update(id, req.body);
    sendResponse(res, 200, true, 'News item updated successfully', news);
  } catch (err) {
    next(err);
  }
};

import prisma from '../../config/prisma';

export const getNewsFeed = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.user?.id);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userDetail = await prisma.userDetail.findUnique({
      where: { user_id: userId },
      select: { department_id: true }
    });
    const userDeptId = userDetail?.department_id;

    const params = {
      status: 'published',
      user_department_id: userDeptId,
      can_manage: false,
    };

    const news = await newsService.list(params);
    sendResponse(res, 200, true, 'News feed retrieved successfully', news);
  } catch (err) {
    next(err);
  }
};

export const listNews = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.user?.id);
    const userPermissions = req.user?.permissions || [];
    const userRoles = req.user?.roles || [];

    const hasManagePermission = userPermissions.includes('news.manage') || userPermissions.includes('news:manage');
    
    // Normalize role string / object checks with proper casting
    const normalizedRoles = [];
    for (const r of userRoles) {
      if (typeof r === 'string') {
        normalizedRoles.push(r.toUpperCase());
      } else if (r && typeof r === 'object') {
        const name = (r as any).role_name || (r as any).name || ((r as any).role && (r as any).role.role_name);
        if (name) normalizedRoles.push(String(name).toUpperCase());
      }
    }

    const isManagementRole = normalizedRoles.some(r =>
      r.includes('SUPER') ||
      r.includes('ADMIN') ||
      r.includes('HR') ||
      r.includes('FINANCE') ||
      r.includes('MANAGER')
    );

    const canManage = hasManagePermission || isManagementRole;

    const userDetail = await prisma.userDetail.findUnique({
      where: { user_id: userId },
      select: { department_id: true }
    });
    const userDeptId = userDetail?.department_id;

    const params = {
      status: req.query.status as string | undefined,
      access_type: req.query.access_type as string | undefined,
      department_id: req.query.department_id ? Number(req.query.department_id) : undefined,
      user_department_id: userDeptId,
      can_manage: canManage,
    };
    const news = await newsService.list(params);
    sendResponse(res, 200, true, 'News retrieved successfully', news);
  } catch (err) {
    next(err);
  }
};

export const getNews = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const news = await newsService.getById(id);
    if (!news) {
      return sendResponse(res, 404, false, 'News item not found', null);
    }
    sendResponse(res, 200, true, 'News item retrieved successfully', news);
  } catch (err) {
    next(err);
  }
};

export const deleteNews = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    await newsService.delete(id);
    sendResponse(res, 200, true, 'News item deleted successfully');
  } catch (err) {
    next(err);
  }
};
