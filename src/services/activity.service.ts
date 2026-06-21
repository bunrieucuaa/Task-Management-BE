import { prisma } from '@/config/prisma';
import type { Prisma } from '@/generated/prisma/client';
import type { UserRole } from '@/generated/prisma/enums';
import {
  selectActivityItem,
  type ActivityListParams,
  type PaginatedResult,
} from '@/shared/interfaces/IActivity';
import { assertTaskAccessById } from './task.service';

type ActivityItem = Prisma.ActivityLogGetPayload<{ select: typeof selectActivityItem }>;

/** Activity action codes (FE maps these to human-readable Vietnamese strings). */
export const ACTIVITY_ACTIONS = {
  TASK_CREATED: 'TASK_CREATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  ASSIGNEE_CHANGED: 'ASSIGNEE_CHANGED',
  DEADLINE_CHANGED: 'DEADLINE_CHANGED',
  PRIORITY_CHANGED: 'PRIORITY_CHANGED',
  TAG_ADDED: 'TAG_ADDED',
  TAG_REMOVED: 'TAG_REMOVED',
} as const;

/**
 * Best-effort write of an activity-log entry. A logging failure must never break
 * the surrounding mutation, so errors are swallowed with a warning.
 */
export const logActivity = async (
  taskId: number,
  userId: number,
  action: string,
  oldValue?: Prisma.InputJsonValue,
  newValue?: Prisma.InputJsonValue,
): Promise<void> => {
  try {
    await prisma.activityLog.create({
      data: {
        taskId,
        userId,
        action,
        ...(oldValue !== undefined && { oldValue }),
        ...(newValue !== undefined && { newValue }),
      },
    });
  } catch (err) {
    console.warn('[activity] failed to write log', err);
  }
};

/** List a task's activity history (newest first). Requires read access to the task. */
export const getTaskActivities = async (
  userId: number,
  role: UserRole | null,
  taskId: number,
  params: ActivityListParams = {},
): Promise<PaginatedResult<ActivityItem>> => {
  await assertTaskAccessById(userId, role, taskId);

  const { page = 1, limit = 20 } = params;
  const where: Prisma.ActivityLogWhereInput = { taskId };

  const total = await prisma.activityLog.count({ where });
  const data = await prisma.activityLog.findMany({
    where,
    select: selectActivityItem,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};
