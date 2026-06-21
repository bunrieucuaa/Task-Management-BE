export type { PaginationParams, PaginatedResult } from './IUser';

export interface ActivityListParams {
  page?: number;
  limit?: number;
}

/** An activity-log row including the actor summary (no sensitive fields). */
export const selectActivityItem = {
  id: true,
  taskId: true,
  userId: true,
  action: true,
  oldValue: true,
  newValue: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
} as const;
