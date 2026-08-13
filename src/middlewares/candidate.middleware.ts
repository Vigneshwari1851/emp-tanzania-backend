import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { sendResponse } from '../utils/response.util';

export const verifyCandidateToken = (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendResponse(res, 401, false, 'Access Denied: No token provided');
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return sendResponse(res, 401, false, 'Access Denied: Invalid token format');
        }

        const decoded = jwt.verify(token, config.JWT_SECRET as jwt.Secret) as any;
        
        if (decoded.role !== 'CANDIDATE') {
            return sendResponse(res, 403, false, 'Access Denied: Not a candidate token');
        }

        (req as any).user = decoded; // Contains candidate id
        next();
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            return sendResponse(res, 401, false, 'Access Denied: Token expired');
        }
        return sendResponse(res, 403, false, 'Access Denied: Invalid token');
    }
};
