import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaMock } from '@/test/prisma.mock';
import { UserRole, UserStatus, ProjectStatus } from '@/generated/prisma/enums';
import { RESPONSE_CODES } from '@/constants/response-codes.constant';
import { PROJECT_ROLE } from '@/shared/interfaces/IProject';

vi.mock('@/config/prisma', async () => {
  const { createPrismaMock } = await import('@/test/prisma.mock');
  const prisma = createPrismaMock();
  return { prisma, default: prisma };
});

import { prisma } from '@/config/prisma';
import {
  assertProjectAccess,
  assertProjectManage,
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  archiveProject,
  listMembers,
  addMember,
  removeMember,
} from './project.service';

const db = prisma as unknown as PrismaMock;

beforeEach(() => vi.clearAllMocks());

describe('assertProjectAccess', () => {
  it('throws PROJECT_NOT_FOUND when the project is missing', async () => {
    db.project.findUnique.mockResolvedValue(null);
    await expect(assertProjectAccess(1, UserRole.MEMBER, 99)).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.PROJECT_NOT_FOUND,
    });
  });

  it('throws FORBIDDEN for a non-member, non-owner, non-privileged user', async () => {
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 2, members: [] });
    await expect(assertProjectAccess(1, UserRole.MEMBER, 1)).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.FORBIDDEN,
    });
  });

  it('allows the owner', async () => {
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 1, members: [] });
    await expect(assertProjectAccess(1, UserRole.MEMBER, 1)).resolves.toEqual({ id: 1, ownerId: 1 });
  });

  it('allows a member', async () => {
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 2, members: [{ id: 9 }] });
    await expect(assertProjectAccess(1, UserRole.MEMBER, 1)).resolves.toMatchObject({ id: 1 });
  });

  it('allows a privileged user (PM) even without membership', async () => {
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 2, members: [] });
    await expect(assertProjectAccess(1, UserRole.PM, 1)).resolves.toMatchObject({ id: 1 });
  });
});

describe('assertProjectManage', () => {
  it('throws FORBIDDEN for a member who is not the owner', async () => {
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 2 });
    await expect(assertProjectManage(1, UserRole.MEMBER, 1)).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.FORBIDDEN,
    });
  });

  it('allows the owner and admins', async () => {
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 1 });
    await expect(assertProjectManage(1, UserRole.MEMBER, 1)).resolves.toMatchObject({ id: 1 });
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 2 });
    await expect(assertProjectManage(1, UserRole.ADMIN, 1)).resolves.toMatchObject({ id: 1 });
  });
});

describe('createProject', () => {
  it('creates the project, adds the owner as OWNER and valid members as MEMBER', async () => {
    db.user.findMany.mockResolvedValue([{ id: 2 }]);
    db.project.create.mockResolvedValue({ id: 10 });
    db.projectMember.create.mockResolvedValue({});
    db.projectMember.createMany.mockResolvedValue({ count: 1 });
    db.project.findUniqueOrThrow.mockResolvedValue({ id: 10, name: 'P' });

    const result = await createProject(1, { name: 'P', memberIds: [2, 1] });

    // owner (1) filtered out of the requested member lookup
    expect(db.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: [2] }, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    expect(db.project.create.mock.calls[0][0].data).toMatchObject({
      name: 'P',
      ownerId: 1,
      status: ProjectStatus.ACTIVE,
    });
    expect(db.projectMember.create.mock.calls[0][0].data).toMatchObject({
      projectId: 10,
      userId: 1,
      role: PROJECT_ROLE.OWNER,
    });
    expect(db.projectMember.createMany.mock.calls[0][0].data).toEqual([
      { projectId: 10, userId: 2, role: PROJECT_ROLE.MEMBER },
    ]);
    expect(result).toMatchObject({ id: 10 });
  });

  it('skips the member lookup when no memberIds are provided', async () => {
    db.project.create.mockResolvedValue({ id: 11 });
    db.projectMember.create.mockResolvedValue({});
    db.project.findUniqueOrThrow.mockResolvedValue({ id: 11 });

    await createProject(1, { name: 'Solo' });

    expect(db.user.findMany).not.toHaveBeenCalled();
    expect(db.projectMember.createMany).not.toHaveBeenCalled();
  });
});

describe('getProjects', () => {
  it('scopes the query to owned/member projects for non-privileged users', async () => {
    db.project.count.mockResolvedValue(0);
    db.project.findMany.mockResolvedValue([]);

    await getProjects(7, UserRole.MEMBER, {});

    const where = db.project.count.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({
      OR: [{ ownerId: 7 }, { members: { some: { userId: 7 } } }],
    });
  });

  it('does not scope for privileged users and applies search + status', async () => {
    db.project.count.mockResolvedValue(2);
    db.project.findMany.mockResolvedValue([]);

    const result = await getProjects(7, UserRole.ADMIN, {
      search: 'web',
      status: ProjectStatus.ACTIVE,
      page: 1,
      limit: 20,
    });

    const where = db.project.count.mock.calls[0][0].where;
    // No ownership scope condition for admins
    expect(JSON.stringify(where)).not.toContain('ownerId');
    expect(result.pagination).toMatchObject({ total: 2, totalPages: 1 });
  });
});

describe('getProjectById', () => {
  it('checks access then returns the detail', async () => {
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 1, members: [] });
    db.project.findUniqueOrThrow.mockResolvedValue({ id: 1, name: 'P' });
    const result = await getProjectById(1, UserRole.MEMBER, 1);
    expect(result).toMatchObject({ id: 1 });
  });
});

describe('updateProject / archiveProject', () => {
  it('updateProject only sets provided fields', async () => {
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 1 });
    db.project.update.mockResolvedValue({ id: 1, name: 'New' });

    await updateProject(1, UserRole.ADMIN, 1, { name: 'New' });

    expect(db.project.update.mock.calls[0][0].data).toEqual({ name: 'New' });
  });

  it('archiveProject sets status ARCHIVED (soft delete)', async () => {
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 1 });
    db.project.update.mockResolvedValue({});
    await archiveProject(1, UserRole.ADMIN, 1);
    expect(db.project.update.mock.calls[0][0].data).toEqual({ status: ProjectStatus.ARCHIVED });
  });
});

describe('members', () => {
  it('listMembers requires access then lists ordered by joinedAt', async () => {
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 1, members: [] });
    db.projectMember.findMany.mockResolvedValue([]);
    await listMembers(1, UserRole.MEMBER, 1);
    expect(db.projectMember.findMany.mock.calls[0][0]).toMatchObject({ orderBy: { joinedAt: 'asc' } });
  });

  it('addMember rejects an unknown email', async () => {
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 1 });
    db.user.findUnique.mockResolvedValue(null);
    await expect(addMember(1, UserRole.ADMIN, 1, 'ghost@example.com')).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.USER_NOT_FOUND,
    });
  });

  it('addMember rejects a duplicate member', async () => {
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 1 });
    db.user.findUnique.mockResolvedValue({ id: 5 });
    db.projectMember.findUnique.mockResolvedValue({ id: 1 });
    await expect(addMember(1, UserRole.ADMIN, 1, 'dup@example.com')).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.USER_ALREADY_EXISTS,
    });
  });

  it('addMember adds a new member with MEMBER role', async () => {
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 1 });
    db.user.findUnique.mockResolvedValue({ id: 5 });
    db.projectMember.findUnique.mockResolvedValue(null);
    db.projectMember.create.mockResolvedValue({ id: 2 });
    await addMember(1, UserRole.ADMIN, 1, 'new@example.com');
    expect(db.projectMember.create.mock.calls[0][0].data).toMatchObject({
      projectId: 1,
      userId: 5,
      role: PROJECT_ROLE.MEMBER,
    });
  });

  it('removeMember refuses to remove the owner', async () => {
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 5 });
    await expect(removeMember(1, UserRole.ADMIN, 1, 5)).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.FORBIDDEN,
    });
  });

  it('removeMember throws when the membership is missing', async () => {
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 1 });
    db.projectMember.findUnique.mockResolvedValue(null);
    await expect(removeMember(1, UserRole.ADMIN, 1, 9)).rejects.toMatchObject({
      codeKey: RESPONSE_CODES.USER_NOT_FOUND,
    });
  });

  it('removeMember deletes an existing membership', async () => {
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 1 });
    db.projectMember.findUnique.mockResolvedValue({ id: 3 });
    db.projectMember.delete.mockResolvedValue({});
    await removeMember(1, UserRole.ADMIN, 1, 9);
    expect(db.projectMember.delete).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: 1, userId: 9 } },
    });
  });
});
