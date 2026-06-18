import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { PrismaMock } from '@/test/prisma.mock';
import { UserRole, UserStatus } from '@/generated/prisma/enums';

vi.mock('@/config/prisma', async () => {
  const { createPrismaMock } = await import('@/test/prisma.mock');
  const prisma = createPrismaMock();
  return { prisma, default: prisma };
});

import { prisma } from '@/config/prisma';
import { login, refreshAccessToken, logout, changePassword } from './auth.service';
import { signAccessToken, signRefreshToken, verifyToken } from '@/utils/jwt.util';
import { hashPassword, generateSalt } from '@/utils/password.util';

const db = prisma as unknown as PrismaMock;

const PASSWORD = 'Password1!';
let salt: string;
let hash: string;

const makeUser = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
});

beforeAll(async () => {
  salt = generateSalt();
  hash = await hashPassword(PASSWORD, salt);
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('auth.service — login', () => {
  it('rejects an unknown email', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(login('nope@example.com', PASSWORD)).rejects.toThrow('Email hoặc password không hợp lệ');
  });

  it('rejects an inactive account', async () => {
    db.user.findUnique.mockResolvedValue(makeUser({ status: UserStatus.INACTIVE }));
    await expect(login('alice@example.com', PASSWORD)).rejects.toThrow('không hoạt động');
  });

  it('rejects a wrong password', async () => {
    db.user.findUnique.mockResolvedValue(makeUser());
    await expect(login('alice@example.com', 'wrongpass')).rejects.toThrow('Invalid username or password');
  });

  it('returns valid tokens and user data on success', async () => {
    db.user.findUnique.mockResolvedValue(makeUser());

    const res = await login('alice@example.com', PASSWORD);

    expect(res.success).toBe(true);
    expect(res.message).toBe('Login successful');
    expect(res.data?.user).toMatchObject({ id: '1', email: 'alice@example.com', role: UserRole.MEMBER });
    expect(res.data?.mustChangePassword).toBe(false);

    const decoded = verifyToken(res.data!.accessToken);
    expect(decoded.sub).toBe('1');
    expect(decoded.email).toBe('alice@example.com');
  });

  it('signals mustChangePassword in the message', async () => {
    db.user.findUnique.mockResolvedValue(makeUser({ mustChangePassword: true }));
    const res = await login('alice@example.com', PASSWORD);
    expect(res.message).toContain('must change your password');
    expect(res.data?.mustChangePassword).toBe(true);
  });
});

describe('auth.service — refreshAccessToken', () => {
  const refreshFor = (overrides = {}) =>
    signRefreshToken({ id: 1, email: 'alice@example.com', role: UserRole.MEMBER, tokenVersion: 0, ...overrides });

  it('rejects an access token used as a refresh token', async () => {
    const access = signAccessToken({ id: 1, email: 'alice@example.com', role: UserRole.MEMBER, tokenVersion: 0 });
    await expect(refreshAccessToken(access)).rejects.toThrow('Refresh token required');
  });

  it('rejects when the user no longer exists', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(refreshAccessToken(refreshFor())).rejects.toThrow('User not found');
  });

  it('rejects an inactive account', async () => {
    db.user.findUnique.mockResolvedValue(makeUser({ status: UserStatus.INACTIVE }));
    await expect(refreshAccessToken(refreshFor())).rejects.toThrow('không hoạt động');
  });

  it('rejects a revoked token (tokenVersion mismatch)', async () => {
    db.user.findUnique.mockResolvedValue(makeUser({ tokenVersion: 5 }));
    await expect(refreshAccessToken(refreshFor({ tokenVersion: 0 }))).rejects.toThrow('revoked');
  });

  it('issues a fresh access token on success', async () => {
    db.user.findUnique.mockResolvedValue(makeUser());
    const res = await refreshAccessToken(refreshFor());
    expect(res.success).toBe(true);
    expect(verifyToken(res.data!.accessToken).sub).toBe('1');
  });
});

describe('auth.service — logout', () => {
  it('bumps tokenVersion to invalidate all tokens', async () => {
    db.user.update.mockResolvedValue(makeUser());
    const res = await logout(1);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { tokenVersion: { increment: 1 } },
    });
    expect(res.success).toBe(true);
  });
});

describe('auth.service — changePassword', () => {
  it('rejects reusing the same password', async () => {
    await expect(changePassword(1, PASSWORD, PASSWORD)).rejects.toThrow('different from old password');
  });

  it('rejects a weak new password', async () => {
    await expect(changePassword(1, PASSWORD, 'weak')).rejects.toThrow(/8 characters|uppercase|number|special/);
  });

  it('rejects when the user is missing', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(changePassword(1, PASSWORD, 'NewPass1!')).rejects.toThrow('User not found');
  });

  it('rejects an incorrect old password', async () => {
    db.user.findUnique.mockResolvedValue(makeUser());
    await expect(changePassword(1, 'WrongOld1!', 'NewPass1!')).rejects.toThrow('Old password is incorrect');
  });

  it('persists a new hash/salt and revokes tokens on success', async () => {
    db.user.findUnique.mockResolvedValue(makeUser());
    db.user.update.mockResolvedValue(makeUser());

    const res = await changePassword(1, PASSWORD, 'NewPass1!');

    expect(res.success).toBe(true);
    const data = db.user.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ mustChangePassword: false, tokenVersion: { increment: 1 } });
    expect(data.passwordHash).toBeTypeOf('string');
    expect(data.passwordSalt).toBeTypeOf('string');
  });
});
