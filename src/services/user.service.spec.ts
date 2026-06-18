import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaMock } from '@/test/prisma.mock';
import { UserRole, UserStatus } from '@/generated/prisma/enums';

vi.mock('@/config/prisma', async () => {
  const { createPrismaMock } = await import('@/test/prisma.mock');
  const prisma = createPrismaMock();
  return { prisma, default: prisma };
});

import { prisma } from '@/config/prisma';
import {
  getUserByEmail,
  getUserById,
  incrementTokenVersion,
  updatePassword,
  toUserResponse,
  createUser,
  getAllUsers,
  updateUser,
  updateUserStatus,
  resetUserPassword,
  deleteUser,
  getDirectory,
} from './user.service';

const db = prisma as unknown as PrismaMock;

const baseUser = {
  id: 1,
  name: 'Alice',
  email: 'alice@example.com',
  role: UserRole.MEMBER,
  status: UserStatus.ACTIVE,
  avatarUrl: null,
  passwordHash: 'hash',
  passwordSalt: 'salt',
  tokenVersion: 0,
  mustChangePassword: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('user.service — simple reads/writes', () => {
  it('getUserByEmail delegates to prisma.user.findUnique', async () => {
    db.user.findUnique.mockResolvedValue(baseUser);
    const result = await getUserByEmail('alice@example.com');
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { email: 'alice@example.com' } });
    expect(result).toBe(baseUser);
  });

  it('getUserById delegates to prisma.user.findUnique by id', async () => {
    db.user.findUnique.mockResolvedValue(baseUser);
    await getUserById(1);
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('incrementTokenVersion increments tokenVersion', async () => {
    db.user.update.mockResolvedValue(baseUser);
    await incrementTokenVersion(1);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { tokenVersion: { increment: 1 } },
    });
  });

  it('updatePassword sets hash/salt, clears mustChangePassword and bumps version', async () => {
    db.user.update.mockResolvedValue(baseUser);
    await updatePassword(1, 'newHash', 'newSalt');
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        passwordHash: 'newHash',
        passwordSalt: 'newSalt',
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
    });
  });

  it('getDirectory returns active users with safe fields, sorted by name', async () => {
    db.user.findMany.mockResolvedValue([]);
    await getDirectory();
    expect(db.user.findMany).toHaveBeenCalledWith({
      where: { status: UserStatus.ACTIVE },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true },
      orderBy: { name: 'asc' },
    });
  });
});

describe('user.service — toUserResponse', () => {
  it('strips passwordHash, passwordSalt and tokenVersion', () => {
    const res = toUserResponse(baseUser as never) as Record<string, unknown>;
    expect(res).not.toHaveProperty('passwordHash');
    expect(res).not.toHaveProperty('passwordSalt');
    expect(res).not.toHaveProperty('tokenVersion');
    expect(res.email).toBe('alice@example.com');
  });
});

describe('user.service — createUser', () => {
  it('throws when the email already exists', async () => {
    db.user.findUnique.mockResolvedValue(baseUser);
    await expect(createUser({ name: 'A', email: 'alice@example.com', role: UserRole.MEMBER })).rejects.toThrow(
      'Email already exists',
    );
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('creates a user with a temporary password + mustChangePassword flag', async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue({ ...baseUser, role: UserRole.PM });

    const result = await createUser({ name: 'A', email: 'new@example.com', role: UserRole.PM });

    expect(db.user.create).toHaveBeenCalledOnce();
    const createArg = db.user.create.mock.calls[0][0];
    expect(createArg.data).toMatchObject({
      name: 'A',
      email: 'new@example.com',
      role: UserRole.PM,
      mustChangePassword: true,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    });
    expect(typeof result.temporaryPassword).toBe('string');
    expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(12);
    expect(result.user).not.toHaveProperty('passwordHash');
  });
});

describe('user.service — getAllUsers', () => {
  it('uses defaults (page 1, limit 10) and computes totalPages', async () => {
    db.user.count.mockResolvedValue(25);
    db.user.findMany.mockResolvedValue([]);

    const result = await getAllUsers();

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10, orderBy: { createdAt: 'desc' } }),
    );
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 25, totalPages: 3 });
  });

  it('builds a case-insensitive search OR and applies role/status filters', async () => {
    db.user.count.mockResolvedValue(0);
    db.user.findMany.mockResolvedValue([]);

    await getAllUsers({ page: 2, limit: 5, search: 'ali', role: UserRole.ADMIN, status: UserStatus.ACTIVE });

    const where = db.user.count.mock.calls[0][0].where;
    expect(where.role).toBe(UserRole.ADMIN);
    expect(where.status).toBe(UserStatus.ACTIVE);
    expect(where.OR).toEqual([
      { name: { contains: 'ali', mode: 'insensitive' } },
      { email: { contains: 'ali', mode: 'insensitive' } },
    ]);
    expect(db.user.findMany.mock.calls[0][0]).toMatchObject({ skip: 5, take: 5 });
  });
});

describe('user.service — updateUser', () => {
  it('throws when the user is missing', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(updateUser('1', { name: 'X' })).rejects.toThrow('User not found');
  });

  it('rejects an email already used by another user', async () => {
    db.user.findUnique
      .mockResolvedValueOnce(baseUser) // getUserById
      .mockResolvedValueOnce({ ...baseUser, id: 2 }); // email lookup
    await expect(updateUser('1', { email: 'taken@example.com' })).rejects.toThrow('Email already exists');
  });

  it('invalidates tokens when the role changes', async () => {
    db.user.findUnique.mockResolvedValue(baseUser); // current role MEMBER
    db.user.update.mockResolvedValue({ ...baseUser, role: UserRole.ADMIN });

    await updateUser('1', { role: UserRole.ADMIN });

    expect(db.user.update.mock.calls[0][0].data).toMatchObject({
      role: UserRole.ADMIN,
      tokenVersion: { increment: 1 },
    });
  });

  it('does not bump tokenVersion for a name-only change', async () => {
    db.user.findUnique.mockResolvedValue(baseUser);
    db.user.update.mockResolvedValue(baseUser);

    await updateUser('1', { name: 'New Name' });

    expect(db.user.update.mock.calls[0][0].data).not.toHaveProperty('tokenVersion');
  });
});

describe('user.service — updateUserStatus', () => {
  it('throws when user not found', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(updateUserStatus('1', UserStatus.BLOCKED)).rejects.toThrow('User not found');
  });

  it('bumps tokenVersion when blocking', async () => {
    db.user.findUnique.mockResolvedValue(baseUser);
    db.user.update.mockResolvedValue(baseUser);
    await updateUserStatus('1', UserStatus.BLOCKED);
    expect(db.user.update.mock.calls[0][0].data).toMatchObject({
      status: UserStatus.BLOCKED,
      tokenVersion: { increment: 1 },
    });
  });

  it('does not bump tokenVersion when re-activating', async () => {
    db.user.findUnique.mockResolvedValue(baseUser);
    db.user.update.mockResolvedValue(baseUser);
    await updateUserStatus('1', UserStatus.ACTIVE);
    expect(db.user.update.mock.calls[0][0].data).not.toHaveProperty('tokenVersion');
  });
});

describe('user.service — resetUserPassword', () => {
  it('throws when user not found', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(resetUserPassword(1)).rejects.toThrow('User not found');
  });

  it('sets a fresh temporary password and forces a change', async () => {
    db.user.findUnique.mockResolvedValue(baseUser);
    db.user.update.mockResolvedValue(baseUser);

    const result = await resetUserPassword(1);

    expect(db.user.update.mock.calls[0][0].data).toMatchObject({
      mustChangePassword: true,
      tokenVersion: { increment: 1 },
    });
    expect(typeof result.temporaryPassword).toBe('string');
  });
});

describe('user.service — deleteUser (soft delete)', () => {
  it('throws when user not found', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(deleteUser(1)).rejects.toThrow('User not found');
  });

  it('blocks the user and bumps tokenVersion instead of hard-deleting', async () => {
    db.user.findUnique.mockResolvedValue(baseUser);
    db.user.update.mockResolvedValue(baseUser);
    await deleteUser(1);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: UserStatus.BLOCKED, tokenVersion: { increment: 1 } },
    });
    expect(db.user.delete).not.toHaveBeenCalled();
  });
});
