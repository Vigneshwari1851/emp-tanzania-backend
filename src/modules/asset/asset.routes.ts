import { Router } from 'express';
import { getAssets, createAsset, getAssetById, updateAsset, softDeleteAsset, getCategories, getLocations } from './asset.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import { createAssetSchema, updateAssetSchema, getAssetByIdSchema, listAssetsSchema } from './asset.validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

const uploadDir = path.join(__dirname, '../../../upload');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'asset-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const assetUpload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }
}).fields([{ name: 'image', maxCount: 1 }]);

import { createAssetRequest, getAssetRequests, processAssetRequest } from './asset-request.controller';

router.use(authenticate);

// Request routes must come before /:id routes
router.post('/requests', createAssetRequest);
router.get('/requests', getAssetRequests);
router.put('/requests/:id', processAssetRequest);

router.get('/', validateRequest(listAssetsSchema), getAssets);
router.get('/categories', getCategories);
router.get('/locations', getLocations);
router.get('/:id', validateRequest(getAssetByIdSchema), getAssetById);
router.post('/', assetUpload, validateRequest(createAssetSchema), createAsset);
router.put('/:id', assetUpload, validateRequest(updateAssetSchema), updateAsset);
router.delete('/:id', validateRequest(getAssetByIdSchema), softDeleteAsset);

export default router;
