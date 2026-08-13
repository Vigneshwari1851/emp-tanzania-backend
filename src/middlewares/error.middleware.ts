import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.util';

export class AppError extends Error {
    statusCode: number;
    errors: any;

    constructor(message: string, statusCode: number, errors: any = null) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        Error.captureStackTrace(this, this.constructor);
    }
}

export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    console.error(`[Error] ${req.method} ${req.url}`, err);

    return sendError(res, statusCode, message, err.errors);
};
