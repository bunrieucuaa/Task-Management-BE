import type { TaskPriority, TaskStatus } from '@/generated/prisma/enums';

export type { PaginationParams, PaginatedResult } from './IUser';

export interface TaskListParams {
  page?: number;
  limit?: number;
  projectId?: number;
  assigneeId?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  tagId?: number;
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

/** A task row plus its attached tags (used on read paths: list + detail). */
export const selectTaskWithTags = {
  ...selectTaskListItem,
  tags: { select: { tag: { select: { id: true, name: true } } } },
} as const;

/** Flatten the `tags` join rows (TaskTag) into a plain `tags: [{ id, name }]` array. */
export const flattenTaskTags = <
  T extends { tags?: { tag: { id: number; name: string } | null }[] },
>(
  task: T,
): Omit<T, 'tags'> & { tags: { id: number; name: string }[] } => {
  const { tags, ...rest } = task;
  return {
    ...rest,
    tags: (tags ?? [])
      .map((tt) => tt.tag)
      .filter((t): t is { id: number; name: string } => t !== null),
  };
};
