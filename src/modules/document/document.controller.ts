import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { documentService } from './document.service';
import { sendResponse } from '../../utils/response.util';
import { auditService } from '../audit/audit.service';

// Standalone audit helper (fire-and-forget)
function _audit(req: any, action: string, entityId: string | number, newValue?: any, oldValue?: any) {
  auditService.log({
    module: 'DOCUMENT_HUB',
    action,
    entityId: entityId.toString(),
    actorId: req.user?.id || 0,
    newValue,
    oldValue,
    ipAddress: req.ip,
  }).catch((err) => { 
    console.error('Audit Log Error:', err); 
  });
}

/** Build a full audit snapshot from a mapped document DTO */
function _docSnapshot(doc: any) {
  return {
    title: doc.title,
    description: doc.description ?? null,
    category: doc.category,
    tab: doc.tab,
    file_type: doc.type,
    file_size: doc.size,
    is_restricted: doc.access === 'Restricted',
    version: doc.version ?? '1.0',
    tags: doc.tags ?? [],
    uploaded_by: doc.uploaded_by,
    uploader: doc.uploader
      ? { id: doc.uploader.id, username: doc.uploader.username, full_name: doc.uploader.full_name }
      : null,
    views: doc.views,
    downloads: doc.downloads,
  };
}

// ─── Create ────────────────────────────────────────────────────────────────────

export const createDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.user?.id);
    const doc = await documentService.create(userId, req.body);
    _audit(req, 'DOCUMENT_CREATED', doc.id, _docSnapshot(doc));
    sendResponse(res, 201, true, 'Document created successfully', doc);
  } catch (err) {
    next(err);
  }
};

// ─── Update ────────────────────────────────────────────────────────────────────

export const updateDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const oldDoc = await documentService.getById(id);
    const doc = await documentService.update(id, req.body);
    _audit(
      req,
      'DOCUMENT_UPDATED',
      id,
      doc ? _docSnapshot(doc) : undefined,
      oldDoc ? _docSnapshot(oldDoc) : undefined,
    );
    sendResponse(res, 200, true, 'Document updated successfully', doc);
  } catch (err) {
    next(err);
  }
};

// ─── List ──────────────────────────────────────────────────────────────────────

export const listDocuments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const params = {
      category: req.query.category as string | undefined,
      tab: req.query.tab as string | undefined,
      search: req.query.search as string | undefined,
      is_restricted: req.query.is_restricted === 'true' ? true : req.query.is_restricted === 'false' ? false : undefined,
    };
    const docs = await documentService.list(params);
    sendResponse(res, 200, true, 'Documents retrieved successfully', docs);
  } catch (err) {
    next(err);
  }
};

// ─── Get single ────────────────────────────────────────────────────────────────

export const getDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const doc = await documentService.getById(id);
    if (!doc) {
      return sendResponse(res, 404, false, 'Document not found', null);
    }
    sendResponse(res, 200, true, 'Document retrieved successfully', doc);
  } catch (err) {
    next(err);
  }
};

// ─── Delete ────────────────────────────────────────────────────────────────────

export const deleteDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const oldDoc = await documentService.getById(id);
    await documentService.delete(id);
    _audit(req, 'DOCUMENT_DELETED', id, undefined, oldDoc ? _docSnapshot(oldDoc) : undefined);
    sendResponse(res, 200, true, 'Document deleted successfully');
  } catch (err) {
    next(err);
  }
};

// ─── Download ──────────────────────────────────────────────────────────────────

export const downloadDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const doc = await documentService.getById(id);
    if (!doc) {
      return sendResponse(res, 404, false, 'Document not found', null);
    }
    await documentService.incrementDownloads(id);
    _audit(req, 'DOCUMENT_DOWNLOADED', id, {
      title: doc.title,
      category: doc.category,
      tab: doc.tab,
      file_type: doc.type,
      file_size: doc.size,
      version: doc.version,
    });
    sendResponse(res, 200, true, 'Document download recorded', { id: doc.id, title: doc.title });
  } catch (err) {
    next(err);
  }
};

// ─── Starred ───────────────────────────────────────────────────────────────────

export const starDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const doc = await documentService.getById(id);
    if (!doc) {
      return sendResponse(res, 404, false, 'Document not found', null);
    }
    const { starred } = req.body as { starred: boolean };
    _audit(req, starred ? 'DOCUMENT_STARRED' : 'DOCUMENT_UNSTARRED', id, {
      title: doc.title,
      category: doc.category,
      tab: doc.tab,
      version: doc.version,
      starred,
    });
    sendResponse(res, 200, true, starred ? 'Document starred' : 'Document unstarred', { id: doc.id, starred });
  } catch (err) {
    next(err);
  }
};

// ─── File upload ───────────────────────────────────────────────────────────────

export const uploadDocumentFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return sendResponse(res, 400, false, 'No file uploaded', null);
    }

    const fileUrl = `/public/upload/${req.file.filename}`;
    const fileInfo = {
      file_url: fileUrl,
      file_name: req.file.originalname,
      file_name_stored: req.file.filename,
      file_type: req.file.mimetype,
      file_size: req.file.size,
    };

    _audit(req, 'DOCUMENT_FILE_UPLOADED', req.file.filename, fileInfo);

    sendResponse(res, 200, true, 'File uploaded successfully', fileInfo);
  } catch (err) {
    next(err);
  }
};
