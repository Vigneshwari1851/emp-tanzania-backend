import crypto from 'crypto';
import { config } from '../config';

export const generateOtp = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const getOtpExpiry = (): Date => {
    const now = new Date();
    return new Date(now.getTime() + config.OTP_EXPIRY_MINUTES * 60000); // 60 Seconds 
};
