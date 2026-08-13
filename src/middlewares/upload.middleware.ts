import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// const uploadDir = path.join(__dirname, '../../upload');
const uploadDir = path.join(process.cwd(), 'public', 'upload');
// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req: Request, file: Express.Multer.File, cb) => {
        cb(null, uploadDir);
    },
    filename: (req: Request, file: Express.Multer.File, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = [
        'image/jpeg', 
        'image/png', 
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'video/mp4',
        'video/webm',
        'video/mpeg',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, PDF, DOC/DOCX, VIDEO, and PPT are allowed.'));
    }
};

export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 20 * 1024 * 1024 // 20MB limit
    }
}).fields([
    { name: 'profile_picture', maxCount: 1 },
    { name: 'resume', maxCount: 1 },
    { name: 'certificate_files', maxCount: 10 },
    { name: 'passport_doc', maxCount: 1 },
    { name: 'dl_doc', maxCount: 1 },
    { name: 'pan_doc', maxCount: 1 },
    { name: 'aadhaar_doc', maxCount: 1 },
    { name: 'education_docs', maxCount: 10 },
    { name: 'employment_docs', maxCount: 10 },
    { name: 'certification_docs', maxCount: 10 },
    { name: 'documents', maxCount: 10 },
    { name: 'thumbnail', maxCount: 1 },
    { name: 'content_file', maxCount: 1 }
]);
