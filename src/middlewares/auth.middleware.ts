import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.util';
import { sendError } from '../utils/response.util';
import prisma from '../config/prisma';

export interface AuthRequest extends Request {
    user?: {
        id: number;
        email: string;
        orgId: number | null;
        roles: string[];
        permissions: string[];
        jti?: string;
    };
}

export const authenticate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendError(res, 401, 'Unauthorized: No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded || typeof decoded === 'string') {
        return sendError(res, 401, 'Unauthorized: Invalid or expired token');
    }

    // Enforce active login session: compare the session ID stored in the JWT with the session token stored in the database
    const sessionId = decoded.jti;
    if (!sessionId) {
        return res.status(401).json({ message: 'Session expired. Please login again.' });
    }

    // Fetch the user from the database
    const user = await prisma.user.findUnique({
        where: { id: Number(decoded.id) }
    });

    if (!user) {
        return res.status(401).json({ message: 'Session expired. Please login again.' });
    }

    // Compare the session ID stored in the JWT with the session token stored in the database.
    if (user.sessionToken !== String(sessionId)) {
        return res.status(401).json({ message: 'Session expired. Please login again.' });
    }

    // Also verify session expiry in login_sessions table for backwards compatibility
    const session = await prisma.loginSession.findUnique({
        where: { token: String(sessionId) },
    });

    if (!session || !session.is_active || session.expires_at < new Date()) {
        return res.status(401).json({ message: 'Session expired. Please login again.' });
    }

    // Safely enforce strict data types
    req.user = {
        id: Number(decoded.id),
        email: String(decoded.email),
        orgId: decoded.orgId ? Number(decoded.orgId) : null,
        roles: Array.isArray(decoded.roles) ? decoded.roles : [],
        permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
        jti: String(sessionId),
    };

    console.log(`[Auth] User ${req.user.email} authenticated for Org: ${req.user.orgId}`);
    next();
};

export const authorize = (requiredPermissions: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return sendError(res, 401, 'Unauthorized');
        }

        // Management role bypass: If user has Admin, HR, Finance, Manager, or SuperAdmin role, grant access
        const userRoles = req.user.roles || [];
        const rolesArr = Array.isArray(userRoles) ? userRoles : [userRoles];
        const normalizedRoles: string[] = [];
        for (const r of rolesArr) {
            if (typeof r === 'string' && r.trim()) normalizedRoles.push(r.toUpperCase());
            else if (r && typeof r === 'object') {
                const rName = (r as any).role_name || (r as any).role?.role_name || (r as any).name;
                if (rName) normalizedRoles.push(String(rName).toUpperCase());
            }
        }

        const isManagementRole = normalizedRoles.some(r =>
            r.includes('SUPER') ||
            r.includes('ADMIN') ||
            r.includes('CEO') ||
            r.includes('HR') ||
            r.includes('FINANCE') ||
            r.includes('MANAGER') ||
            r.includes('PAYROLL')
        );

        if (isManagementRole) {
            return next();
        }

        const userPermissions = req.user.permissions || [];
        const hasPermission = requiredPermissions.every((perm) =>
            userPermissions.includes(perm)
        );

        if (!hasPermission) {
            return sendError(res, 403, 'Forbidden: Insufficient permissions');
        }

        next();
    };
};
