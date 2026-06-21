import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaMock } from '@/test/prisma.mock';
import { UserRole } from '@/generated/prisma/enums';
import { RESPONSE_CODES } from '@/constants/response-codes.constant';

vi.mock('@/config/prisma', async () => {
  const { createPrismaMock } = await import('@/test/prisma.mock');
  const prisma = createPrismaMock();
  return { prisma, default: prisma };
});

import { prisma } from '@/config/prisma';
import { logActivity, getTaskActivities, ACTIVITY_ACTIONS } from './activity.service';

const db = prisma as unknown as PrismaMock;

beforeEach(() => vi.clearAllMocks());

const grantTaskAccess = (ownerId = 1) => {
  db.task.findUnique.mockResolvedValue({ id: 5, projectId: 1, creatorId: ownerId });
  db.project.findUnique.mockResolvedValue({ id: 1, ownerId, members: [] });
};

describe('logActivity', () => {
  it('writes an activity row with the given action and values', async () => {
    db.activityLog.create.mockResolvedValue({ id: 1 });
    await logActivity(5, 1, ACTIVITY_ACTIONS.TAG_ADDED, undefined, { tagId: 9 });
    expect(db.activityLog.create.mock.calls[0][0].data).toMatchObject({
      taskId: 5,
      userId: 1,
      action: 'TAG_ADDED',
      newValue: { tagId: 9 },
    });
  });

  it('never throws when the log write fails (best-effort)', async () => {
    db.activityLog.create.mockRejectedValue(new Error('db down'));
    await expect(logActivity(5, 1, ACTIVITY_ACTIONS.TASK_CREATED)).resolves.toBeUndefined();
  });
});

describe('getTaskActivities', () => {
  it('asserts task access then lists newest first', async () => {
    grantTaskAccess(1);
    db.activityLog.count.mockResolvedValue(3);
    db.activityLog.findMany.mockResolvedValue([]);

    const result = await getTaskActivities(1, UserRole.MEMBER, 5, {});

    expect(db.activityLog.findMany.mock.calls[0][0]).toMatchObject({
      where: { taskId: 5 },
      orderBy: { createdAt: 'desc' },
    });
    expect(result.pagination).toMatchObject({ total: 3 });
  });

  it('propagates TASK_NOT_FOUND when the task is missing', async () => {
    db.task.findUnique.mockResolvedValue(null);
    await expect(getTaskActivities(1, UserRole.MEMBER, 99, {})).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.TASK_NOT_FOUND,
    });
  });
});
