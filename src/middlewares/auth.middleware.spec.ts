import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { PrismaMock } from '@/test/prisma.mock';
import { UserRole, UserStatus } from '@/generated/prisma/enums';
import { TokenType } from '@/shared/interfaces/IJwt';

vi.mock('@/config/prisma', async () => {
  const { createPrismaMock } = await import('@/test/prisma.mock');
  const prisma = createPrismaMock();
  return { prisma, default: prisma };
});

import { prisma } from '@/config/prisma';
import { authenticate, authorize } from './auth.middleware';
import { signAccessToken, signRefreshToken } from '@/utils/jwt.util';
import { config } from '@/config/index';
import { mockRequest, mockResponse, mockNext } from '@/test/express.mock';

const db = prisma as unknown as PrismaMock;

const activeUser = {
  id: 1,
  email: 'a@b.com',
  role: UserRole.MEMBER,
  status: UserStatus.ACTIVE,
  avatarUrl: null,
  tokenVersion: 0,
  mustChangePassword: false,
};

const accessToken = (over = {}) =>
  signAccessToken({ id: 1, email: 'a@b.com', role: UserRole.MEMBER, tokenVersion: 0, ...over });

beforeEach(() => vi.clearAllMocks());

describe('authenticate', () => {
  it('401 when the Authorization header is missing', async () => {
    const res = mockResponse();
    const next = mockNext();
    await authenticate(mockRequest(), res, next);
    expect(res.statusCode).toBe(401);
    expect((res.body as any).message).toBe('Authentication required');
    expect(next).not.toHaveBeenCalled();
  });

  it('401 when the header is not a Bearer token', async () => {
    const res = mockResponse();
    await authenticate(mockRequest({ headers: { authorization: 'Basic xyz' } }), res, mockNext());
    expect(res.statusCode).toBe(401);
  });

  it('401 "Invalid token" for a garbage token', async () => {
    const res = mockResponse();
    await authenticate(mockRequest({ headers: { authorization: 'Bearer garbage' } }), res, mockNext());
    expect(res.statusCode).toBe(401);
    expect((res.body as any).message).toBe('Invalid token');
  });

  it('401 "Token has expired" for an expired token', async () => {
    // verifyToken throws a typed TokenExpiredError so the middleware can surface the
    // precise message (still 401, which is what the FE refresh interceptor keys off of).
    const expired = jwt.sign({ sub: '1', type: TokenType.Access, tokenVersion: 0 }, config.jwt.secret, {
      expiresIn: -5,
    });
    const res = mockResponse();
    await authenticate(mockRequest({ headers: { authorization: `Bearer ${expired}` } }), res, mockNext());
    expect(res.statusCode).toBe(401);
    expect((res.body as any).message).toBe('Token has expired');
  });

  it('401 when a refresh token is used as an access token', async () => {
    const refresh = signRefreshToken({ id: 1, email: 'a@b.com', role: UserRole.MEMBER, tokenVersion: 0 });
    const res = mockResponse();
    await authenticate(mockRequest({ headers: { authorization: `Bearer ${refresh}` } }), res, mockNext());
    expect(res.statusCode).toBe(401);
    expect((res.body as any).message).toContain('Access token required');
  });

  it('401 when the user no longer exists', async () => {
    db.user.findUnique.mockResolvedValue(null);
    const res = mockResponse();
    await authenticate(mockRequest({ headers: { authorization: `Bearer ${accessToken()}` } }), res, mockNext());
    expect(res.statusCode).toBe(401);
    expect((res.body as any).message).toBe('User not found');
  });

  it('401 when the token version is stale (revoked)', async () => {
    db.user.findUnique.mockResolvedValue({ ...activeUser, tokenVersion: 9 });
    const res = mockResponse();
    await authenticate(mockRequest({ headers: { authorization: `Bearer ${accessToken()}` } }), res, mockNext());
    expect(res.statusCode).toBe(401);
    expect((res.body as any).message).toContain('revoked');
  });

  it('403 when mustChangePassword and the path is not /change-password', async () => {
    db.user.findUnique.mockResolvedValue({ ...activeUser, mustChangePassword: true });
    const res = mockResponse();
    const next = mockNext();
    await authenticate(
      mockRequest({ headers: { authorization: `Bearer ${accessToken()}` }, path: '/api/v1/users' }),
      res,
      next,
    );
    expect(res.statusCode).toBe(403);
    expect((res.body as any).mustChangePassword).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and attaches req.user on success', async () => {
    db.user.findUnique.mockResolvedValue(activeUser);
    const req = mockRequest({ headers: { authorization: `Bearer ${accessToken()}` } });
    const next = mockNext();
    await authenticate(req, mockResponse(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({ id: 1, email: 'a@b.com', role: UserRole.MEMBER });
  });
});

describe('authorize', () => {
  it('rejects when there is no user on the request', () => {
    const res = mockResponse();
    const next = mockNext();
    authorize(UserRole.ADMIN)(mockRequest(), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404); // httpStatus of USER_NOT_FOUND per implementation
  });

  it('403 when the user role is not in the allow-list', () => {
    const res = mockResponse();
    const next = mockNext();
    const req = mockRequest();
    (req as any).user = { ...activeUser };
    authorize(UserRole.ADMIN)(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when the role is allowed', () => {
    const next = mockNext();
    const req = mockRequest();
    (req as any).user = { ...activeUser, role: UserRole.ADMIN };
    authorize(UserRole.ADMIN, UserRole.PM)(req, mockResponse(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});
