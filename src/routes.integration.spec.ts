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
import { signAccessToken } from '@/utils/jwt.util';
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

const auth = (role: UserRole) => `Bearer ${tokenFor(role)}`;

beforeAll(async () => {
  salt = generateSalt();
  hash = await hashPassword(PASSWORD, salt);
});

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
describe('project routes', () => {
  it('GET /api/v1/projects → 200 with a paginated list', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.ADMIN }));
    db.project.count.mockResolvedValue(0);
    db.project.findMany.mockResolvedValue([]);
    const res = await request(app).get('/api/v1/projects').set('Authorization', auth(UserRole.ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pagination).toMatchObject({ page: 1, total: 0 });
  });

  it('POST /api/v1/projects → 403 for a MEMBER (manage = ADMIN/PM only)', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.MEMBER }));
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', auth(UserRole.MEMBER))
      .send({ name: 'New project' });
    expect(res.status).toBe(403);
    expect(db.project.create).not.toHaveBeenCalled();
  });

  it('POST /api/v1/projects → 201 for a PM and adds the owner as a member', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.PM }));
    db.project.create.mockResolvedValue({ id: 10 });
    db.projectMember.create.mockResolvedValue({ id: 1 });
    db.project.findUniqueOrThrow.mockResolvedValue({ id: 10, name: 'New project', ownerId: 1 });
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', auth(UserRole.PM))
      .send({ name: 'New project' });
    expect(res.status).toBe(201);
    expect(res.body.data.project).toMatchObject({ id: 10 });
    // The creator is registered as a project member (OWNER) inside the transaction.
    expect(db.projectMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 1 }) }),
    );
  });

  it('POST /api/v1/projects → 400 on validation failure (empty name)', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.PM }));
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', auth(UserRole.PM))
      .send({ name: '' });
    expect(res.status).toBe(400);
    expect(db.project.create).not.toHaveBeenCalled();
  });

  it('GET /api/v1/projects/:id → 400 for a non-numeric id', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.ADMIN }));
    const res = await request(app).get('/api/v1/projects/abc').set('Authorization', auth(UserRole.ADMIN));
    expect(res.status).toBe(400);
  });

  it('GET /api/v1/projects/:id → 404 when the project does not exist', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.ADMIN }));
    db.project.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/projects/99').set('Authorization', auth(UserRole.ADMIN));
    expect(res.status).toBe(404);
  });

  it('PATCH /api/v1/projects/:id → 200 for an authorized PM', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.PM }));
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 1 });
    db.project.update.mockResolvedValue({ id: 1, name: 'Renamed' });
    const res = await request(app)
      .patch('/api/v1/projects/1')
      .set('Authorization', auth(UserRole.PM))
      .send({ name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.data.project).toMatchObject({ name: 'Renamed' });
  });

  it('POST /api/v1/projects/:id/members → 201 when adding an existing user by email', async () => {
    // authenticate() looks up by id; addMember() looks up the target by email.
    db.user.findUnique.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(
        where.email
          ? { ...dbUser({ id: 2, email: 'bob@example.com' }) }
          : dbUser({ role: UserRole.PM }),
      ),
    );
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 1 });
    db.projectMember.findUnique.mockResolvedValue(null); // not already a member
    db.projectMember.create.mockResolvedValue({ id: 9, userId: 2 });
    const res = await request(app)
      .post('/api/v1/projects/1/members')
      .set('Authorization', auth(UserRole.PM))
      .send({ email: 'bob@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.data.member).toMatchObject({ userId: 2 });
  });

  it('POST /api/v1/projects/:id/members → 404 when no user has that email', async () => {
    db.user.findUnique.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(where.email ? null : dbUser({ role: UserRole.PM })),
    );
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 1 });
    const res = await request(app)
      .post('/api/v1/projects/1/members')
      .set('Authorization', auth(UserRole.PM))
      .send({ email: 'ghost@example.com' });
    expect(res.status).toBe(404);
    expect(db.projectMember.create).not.toHaveBeenCalled();
  });

  it('DELETE /api/v1/projects/:id → 200 soft-deletes (archives) the project', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.PM }));
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 1 });
    db.project.update.mockResolvedValue({ id: 1, status: 'ARCHIVED' });
    const res = await request(app).delete('/api/v1/projects/1').set('Authorization', auth(UserRole.PM));
    expect(res.status).toBe(200);
    // Soft delete = status flip, not a row removal.
    expect(db.project.delete).not.toHaveBeenCalled();
    expect(db.project.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ARCHIVED' }) }),
    );
  });

  it('DELETE /api/v1/projects/:id/members/:userId → 403 when removing the owner', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.PM }));
    // The target user IS the project owner → removal is forbidden.
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 2 });
    const res = await request(app)
      .delete('/api/v1/projects/1/members/2')
      .set('Authorization', auth(UserRole.PM));
    expect(res.status).toBe(403);
    expect(db.projectMember.delete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
describe('task routes', () => {
  it('GET /api/v1/tasks → 200 (ADMIN sees all, no project filter)', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.ADMIN }));
    db.task.count.mockResolvedValue(0);
    db.task.findMany.mockResolvedValue([]);
    const res = await request(app).get('/api/v1/tasks').set('Authorization', auth(UserRole.ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.data.pagination).toMatchObject({ total: 0 });
  });

  it('GET /api/v1/tasks/:id → 404 when the task is missing', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.MEMBER }));
    db.task.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/tasks/99').set('Authorization', auth(UserRole.MEMBER));
    expect(res.status).toBe(404);
  });

  it('POST /api/v1/tasks → 201 when the creator has project access', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.MEMBER }));
    // assertProjectAccess: user is a member of project 1.
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 5, members: [{ id: 1 }] });
    db.task.create.mockResolvedValue({ id: 7, title: 'T', projectId: 1 });
    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', auth(UserRole.MEMBER))
      .send({ title: 'T', projectId: 1 });
    expect(res.status).toBe(201);
    expect(res.body.data.task).toMatchObject({ id: 7 });
  });

  it('POST /api/v1/tasks → 403 when the creator has no project access', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.MEMBER }));
    // Not the owner and not a member → access denied in the service layer.
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 5, members: [] });
    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', auth(UserRole.MEMBER))
      .send({ title: 'T', projectId: 1 });
    expect(res.status).toBe(403);
    expect(db.task.create).not.toHaveBeenCalled();
  });

  it('PATCH /api/v1/tasks/:id → 200 when edited by its creator', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.MEMBER }));
    // Orphan task created by the requester → access + edit rights.
    db.task.findUnique.mockResolvedValue({ id: 1, projectId: null, creatorId: 1, assigneeId: null });
    db.task.update.mockResolvedValue({ id: 1, title: 'Updated' });
    const res = await request(app)
      .patch('/api/v1/tasks/1')
      .set('Authorization', auth(UserRole.MEMBER))
      .send({ title: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.data.task).toMatchObject({ title: 'Updated' });
  });

  it('GET /api/v1/tasks?projectId=1 → 200 when the user can access that project', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.MEMBER }));
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 5, members: [{ id: 1 }] });
    db.task.count.mockResolvedValue(0);
    db.task.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get('/api/v1/tasks?projectId=1')
      .set('Authorization', auth(UserRole.MEMBER));
    expect(res.status).toBe(200);
  });

  it('GET /api/v1/tasks?projectId=1 → 403 when the user cannot access that project', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.MEMBER }));
    db.project.findUnique.mockResolvedValue({ id: 1, ownerId: 5, members: [] });
    const res = await request(app)
      .get('/api/v1/tasks?projectId=1')
      .set('Authorization', auth(UserRole.MEMBER));
    expect(res.status).toBe(403);
    expect(db.task.findMany).not.toHaveBeenCalled();
  });

  it('GET /api/v1/tasks?status=TODO&priority=HIGH → 200 and passes the filters to the query', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.ADMIN }));
    db.task.count.mockResolvedValue(0);
    db.task.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get('/api/v1/tasks?status=TODO&priority=HIGH')
      .set('Authorization', auth(UserRole.ADMIN));
    expect(res.status).toBe(200);
    // Filters land in the prisma `where.AND` conditions.
    const whereArg = db.task.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(whereArg)).toContain('TODO');
    expect(JSON.stringify(whereArg)).toContain('HIGH');
  });
});

// ---------------------------------------------------------------------------
// Token revocation (soft logout via tokenVersion)
// ---------------------------------------------------------------------------
describe('token revocation', () => {
  it('401 when the token tokenVersion is stale (e.g. after logout/password change)', async () => {
    // Token minted at version 0, but the stored user has advanced to version 5.
    db.user.findUnique.mockResolvedValue(dbUser({ tokenVersion: 5 }));
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', auth(UserRole.MEMBER));
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Comments (nested under /tasks/:taskId/comments)
// ---------------------------------------------------------------------------
describe('comment routes', () => {
  // Orphan task (projectId null) created by the requester → simplest access path.
  const ownTask = { id: 1, projectId: null, creatorId: 1 };

  it('GET /api/v1/tasks/:taskId/comments → 200', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.MEMBER }));
    db.task.findUnique.mockResolvedValue(ownTask);
    db.taskComment.count.mockResolvedValue(1);
    db.taskComment.findMany.mockResolvedValue([{ id: 1, content: 'hi' }]);
    const res = await request(app)
      .get('/api/v1/tasks/1/comments')
      .set('Authorization', auth(UserRole.MEMBER));
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
  });

  it('POST /api/v1/tasks/:taskId/comments → 201', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.MEMBER }));
    db.task.findUnique.mockResolvedValue(ownTask);
    db.taskComment.create.mockResolvedValue({ id: 2, content: 'new' });
    const res = await request(app)
      .post('/api/v1/tasks/1/comments')
      .set('Authorization', auth(UserRole.MEMBER))
      .send({ content: 'new' });
    expect(res.status).toBe(201);
    expect(res.body.data.comment).toMatchObject({ id: 2 });
  });

  it('POST /api/v1/tasks/:taskId/comments → 400 on empty content', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.MEMBER }));
    db.task.findUnique.mockResolvedValue(ownTask);
    const res = await request(app)
      .post('/api/v1/tasks/1/comments')
      .set('Authorization', auth(UserRole.MEMBER))
      .send({ content: '' });
    expect(res.status).toBe(400);
    expect(db.taskComment.create).not.toHaveBeenCalled();
  });

  it('DELETE /api/v1/tasks/:taskId/comments/:id → 403 deleting someone else\'s comment', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.MEMBER }));
    db.task.findUnique.mockResolvedValue(ownTask);
    // Comment authored by a different user; requester is a plain MEMBER.
    db.taskComment.findUnique.mockResolvedValue({ id: 3, taskId: 1, userId: 2 });
    const res = await request(app)
      .delete('/api/v1/tasks/1/comments/3')
      .set('Authorization', auth(UserRole.MEMBER));
    expect(res.status).toBe(403);
    expect(db.taskComment.delete).not.toHaveBeenCalled();
  });

  it('DELETE /api/v1/tasks/:taskId/comments/:id → 200 deleting your own comment', async () => {
    db.user.findUnique.mockResolvedValue(dbUser({ role: UserRole.MEMBER }));
    db.task.findUnique.mockResolvedValue(ownTask);
    db.taskComment.findUnique.mockResolvedValue({ id: 3, taskId: 1, userId: 1 });
    db.taskComment.delete.mockResolvedValue({ id: 3 });
    const res = await request(app)
      .delete('/api/v1/tasks/1/comments/3')
      .set('Authorization', auth(UserRole.MEMBER));
    expect(res.status).toBe(200);
    expect(db.taskComment.delete).toHaveBeenCalled();
  });
});
