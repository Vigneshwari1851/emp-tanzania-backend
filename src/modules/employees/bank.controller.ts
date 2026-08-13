import { Request, Response, NextFunction } from 'express';
import { bankService } from './bank.service';
import { sendResponse } from '../../utils/response.util';

export const getAllBanks = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const banks = await bankService.getAll();
        sendResponse(res, 200, true, 'Banks fetched successfully', banks);
    } catch (error) {
        next(error);
    }
};
