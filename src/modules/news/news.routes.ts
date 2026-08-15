import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import * as newsController from './news.controller';
import { createNewsSchema, updateNewsSchema } from './news.validator';

const router = Router();

router.use(authenticate);

router.get('/', newsController.listNews);
router.get('/feed', newsController.getNewsFeed);
router.get('/:id', newsController.getNews);

router.post('/', authorize(['MANAGE_NEWS']), validateRequest(createNewsSchema), newsController.createNews);
router.put('/:id', authorize(['MANAGE_NEWS']), validateRequest(updateNewsSchema), newsController.updateNews);
router.delete('/:id', authorize(['MANAGE_NEWS']), newsController.deleteNews);

export default router;
