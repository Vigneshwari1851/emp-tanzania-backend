import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as documentController from './document.controller';
import { createDocumentSchema, updateDocumentSchema } from './document.validator';

const router = Router();

router.use(authenticate);

router.get('/', documentController.listDocuments);
router.get('/:id', documentController.getDocument);

router.post('/', authorize(['documents.manage', 'documents.upload']), validateRequest(createDocumentSchema), documentController.createDocument);
router.put('/:id', authorize(['documents.manage']), validateRequest(updateDocumentSchema), documentController.updateDocument);
router.delete('/:id', authorize(['documents.manage', 'documents.delete']), documentController.deleteDocument);
router.post('/:id/download', documentController.downloadDocument);
router.post('/:id/star', documentController.starDocument);

const uploadDir = path.join(__dirname, '../../../upload');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const docUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, 'document-' + uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'video/mp4',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, images, and videos are allowed.'));
    }
  },
}).single('file');

router.post('/upload', (req, res, next) => {
  docUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message, data: null });
    }
    documentController.uploadDocumentFile(req, res, next);
  });
});

export default router;
