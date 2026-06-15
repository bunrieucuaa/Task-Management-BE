import { prisma } from '@/config/prisma';
import type { Prisma } from '@/generated/prisma/client';
import type { UserRole } from '@/generated/prisma/enums';
import { RESPONSE_CODES } from '@/constants/response-codes.constant';
import { ServiceError } from '@/shared/errors/service-error';
import { isPrivileged } from '@/shared/auth/roles';
import {
  selectCommentItem,
  type CommentListParams,
  type PaginatedResult,
} from '@/shared/interfaces/IComment';
import type { CreateCommentDto } from '@/dtos/comment.dto';
import { assertTaskAccessById } from './task.service';

type CommentItem = Prisma.TaskCommentGetPayload<{ select: typeof selectCommentItem }>;

export const getComments = async (
  userId: number,
  role: UserRole | null,
  taskId: number,
  params: CommentListParams = {},
): Promise<PaginatedResult<CommentItem>> => {
  // Reading comments requires read access to the parent task.
  await assertTaskAccessById(userId, role, taskId);

  const { page = 1, limit = 50 } = params;
  const where: Prisma.TaskCommentWhereInput = { taskId };

  const total = await prisma.taskComment.count({ where });

  const data = await prisma.taskComment.findMany({
    where,
    select: selectCommentItem,
    orderBy: { createdAt: 'asc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const createComment = async (
  userId: number,
  role: UserRole | null,
  taskId: number,
  dto: CreateCommentDto,
): Promise<CommentItem> => {
  // Anyone who can read the task may comment on it.
  await assertTaskAccessById(userId, role, taskId);

  return prisma.taskComment.create({
    data: { taskId, userId, content: dto.content },
    select: selectCommentItem,
  });
};

export const deleteComment = async (
  userId: number,
  role: UserRole | null,
  taskId: number,
  commentId: number,
): Promise<void> => {
  await assertTaskAccessById(userId, role, taskId);

  const comment = await prisma.taskComment.findUnique({
    where: { id: commentId },
    select: { id: true, taskId: true, userId: true },
  });
  if (!comment || comment.taskId !== taskId) {
    throw new ServiceError(RESPONSE_CODES.COMMENT_NOT_FOUND);
  }

  // Only the author or a privileged role (ADMIN/PM) may delete a comment.
  if (!isPrivileged(role) && comment.userId !== userId) {
    throw new ServiceError(RESPONSE_CODES.FORBIDDEN, 'You can only delete your own comments');
  }

  await prisma.taskComment.delete({ where: { id: commentId } });
};
