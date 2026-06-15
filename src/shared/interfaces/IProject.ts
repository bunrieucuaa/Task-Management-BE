import type { ProjectStatus } from '@/generated/prisma/enums';

export type { PaginationParams, PaginatedResult } from './IUser';

// ===== Filter params for listing projects =====
export interface ProjectListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ProjectStatus;
  sortBy?: 'name' | 'status' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// ===== Prisma select shapes (no sensitive fields) =====

const ownerSelect = {
  select: { id: true, name: true, email: true, avatarUrl: true },
} as const;

/** A project row for list views — includes owner summary + member count. */
export const selectProjectListItem = {
  id: true,
  name: true,
  description: true,
  ownerId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  owner: ownerSelect,
  _count: { select: { members: true, tasks: true } },
} as const;

/** A project member row — includes the joined user summary. */
export const selectProjectMember = {
  id: true,
  userId: true,
  role: true,
  joinedAt: true,
  user: ownerSelect,
} as const;

/** Full project detail = list shape + its members. */
export const selectProjectDetail = {
  ...selectProjectListItem,
  members: { select: selectProjectMember, orderBy: { joinedAt: 'asc' } },
} as const;

export const PROJECT_ROLE = {
  OWNER: 'OWNER',
  MEMBER: 'MEMBER',
} as const;
