import jwt from 'jsonwebtoken';
import { TokenType, type JwtPayload } from '@/shared/interfaces/IJwt';
import type { UserRole } from '@/generated/prisma/enums';
import { config } from '@/config/index';

const JWT_SECRET = config.jwt.secret;
const ACCESS_EXPIRES_IN_SECONDS = config.jwt.accessExpiresInSeconds;
const REFRESH_EXPIRES_IN_SECONDS = config.jwt.refreshExpiresInSeconds;

interface SignTokenPayload {
  id: number;
  email: string;
  role: UserRole;
  tokenVersion: number;
}

export const signAccessToken = (payload: SignTokenPayload): string => {
  const tokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: payload.id + "",
    email: payload.email,
    role: payload.role,
    type: TokenType.Access,
    tokenVersion: payload.tokenVersion,
  };

  return jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN_SECONDS });
};

export const signRefreshToken  = (payload: SignTokenPayload): string => {
  const tokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: payload.id + "",
    email: payload.email,
    role: payload.role,
    type: TokenType.Refresh,
    tokenVersion: payload.tokenVersion,
  };

  return jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_IN_SECONDS });
};


export const verifyToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token đã hết hạn');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Token không hợp lệ');
    }
    throw new Error('Token verification failed');
  }
};
