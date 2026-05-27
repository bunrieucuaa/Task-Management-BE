import { Request, Response, NextFunction } from 'express';
import { getUserById } from '../services/user.service';
import { UserStatus } from '@/generated/prisma/client';
import { verifyToken } from '@/utils/jwt.util';
import { TokenType } from '@/shared/interfaces/IJwt';
import jwt from 'jsonwebtoken';


/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      code: 401,
      success: false,
      data: null,
      message: 'Authentication required',
    });
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Verify token — bắt lỗi hết hạn / không hợp lệ ngay tại đây → trả 401
  let payload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        code: 401,
        success: false,
        data: null,
        message: 'Token has expired',
      });
      return;
    }
    res.status(401).json({
      code: 401,
      success: false,
      data: null,
      message: 'Invalid token',
    });
    return;
  }

  if (payload.type !== TokenType.Access) {
    res.status(401).json({
      code: 401,
      success: false,
      data: null,
      message: 'Invalid token type. Access token required.',
    });
    return;
  }

  try {
    // Get user from database (payload.sub is user id)
    const user = await getUserById(+payload.sub);

    if (!user) {
      res.status(401).json({
        code: 401,
        success: false,
        data: null,
        message: 'User not found',
      });
      return;
    }
 
    // Check if user is disabled
    if (user.status === UserStatus.INACTIVE) {
      res.status(401).json({
        code: 401,
        success: false,
        data: null,
        message: 'User account is disabled',
      });
      return;
    }

    // Validate tokenVersion (soft revocation)
    if (user.tokenVersion !== payload.tokenVersion) {
      res.status(401).json({
        code: 401,
        success: false,
        data: null,
        message: 'Token has been revoked. Please login again.',
      });
      return;
    }

    // Check if user must change password
    // Only allow access to change-password endpoint
    if (user.mustChangePassword && !req.path.includes('/change-password')) {
      res.status(403).json({
        code: 403,
        success: false,
        data: null,
        message: 'You must change your password before accessing this resource',
        mustChangePassword: true,
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
      name: user.name,
      avatarUrl: user.avatarUrl ?? "",
      status: user.status ?? "ACTIVE"
    };

    next();
  } catch (error) {
    res.status(500).json({
      code: 500,
      success: false,
      data: null,
      message: 'Internal server error',
    });
  }
};
