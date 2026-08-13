import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { AuthService } from './auth.service';
import { sendResponse } from '../../utils/response.util';

const authService = new AuthService();

export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password, orgSlug } = req.body;
        const result = await authService.initiateLogin(email, password, orgSlug);
        return sendResponse(res, 200, true, 'OTP sent successfully', result);
    } catch (error) {
        next(error);
    }
};

export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, otp, orgSlug } = req.body;
        const result = await authService.verifyOtp(email, otp, orgSlug, req.ip, req.headers['user-agent']);
        return sendResponse(res, 200, true, 'Login successful', result);
    } catch (error) {
        next(error);
    }
};

export const logout = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return sendResponse(res, 401, false, 'Unauthorized', null);
        }

        const result = await authService.logout(Number(userId));
        sendResponse(res, 200, true, 'Logout successful', result);
    } catch (error) {
        next(error);
    }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = req.body;
        const result = await authService.initiateForgotPassword(email);
        return sendResponse(res, 200, true, result.message, null);
    } catch (error) {
        next(error);
    }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, token, password } = req.body;
        const result = await authService.resetPassword(email, token, password);
        return sendResponse(res, 200, true, 'Password reset successful', result);
    } catch (error) {
        next(error);
    }
};

export const resendOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = req.body;
        const result = await authService.resendOtp(email);
        return sendResponse(res, 200, true, result.message, null);
    } catch (error) {
        next(error);
    }
};
