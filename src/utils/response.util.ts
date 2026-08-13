import { Response } from 'express';

export const sendResponse = (
    res: Response,
    statusCode: number,
    success: boolean,
    message: string,
    data: any = null
) => {
    return res.status(statusCode).json({
        success,
        message,
        data
    });
};

export const sendError = (
    res: Response,
    statusCode: number,
    message: string,
    errors: any = null
) => {
    return res.status(statusCode).json({
        success: false,
        message,
        errors,
    });
};
