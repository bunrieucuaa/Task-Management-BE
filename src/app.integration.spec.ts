import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { PrismaMock } from '@/test/prisma.mock';
import { UserRole, UserStatus } from '@/generated/prisma/enums';

vi.mock('@/config/prisma', async () => {
  const { createPrismaMock } = await import('@/test/prisma.mock');
  const prisma = createPrismaMock();
  return { prisma, default: prisma };
});

import app from '@/app';
import { prisma } from '@/config/prisma';
import { signAccessToken, signRefreshToken } from '@/utils/jwt.util';
import { hashPassword, generateSalt } from '@/utils/password.util';

const db = prisma as unknown as PrismaMock;

const PASSWORD = 'Password1!';
let salt: string;
let hash: string;

const dbUser = (over: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Alice',
  email: 'alice@example.com',
  role: UserRole.MEMBER,
  status: UserStatus.ACTIVE,
  avatarUrl: null,
  passwordHash: hash,
  passwordSalt: salt,
  tokenVersion: 0,
  mustChangePassword: false,
  ...over,
});

const tokenFor = (role: UserRole, over = {}) =>
  signAccessToken({ id: 1, email: 'alice@example.com', role, tokenVersion: 0, ...over });

beforeAll(async () => {
  salt = generateSalt();
  hash = await hashPassword(PASSWORD, salt);
});

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/auth/login', () => {
  it('400 on validation failure (bad email)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'x', password: 'y' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('401 on wrong credentials', async () => {
    db.user.findUnique.mockResolvedValue(dbUser());
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'nope' });
    expect(res.status).toBe(401);
  });

  it('200 with tokens on success', async () => {
    db.user.findUnique.mockResolvedValue(dbUser());
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(res.body.data.refreshToken).toBeTypeOf('string');
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('400 when refreshToken is missing', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({});
    expect(res.status).toBe(400);
  });

  it('401 for an invalid refresh token', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: 'bad' });
    expect(res.status).toBe(401);
  });

  it('200 for a valid refresh token', async () => {
    db.user.findUnique.mockResolvedValue(dbUser());
    const refresh = signRefreshToken({ id: 1, email: 'alice@example.com', role: UserRole.MEMBER, tokenVersion: 0 });
    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: refresh });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf('string');
  });
});

describe('GET /api/v1/auth/me', () => {
  it('401 without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('200 with a valid member token', async () => {
    db.user.findUnique.mockResolvedValue(dbUser());
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokenFor(UserRole.MEMBER)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: 1, email: 'alice@example.com' });
  });
});

describe('protected user routes (RBAC)', () => {
  it('403 when a MEMBER lists all users (ADMIN only)', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.MEMBER }));
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${tokenFor(UserRole.MEMBER)}`);
    expect(res.status).toBe(403);
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it('200 when an ADMIN lists all users', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.ADMIN }));
    db.user.count.mockResolvedValue(0);
    db.user.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${tokenFor(UserRole.ADMIN)}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('403 when a user with mustChangePassword hits a protected route', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.ADMIN, mustChangePassword: true }));
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${tokenFor(UserRole.ADMIN)}`);
    expect(res.status).toBe(403);
    expect(res.body.mustChangePassword).toBe(true);
  });
});

describe('unknown routes', () => {
  it('404 with a JSON body', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, message: 'Route not found' });
  });
});
