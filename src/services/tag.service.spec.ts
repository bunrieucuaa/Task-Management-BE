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
import {
  getTags,
  createTag,
  deleteTag,
  attachTagToTask,
  detachTagFromTask,
} from './tag.service';

const db = prisma as unknown as PrismaMock;

beforeEach(() => vi.clearAllMocks());

/** Make task #5 EDITABLE by `editorId` (they are the creator). */
const grantTaskEditable = (editorId = 1) => {
  db.task.findUnique.mockResolvedValue({ id: 5, projectId: 1, creatorId: editorId, assigneeId: null });
  db.project.findUnique.mockResolvedValue({ id: 1, ownerId: editorId, members: [] });
};

describe('getTags', () => {
  it('lists the catalogue ordered by name', async () => {
    db.tag.findMany.mockResolvedValue([{ id: 1, name: 'bug' }]);
    const tags = await getTags();
    expect(db.tag.findMany.mock.calls[0][0]).toMatchObject({ orderBy: { name: 'asc' } });
    expect(tags).toEqual([{ id: 1, name: 'bug' }]);
  });
});

describe('createTag', () => {
  it('lets a privileged role (PM) create a new tag', async () => {
    db.tag.findUnique.mockResolvedValue(null);
    db.tag.create.mockResolvedValue({ id: 2, name: 'urgent' });

    const tag = await createTag(UserRole.PM, { name: 'urgent' });

    expect(db.tag.create.mock.calls[0][0].data).toMatchObject({ name: 'urgent' });
    expect(tag).toEqual({ id: 2, name: 'urgent' });
  });

  it('rejects a duplicate name with TAG_ALREADY_EXISTS', async () => {
    db.tag.findUnique.mockResolvedValue({ id: 9 });
    await expect(createTag(UserRole.ADMIN, { name: 'bug' })).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.TAG_ALREADY_EXISTS,
    });
  });

  it('forbids a plain member from creating tags', async () => {
    await expect(createTag(UserRole.MEMBER, { name: 'x' })).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.FORBIDDEN,
    });
    expect(db.tag.create).not.toHaveBeenCalled();
  });
});

describe('deleteTag', () => {
  it('lets an admin delete an existing tag', async () => {
    db.tag.findUnique.mockResolvedValue({ id: 3 });
    db.tag.delete.mockResolvedValue({});
    await deleteTag(UserRole.ADMIN, 3);
    expect(db.tag.delete).toHaveBeenCalledWith({ where: { id: 3 } });
  });

  it('throws TAG_NOT_FOUND for a missing tag', async () => {
    db.tag.findUnique.mockResolvedValue(null);
    await expect(deleteTag(UserRole.ADMIN, 99)).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.TAG_NOT_FOUND,
    });
  });

  it('forbids a PM (non-admin) from deleting tags', async () => {
    await expect(deleteTag(UserRole.PM, 3)).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.FORBIDDEN,
    });
    expect(db.tag.delete).not.toHaveBeenCalled();
  });
});

describe('attachTagToTask', () => {
  it('attaches a tag for a user who can edit the task', async () => {
    grantTaskEditable(1);
    db.tag.findUnique.mockResolvedValue({ id: 7 });
    db.taskTag.findUnique.mockResolvedValue(null);
    db.taskTag.create.mockResolvedValue({ id: 1 });

    await attachTagToTask(1, UserRole.MEMBER, 5, 7);

    expect(db.taskTag.create.mock.calls[0][0].data).toMatchObject({ taskId: 5, tagId: 7 });
  });

  it('throws TAG_NOT_FOUND when the tag does not exist', async () => {
    grantTaskEditable(1);
    db.tag.findUnique.mockResolvedValue(null);
    await expect(attachTagToTask(1, UserRole.MEMBER, 5, 99)).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.TAG_NOT_FOUND,
    });
  });

  it('throws TAG_ALREADY_ATTACHED when the link already exists', async () => {
    grantTaskEditable(1);
    db.tag.findUnique.mockResolvedValue({ id: 7 });
    db.taskTag.findUnique.mockResolvedValue({ id: 1 });
    await expect(attachTagToTask(1, UserRole.MEMBER, 5, 7)).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.TAG_ALREADY_ATTACHED,
    });
  });

  it('forbids a member who cannot edit the task', async () => {
    // creator is user #2, acting user #1 is only a project member (read, not edit).
    db.task.findUnique.mockResolvedValue({ id: 5, projectId: 1, creatorId: 2, assigneeId: null });
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 2, members: [{ id: 1 }] });
    await expect(attachTagToTask(1, UserRole.MEMBER, 5, 7)).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.FORBIDDEN,
    });
    expect(db.taskTag.create).not.toHaveBeenCalled();
  });
});

describe('detachTagFromTask', () => {
  it('removes the link for a user who can edit the task', async () => {
    grantTaskEditable(1);
    db.taskTag.deleteMany.mockResolvedValue({ count: 1 });
    await detachTagFromTask(1, UserRole.MEMBER, 5, 7);
    expect(db.taskTag.deleteMany).toHaveBeenCalledWith({ where: { taskId: 5, tagId: 7 } });
  });
});
