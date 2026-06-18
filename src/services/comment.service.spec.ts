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
import { getComments, createComment, deleteComment } from './comment.service';

const db = prisma as unknown as PrismaMock;

beforeEach(() => vi.clearAllMocks());

/** task #5 belongs to project #1 owned by `ownerId`, granting that user access. */
const grantTaskAccess = (ownerId = 1) => {
  db.task.findUnique.mockResolvedValue({ id: 5, projectId: 1, creatorId: ownerId });
  db.project.findUnique.mockResolvedValue({ id: 1, ownerId, members: [] });
};

describe('getComments', () => {
  it('requires task access then lists comments ordered by createdAt asc', async () => {
    grantTaskAccess(1);
    db.taskComment.count.mockResolvedValue(2);
    db.taskComment.findMany.mockResolvedValue([]);

    const result = await getComments(1, UserRole.MEMBER, 5, {});

    expect(db.taskComment.findMany.mock.calls[0][0]).toMatchObject({
      where: { taskId: 5 },
      orderBy: { createdAt: 'asc' },
    });
    expect(result.pagination).toMatchObject({ total: 2 });
  });

  it('propagates TASK_NOT_FOUND when the parent task is missing', async () => {
    db.task.findUnique.mockResolvedValue(null);
    await expect(getComments(1, UserRole.MEMBER, 99, {})).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.TASK_NOT_FOUND,
    });
  });
});

describe('createComment', () => {
  it('creates a comment for a user with task access', async () => {
    grantTaskAccess(1);
    db.taskComment.create.mockResolvedValue({ id: 1, content: 'hi' });

    await createComment(1, UserRole.MEMBER, 5, { content: 'hi' });

    expect(db.taskComment.create.mock.calls[0][0].data).toMatchObject({
      taskId: 5,
      userId: 1,
      content: 'hi',
    });
  });
});

describe('deleteComment', () => {
  it('throws COMMENT_NOT_FOUND when the comment does not exist', async () => {
    grantTaskAccess(1);
    db.taskComment.findUnique.mockResolvedValue(null);
    await expect(deleteComment(1, UserRole.MEMBER, 5, 7)).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.COMMENT_NOT_FOUND,
    });
  });

  it('throws COMMENT_NOT_FOUND when the comment belongs to another task', async () => {
    grantTaskAccess(1);
    db.taskComment.findUnique.mockResolvedValue({ id: 7, taskId: 99, userId: 1 });
    await expect(deleteComment(1, UserRole.MEMBER, 5, 7)).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.COMMENT_NOT_FOUND,
    });
  });

  it('forbids deleting another user\'s comment as a plain member', async () => {
    grantTaskAccess(1);
    db.taskComment.findUnique.mockResolvedValue({ id: 7, taskId: 5, userId: 2 });
    await expect(deleteComment(1, UserRole.MEMBER, 5, 7)).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.FORBIDDEN,
    });
  });

  it('lets the author delete their own comment', async () => {
    grantTaskAccess(1);
    db.taskComment.findUnique.mockResolvedValue({ id: 7, taskId: 5, userId: 1 });
    db.taskComment.delete.mockResolvedValue({});
    await deleteComment(1, UserRole.MEMBER, 5, 7);
    expect(db.taskComment.delete).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it('lets a privileged role (PM) delete any comment', async () => {
    grantTaskAccess(1);
    db.taskComment.findUnique.mockResolvedValue({ id: 7, taskId: 5, userId: 2 });
    db.taskComment.delete.mockResolvedValue({});
    await deleteComment(1, UserRole.PM, 5, 7);
    expect(db.taskComment.delete).toHaveBeenCalledOnce();
  });
});
