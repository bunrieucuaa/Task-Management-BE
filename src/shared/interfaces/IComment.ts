export type { PaginationParams, PaginatedResult } from './IUser';

export interface CommentListParams {
  page?: number;
  limit?: number;
}

/** A comment row including its author summary (no sensitive fields). */
export const selectCommentItem = {
  id: true,
  taskId: true,
  userId: true,
  content: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
} as const;
