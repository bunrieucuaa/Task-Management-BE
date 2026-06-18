import { describe, it, expect } from 'vitest';
import { UserRole, UserStatus } from '@/generated/prisma/enums';
import {
  LoginRequestSchema,
  ChangePasswordRequestSchema,
  RefreshTokenRequestSchema,
} from './auth.dto';
import { CreateUserSchema, UpdateUserSchema, ListUsersQuerySchema } from './user.dto';
import { CreateProjectSchema, UpdateProjectSchema, AddMemberSchema } from './project.dto';
import { CreateTaskSchema, ListTasksQuerySchema } from './task.dto';
import { CreateCommentSchema } from './comment.dto';

describe('auth DTOs', () => {
  it('LoginRequestSchema requires a valid email and non-empty password', () => {
    expect(LoginRequestSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
    expect(LoginRequestSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
    expect(LoginRequestSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });

  it('ChangePasswordRequestSchema enforces 8..128 chars on newPassword', () => {
    expect(
      ChangePasswordRequestSchema.safeParse({ oldPassword: 'old', newPassword: 'short' }).success,
    ).toBe(false);
    expect(
      ChangePasswordRequestSchema.safeParse({ oldPassword: 'old', newPassword: 'longenough' }).success,
    ).toBe(true);
  });

  it('RefreshTokenRequestSchema requires a token', () => {
    expect(RefreshTokenRequestSchema.safeParse({ refreshToken: '' }).success).toBe(false);
    expect(RefreshTokenRequestSchema.safeParse({ refreshToken: 'abc' }).success).toBe(true);
  });
});

describe('user DTOs', () => {
  it('CreateUserSchema defaults role to MEMBER', () => {
    const parsed = CreateUserSchema.parse({ name: 'A', email: 'a@b.com' });
    expect(parsed.role).toBe(UserRole.MEMBER);
  });

  it('CreateUserSchema rejects invalid email / empty name', () => {
    expect(CreateUserSchema.safeParse({ name: '', email: 'a@b.com' }).success).toBe(false);
    expect(CreateUserSchema.safeParse({ name: 'A', email: 'x' }).success).toBe(false);
  });

  it('UpdateUserSchema requires at least one field', () => {
    expect(UpdateUserSchema.safeParse({}).success).toBe(false);
    expect(UpdateUserSchema.safeParse({ name: 'New' }).success).toBe(true);
  });

  it('ListUsersQuerySchema coerces page/limit and applies sort defaults', () => {
    const parsed = ListUsersQuerySchema.parse({ page: '2', limit: '5', search: '' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(5);
    expect(parsed.sortBy).toBe('createdAt');
    expect(parsed.sortOrder).toBe('desc');
    expect(parsed.search).toBeUndefined();
  });

  it('ListUsersQuerySchema rejects an invalid status enum', () => {
    expect(ListUsersQuerySchema.safeParse({ status: 'NOPE' }).success).toBe(false);
    expect(ListUsersQuerySchema.safeParse({ status: UserStatus.ACTIVE }).success).toBe(true);
  });
});

describe('project DTOs', () => {
  it('CreateProjectSchema trims name and coerces memberIds', () => {
    const parsed = CreateProjectSchema.parse({ name: '  Web  ', memberIds: ['1', '2'] });
    expect(parsed.name).toBe('Web');
    expect(parsed.memberIds).toEqual([1, 2]);
  });

  it('CreateProjectSchema rejects empty name', () => {
    expect(CreateProjectSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('UpdateProjectSchema requires at least one field', () => {
    expect(UpdateProjectSchema.safeParse({}).success).toBe(false);
  });

  it('AddMemberSchema requires a valid email', () => {
    expect(AddMemberSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
    expect(AddMemberSchema.safeParse({ email: 'bad' }).success).toBe(false);
  });
});

describe('task DTOs', () => {
  it('CreateTaskSchema coerces projectId and date', () => {
    const parsed = CreateTaskSchema.parse({
      title: 'T',
      projectId: '7',
      deadline: '2026-01-01',
    });
    expect(parsed.projectId).toBe(7);
    expect(parsed.deadline).toBeInstanceOf(Date);
  });

  it('CreateTaskSchema rejects non-positive projectId', () => {
    expect(CreateTaskSchema.safeParse({ title: 'T', projectId: '0' }).success).toBe(false);
  });

  it('ListTasksQuerySchema turns empty strings into undefined', () => {
    const parsed = ListTasksQuerySchema.parse({ projectId: '', status: '', assigneeId: '3' });
    expect(parsed.projectId).toBeUndefined();
    expect(parsed.status).toBeUndefined();
    expect(parsed.assigneeId).toBe(3);
  });
});

describe('comment DTOs', () => {
  it('CreateCommentSchema requires 1..5000 trimmed chars', () => {
    expect(CreateCommentSchema.safeParse({ content: '   ' }).success).toBe(false);
    expect(CreateCommentSchema.safeParse({ content: 'hi' }).success).toBe(true);
  });
});
