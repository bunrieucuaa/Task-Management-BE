import type { TaskPriority, TaskStatus } from '@/generated/prisma/enums';

export type { PaginationParams, PaginatedResult } from './IUser';

export interface TaskListParams {
  page?: number;
  limit?: number;
  projectId?: number;
  assigneeId?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  deadlineFrom?: Date;
  deadlineTo?: Date;
  search?: string;
  sortBy?: 'title' | 'status' | 'priority' | 'deadline' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

const userSummarySelect = {
  select: { id: true, name: true, email: true, avatarUrl: true },
} as const;

/** A task row including the people + project it relates to (no sensitive fields). */
export const selectTaskListItem = {
  id: true,
  title: true,
  description: true,
  projectId: true,
  creatorId: true,
  assigneeId: true,
  status: true,
  priority: true,
  deadline: true,
  createdAt: true,
  updatedAt: true,
  creator: userSummarySelect,
  assignee: userSummarySelect,
  project: { select: { id: true, name: true } },
} as const;
