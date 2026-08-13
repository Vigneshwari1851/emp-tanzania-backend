import { Router } from 'express';
import * as authController from './auth.controller';
import { validateRequest } from '../../middlewares/validate.middleware';
import { z } from 'zod';
import { otpRateLimiter } from '../../middlewares/rate-limit.middleware';
import { authenticate } from '../../middlewares/auth.middleware';
import * as permissionsController from '../rbac/permissions.controller';

const router = Router();

const loginSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string(),
    }),
});

const verifyOtpSchema = z.object({
    body: z.object({
        email: z.string().email(),
        otp: z.string().length(6),
    }),
});

const forgotPasswordSchema = z.object({
    body: z.object({
        email: z.string().email(),
    }),
});

const resetPasswordSchema = z.object({
    body: z.object({
        email: z.string().email(),
        token: z.string(),
        password: z.string().min(8),
    }),
});

router.post('/login', validateRequest(loginSchema), authController.login);
router.post('/verify-otp', validateRequest(verifyOtpSchema), authController.verifyOtp);
router.post('/resend-otp', validateRequest(forgotPasswordSchema), authController.resendOtp);
router.post('/logout', authenticate, authController.logout);
router.post('/forgot-password', validateRequest(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validateRequest(resetPasswordSchema), authController.resetPassword);
router.get('/me/permissions', authenticate, permissionsController.getMyPermissions);

export default router;
