import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import { config } from '../config';

export const generateToken = (payload: string | object | Buffer): string => {
    return jwt.sign(payload, config.JWT_SECRET as jwt.Secret, {
        expiresIn: config.JWT_EXPIRES_IN as number | string,
    } as SignOptions);
};

export const verifyToken = (token: string): string | JwtPayload | null => {
    try {
        return jwt.verify(token, config.JWT_SECRET as string);
    } catch (error: unknown) {
        return null;
    }
};
