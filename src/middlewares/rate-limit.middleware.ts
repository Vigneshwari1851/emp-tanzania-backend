import rateLimit from 'express-rate-limit';

export const otpRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Temporarily increased for intensive development debugging
    message: {
        success: false,
        message: 'Too many OTP requests from this IP, please try again after 15 minutes',
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
