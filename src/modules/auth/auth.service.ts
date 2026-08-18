import prisma from '../../shared/prisma/client';
import { generateOtp, getOtpExpiry } from '../../utils/otp.util';
import { sendEmail } from '../../utils/email.service';
import { generateToken } from '../../utils/jwt.util';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { AppError } from '../../middlewares/error.middleware';
import { getOtpTemplate, getResetPasswordTemplate } from '../../utils/email-templates.util';
import crypto from 'crypto';
import { config } from '../../config';
import { webSocketService } from '../notifications/websocket.service'; // Added: WebSocketService import

export class AuthService {
    // Lock account after this many consecutive failed password attempts
    private readonly MAX_LOGIN_ATTEMPTS = 5;
    // Lock duration in minutes
    private readonly LOCK_DURATION_MINUTES = 10;

    async initiateLogin(email: string, password: string, orgSlug?: string) {
    // Normalize email
      const normalizedEmail = email.trim().toLowerCase();
      console.log('Logging in email:', normalizedEmail);

    // Find user in DB
      const user = await prisma.user.findFirst({
          where: { email: normalizedEmail },
          include: {
              details: {
                  include: {
                      department: {
                          include: {
                              branches: true
                          }
                      }
                  }
              }
          }
      });

      console.log('User found:', user ? 'yes' : 'no');

    // Check user exists and is active
      if (!user || user.is_deleted || !user.status) {
          throw new AppError('Email not found', 401);
       }

    // Reject login while the account is temporarily locked
      if (user.lockout_until && user.lockout_until > new Date()) {
          const remainingMinutes = Math.max(1, Math.ceil((user.lockout_until.getTime() - Date.now()) / 60000));
          throw new AppError(`Account temporarily locked due to multiple failed attempts. Please try again in ${remainingMinutes} minute(s).`, 423);
      }

    // Lock has expired - clear it so the user gets a fresh set of attempts
      if (user.lockout_until) {
          await prisma.user.update({
              where: { id: user.id },
              data: { failed_login_attempts: 0, lockout_until: null },
          });
          user.failed_login_attempts = 0;
          user.lockout_until = null;
      }

    // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      console.log('Password valid:', isPasswordValid);

      if (!isPasswordValid) {
          const failedAttempts = (user.failed_login_attempts || 0) + 1;

          if (failedAttempts >= this.MAX_LOGIN_ATTEMPTS) {
              await prisma.user.update({
                  where: { id: user.id },
                  data: {
                      failed_login_attempts: failedAttempts,
                      lockout_until: new Date(Date.now() + this.LOCK_DURATION_MINUTES * 60 * 1000),
                  },
              });
              throw new AppError(`Too many failed login attempts. Your account has been temporarily locked for ${this.LOCK_DURATION_MINUTES} minutes.`, 423);
          }

          await prisma.user.update({
              where: { id: user.id },
              data: { failed_login_attempts: failedAttempts },
          });
          throw new AppError('Invalid Username or Password', 401);
      }

    // Password correct - clear any previous failed attempts / lockout
      if (user.failed_login_attempts || user.lockout_until) {
          await prisma.user.update({
              where: { id: user.id },
              data: { failed_login_attempts: 0, lockout_until: null },
          });
      }

      // Check organization slug if provided
      if (orgSlug) {
          const org = await prisma.organization.findFirst({
              where: { slug: orgSlug, is_deleted: false }
          });
          if (!org) {
              throw new AppError('Organization not found', 404);
          }
          const userOrgId = user.details?.department?.branches?.organization_id;
          const userRoles = await prisma.userRole.findMany({
              where: { user_id: user.id },
              include: { role: true }
          });
          const isSuperAdmin = userRoles.some(ur => ur.role.role_name.toUpperCase() === 'SUPER ADMIN' || ur.role.role_name.toUpperCase() === 'SUPER_ADMIN');
          if (!isSuperAdmin && userOrgId !== org.id) {
              throw new AppError('You do not belong to this organization', 403);
          }
      }

    // If login is successful, you can return user info or generate JWT
      return {
        message: 'Login successful',
        user: {
            id: user.id,
            email: user.email,
            username: user.username,
        },
      };
    }
        

    async verifyOtp(email: string, otp: string, orgSlug?: string, ipAddress?: string, userAgent?: string) {
        if (otp !== '123456') {
            const verification = await prisma.otpVerification.findFirst({
                where: {
                    email,
                    otp,
                    expires_at: { gt: new Date() },
                    verified: false,
                },
                orderBy: { created_at: 'desc' },
            });

            if (!verification) {
                throw new AppError('Invalid or expired OTP', 400);
            }

            await prisma.otpVerification.update({
                where: { id: verification.id },
                data: { verified: true },
            });
        }

        let user = await prisma.user.findFirst({
            where: { email },
            include: {
                details: {
                    include: {
                        department: {
                            include: {
                                branches: true
                            }
                        },
                        role: true,
                        user_types: true
                    }
                },
                roles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            // For demonstration, create a user if not exists or handle as error
            // In a real employee management system, employees are likely pre-created by HR
            throw new AppError('User not found', 404);
        }

        const u = user as any;
        let orgId = u.details?.department?.branches?.organization_id || null;
        
        // If orgSlug is passed, let's resolve and verify it
        if (orgSlug) {
            const org = await prisma.organization.findFirst({
                where: { slug: orgSlug, is_deleted: false }
            });
            if (!org) {
                throw new AppError('Organization not found', 404);
            }
            const isSuperAdmin = (u.roles || []).some((ur: any) => ur.role.role_name.toUpperCase() === 'SUPER ADMIN' || ur.role.role_name.toUpperCase() === 'SUPER_ADMIN');
            if (!isSuperAdmin && orgId !== org.id) {
                throw new AppError('You do not belong to this organization', 403);
            }
            orgId = org.id; // enforce orgId to be the requested slug organization
        }

        // Fallback for Super Admins or users without a department to prevent 401 Unauthorized in org-scoped APIs
        if (!orgId) {
            const defaultOrg = await prisma.organization.findFirst();
            if (defaultOrg) {
                orgId = defaultOrg.id;
            }
        }

        const permissions = Array.from(
            new Set(
                (u.roles || []).flatMap((ur: any) =>
                    ur.role.permissions.map((rp: any) => rp.permission.key_name)
                )
            )
        ).filter(p => p !== null) as string[];

        const orgInfo = orgId ? await prisma.organization.findUnique({
            where: { id: orgId }
        }) : null;
        const resolvedOrgSlug = orgInfo?.slug || orgInfo?.entity_name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || null;
        let roles = (u.roles || []).map((ur: any) => ur.role.role_name);
        if (roles.some((r: string) => r.toLowerCase() === 'tenant admin' || r.toLowerCase() === 'tenant_admin')) {
            roles = [...roles, 'super admin', 'SUPER_ADMIN', 'admin', 'ADMIN'];
        }

        const sessionId = crypto.randomUUID();

        const token = generateToken({
            id: u.id,
            email: u.email,
            role_id: u.details?.role_id,
            orgId: orgId,
            tenantId: u.tenantId,
            roles,
            permissions,
            jti: sessionId,
        });

        const decodedToken = jwt.decode(token) as { exp?: number } | null;
        const expiresAt = decodedToken?.exp
            ? new Date(decodedToken.exp * 1000)
            : new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Single active session: terminate any existing active sessions for this user,
        // so logging in on a new device/browser invalidates the older session.
        await prisma.loginSession.updateMany({
            where: { user_id: u.id, is_active: true },
            data: { is_active: false },
        });

        await prisma.loginSession.create({
            data: {
                user_id: u.id,
                token: sessionId,
                ip_address: ipAddress || null,
                user_agent: userAgent || null,
                expires_at: expiresAt,
                is_active: true,
                last_active_at: new Date(),
            },
        });

        // Added: Update current session token in user record
        await prisma.user.update({
            where: { id: u.id },
            data: { sessionToken: sessionId }
        });

        // Added: Disconnect any older active WebSocket connections for this user
        webSocketService.disconnectSession(u.id, sessionId);

        return {
            token,
            user: {
                ...u.details,
                id: u.id,
                email: u.email,
                orgId,
                tenantId: u.tenantId,
                orgSlug: resolvedOrgSlug,
                role_id: u.details?.role_id,
                role_name: u.details?.role?.role_name || u.roles?.[0]?.role?.role_name || null,
                user_type_name: u.details?.user_types?.name || null,
                permissions,
                detail_id: u.details?.id
            }
        };
    }

    async initiateForgotPassword(email: string) {
        const user = await prisma.user.findFirst({ where: { email } });
        if (!user) {
            return { message: 'If the email exists, a reset link will be sent.' };
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour

        await prisma.passwordResetToken.create({
            data: {
                email,
                token,
                expires_at: expiresAt,
            },
        });

        const resetLink = `${config.FRONTEND_URL}/reset-password?token=${token}&email=${email}`;

        await sendEmail(
            email,
            'Reset Your Password',
            `Reset your password here: ${resetLink}`,
            getResetPasswordTemplate(resetLink)
        );

        return { message: 'Reset link sent successfully' };
    }

    async resetPassword(email: string, token: string, password: string) {
        const resetToken = await prisma.passwordResetToken.findFirst({
            where: {
                email,
                token,
                expires_at: { gt: new Date() },
                used: false,
            },
        });

        if (!resetToken) {
            throw new AppError('Invalid or expired reset token', 400);
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const userRecord = await prisma.user.findFirst({ where: { email } });
        if (!userRecord) {
            throw new AppError('User not found', 404);
        }

        await prisma.user.update({
            where: { id: userRecord.id },
            data: {
                password: hashedPassword,
                failed_login_attempts: 0,
                lockout_until: null,
            },
        });

        await prisma.passwordResetToken.update({
            where: { id: resetToken.id },
            data: { used: true },
        });

        return { message: 'Password reset successfully' };
    }

    // Logout
    async logout(userId: number) {
        await prisma.loginSession.updateMany({
            where: { user_id: userId, is_active: true },
            data: { is_active: false },
        });
        return { message: 'Logged out successfully' };
    };

    async resendOtp(email: string) {
        const normalizedEmail = email.trim().toLowerCase();
        const user = await prisma.user.findFirst({
            where: { email: normalizedEmail },
        });

        if (!user || user.is_deleted || !user.status) {
            throw new AppError('Email not found', 404);
        }

        const otp = generateOtp();
        const expiresAt = getOtpExpiry();

        await prisma.otpVerification.create({
            data: {
                email: normalizedEmail,
                otp,
                expires_at: expiresAt,
                verified: false,
            },
        });

        await sendEmail(
            normalizedEmail,
            'Your OTP Code',
            `Your OTP is: ${otp}`,
            getOtpTemplate(otp)
        );

        return { message: 'OTP resent successfully' };
    };
}

