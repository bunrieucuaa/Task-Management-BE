import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaMock } from '@/test/prisma.mock';
import { UserRole, TaskStatus, TaskPriority } from '@/generated/prisma/enums';
import { RESPONSE_CODES } from '@/constants/response-codes.constant';

vi.mock('@/config/prisma', async () => {
  const { createPrismaMock } = await import('@/test/prisma.mock');
  const prisma = createPrismaMock();
  return { prisma, default: prisma };
});

import { prisma } from '@/config/prisma';
import {
  assertTaskAccessById,
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
} from './task.service';

const db = prisma as unknown as PrismaMock;

beforeEach(() => vi.clearAllMocks());

/** Helper: make assertProjectAccess (used internally) succeed for the owner. */
const grantProjectAccess = (ownerId = 1) =>
  db.project.findUnique.mockResolvedValue({ id: 1, ownerId, members: [] });

describe('assertTaskAccessById', () => {
  it('throws TASK_NOT_FOUND for a missing task', async () => {
    db.task.findUnique.mockResolvedValue(null);
    await expect(assertTaskAccessById(1, UserRole.MEMBER, 99)).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.TASK_NOT_FOUND,
    });
  });

  it('allows the creator of an orphan (no-project) task', async () => {
    db.task.findUnique.mockResolvedValue({ id: 5, projectId: null, creatorId: 1 });
    await expect(assertTaskAccessById(1, UserRole.MEMBER, 5)).resolves.toMatchObject({ id: 5 });
  });

  it('forbids a non-creator on an orphan task', async () => {
    db.task.findUnique.mockResolvedValue({ id: 5, projectId: null, creatorId: 2 });
    await expect(assertTaskAccessById(1, UserRole.MEMBER, 5)).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.FORBIDDEN,
    });
  });

  it('delegates to project access for project tasks', async () => {
    db.task.findUnique.mockResolvedValue({ id: 5, projectId: 1, creatorId: 9 });
    grantProjectAccess(1); // user 1 owns project
    await expect(assertTaskAccessById(1, UserRole.MEMBER, 5)).resolves.toMatchObject({ id: 5 });
  });
});

describe('createTask', () => {
  it('rejects an assignee who is not a project member', async () => {
    grantProjectAccess(1);
    db.projectMember.findUnique.mockResolvedValue(null);
    await expect(
      createTask(1, UserRole.MEMBER, { title: 'T', projectId: 1, assigneeId: 7 }),
    ).rejects.toMatchObject({ codeKey: RESPONSE_CODES.VALIDATION_ERROR });
  });

  it('creates a task with defaults when the assignee is a member', async () => {
    grantProjectAccess(1);
    db.projectMember.findUnique.mockResolvedValue({ id: 1 });
    db.task.create.mockResolvedValue({ id: 100, title: 'T' });

    const result = await createTask(1, UserRole.MEMBER, {
      title: 'T',
      projectId: 1,
      assigneeId: 7,
      priority: TaskPriority.HIGH,
    });

    expect(db.task.create.mock.calls[0][0].data).toMatchObject({
      title: 'T',
      projectId: 1,
      creatorId: 1,
      assigneeId: 7,
      priority: TaskPriority.HIGH,
    });
    expect(result).toMatchObject({ id: 100 });
  });
});

describe('getTasks', () => {
  it('verifies access and scopes to a project when projectId is given', async () => {
    grantProjectAccess(1);
    db.task.count.mockResolvedValue(0);
    db.task.findMany.mockResolvedValue([]);

    await getTasks(1, UserRole.MEMBER, { projectId: 1 });

    const where = db.task.count.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ projectId: 1 });
  });

  it('limits non-privileged users to their projects when no projectId is given', async () => {
    db.task.count.mockResolvedValue(0);
    db.task.findMany.mockResolvedValue([]);

    await getTasks(7, UserRole.MEMBER, {});

    const where = db.task.count.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({
      project: { OR: [{ ownerId: 7 }, { members: { some: { userId: 7 } } }] },
    });
  });

  it('filters by tagId via the task_tags relation', async () => {
    db.task.count.mockResolvedValue(0);
    db.task.findMany.mockResolvedValue([]);

    await getTasks(7, UserRole.ADMIN, { tagId: 3 });

    const where = db.task.count.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ tags: { some: { tagId: 3 } } });
  });

  it('flattens the tags join rows into a flat tags array on each row', async () => {
    db.task.count.mockResolvedValue(1);
    db.task.findMany.mockResolvedValue([
      { id: 1, title: 'T', tags: [{ tag: { id: 9, name: 'bug' } }] },
    ]);

    const result = await getTasks(7, UserRole.ADMIN, {});

    expect(result.data[0]).toMatchObject({ id: 1, tags: [{ id: 9, name: 'bug' }] });
  });

  it('applies status, priority and search filters', async () => {
    db.task.count.mockResolvedValue(0);
    db.task.findMany.mockResolvedValue([]);

    await getTasks(7, UserRole.ADMIN, {
      status: TaskStatus.DONE,
      priority: TaskPriority.LOW,
      search: 'fix',
    });

    const where = db.task.count.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ status: TaskStatus.DONE });
    expect(where.AND).toContainEqual({ priority: TaskPriority.LOW });
    expect(where.AND).toContainEqual({
      OR: [
        { title: { contains: 'fix', mode: 'insensitive' } },
        { description: { contains: 'fix', mode: 'insensitive' } },
      ],
    });
  });
});

describe('getTaskById', () => {
  it('throws TASK_NOT_FOUND when missing', async () => {
    db.task.findUnique.mockResolvedValue(null);
    await expect(getTaskById(1, UserRole.MEMBER, 5)).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.TASK_NOT_FOUND,
    });
  });
});

describe('updateTask', () => {
  it('forbids a member who is neither creator nor assignee', async () => {
    db.task.findUnique.mockResolvedValue({ id: 5, projectId: 1, creatorId: 9, assigneeId: 8 });
    grantProjectAccess(9); // has read access via project? owner is 9, user 1 not member
    // assertTaskAccess -> assertProjectAccess: project owner 9, members [] -> user 1 forbidden read first
    await expect(
      updateTask(1, UserRole.MEMBER, 5, { title: 'X' }),
    ).rejects.toMatchObject({ codeKey: RESPONSE_CODES.FORBIDDEN });
  });

  it('lets the creator edit and only sets provided fields', async () => {
    db.task.findUnique.mockResolvedValue({ id: 5, projectId: 1, creatorId: 1, assigneeId: null });
    grantProjectAccess(1);
    db.task.update.mockResolvedValue({ id: 5, status: TaskStatus.DONE });

    await updateTask(1, UserRole.MEMBER, 5, { status: TaskStatus.DONE });

    expect(db.task.update.mock.calls[0][0].data).toEqual({ status: TaskStatus.DONE });
  });

  it('validates a new assignee belongs to the project', async () => {
    db.task.findUnique.mockResolvedValue({ id: 5, projectId: 1, creatorId: 1, assigneeId: null });
    grantProjectAccess(1);
    db.projectMember.findUnique.mockResolvedValue(null);
    await expect(
      updateTask(1, UserRole.MEMBER, 5, { assigneeId: 7 }),
    ).rejects.toMatchObject({ codeKey: RESPONSE_CODES.VALIDATION_ERROR });
  });
});

describe('deleteTask', () => {
  it('throws TASK_NOT_FOUND when missing', async () => {
    db.task.findUnique.mockResolvedValue(null);
    await expect(deleteTask(1, UserRole.MEMBER, 5)).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.TASK_NOT_FOUND,
    });
  });

  it('forbids a non-creator member', async () => {
    db.task.findUnique.mockResolvedValue({ id: 5, creatorId: 9 });
    await expect(deleteTask(1, UserRole.MEMBER, 5)).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.FORBIDDEN,
    });
  });

  it('lets an admin delete any task', async () => {
    db.task.findUnique.mockResolvedValue({ id: 5, creatorId: 9 });
    db.task.delete.mockResolvedValue({});
    await deleteTask(1, UserRole.ADMIN, 5);
    expect(db.task.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });
});
