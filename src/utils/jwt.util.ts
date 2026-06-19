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


/** Raised when a token is well-formed but past its expiry. */
export class TokenExpiredError extends Error {
  constructor(message = 'Token đã hết hạn') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

/** Raised for malformed tokens or signature/secret mismatches. */
export class InvalidTokenError extends Error {
  constructor(message = 'Token không hợp lệ') {
    super(message);
    this.name = 'InvalidTokenError';
  }
}

export const verifyToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    // Re-throw as typed errors so callers (e.g. auth middleware) can distinguish an
    // expired token from an invalid one without re-importing jsonwebtoken's classes.
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError();
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new InvalidTokenError();
    }
    throw new Error('Token verification failed');
  }
};
