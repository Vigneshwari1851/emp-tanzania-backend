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

export const listNews = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const params = {
      status: req.query.status as string | undefined,
      access_type: req.query.access_type as string | undefined,
      department_id: req.query.department_id ? Number(req.query.department_id) : undefined,
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
