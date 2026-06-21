import { prisma } from '@/config/prisma';
import type { Prisma } from '@/generated/prisma/client';
import type { UserRole } from '@/generated/prisma/enums';
import { RESPONSE_CODES } from '@/constants/response-codes.constant';
import { ServiceError } from '@/shared/errors/service-error';
import { isPrivileged } from '@/shared/auth/roles';
import {
  selectTaskListItem,
  selectTaskWithTags,
  flattenTaskTags,
  type PaginatedResult,
  type TaskListParams,
} from '@/shared/interfaces/ITask';
import type { CreateTaskDto, UpdateTaskDto } from '@/dtos/task.dto';
import { assertProjectAccess } from './project.service';
import { logActivity, ACTIVITY_ACTIONS } from './activity.service';

type TaskItem = Prisma.TaskGetPayload<{ select: typeof selectTaskListItem }>;
type TaskWithTags = Omit<
  Prisma.TaskGetPayload<{ select: typeof selectTaskWithTags }>,
  'tags'
> & { tags: { id: number; name: string }[] };

/** Assignee must already be a member of the task's project. */
const assertAssigneeIsMember = async (projectId: number, assigneeId: number): Promise<void> => {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: assigneeId } },
    select: { id: true },
  });
  if (!member) {
    throw new ServiceError(
      RESPONSE_CODES.VALIDATION_ERROR,
      'Assignee must be a member of the project',
    );
  }
};

/** Read access to a task = access to its project (or admin/creator for orphan tasks). */
const assertTaskAccess = async (
  userId: number,
  role: UserRole | null,
  task: { projectId: number | null; creatorId: number | null },
): Promise<void> => {
  if (task.projectId == null) {
    if (!isPrivileged(role) && task.creatorId !== userId) {
      throw new ServiceError(RESPONSE_CODES.FORBIDDEN, 'You do not have access to this task');
    }
    return;
  }
  await assertProjectAccess(userId, role, task.projectId);
};

/**
 * Load a task by id and assert the user may read it. Throws TASK_NOT_FOUND /
 * FORBIDDEN. Exposed so sub-resources (comments, ...) can reuse the same gate.
 */
export const assertTaskAccessById = async (
  userId: number,
  role: UserRole | null,
  taskId: number,
): Promise<{ id: number; projectId: number | null; creatorId: number | null }> => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, creatorId: true },
  });
  if (!task) {
    throw new ServiceError(RESPONSE_CODES.TASK_NOT_FOUND);
  }
  await assertTaskAccess(userId, role, task);
  return task;
};

/**
 * Load a task and assert the user may EDIT it (creator, current assignee, or a
 * privileged role). Throws TASK_NOT_FOUND / FORBIDDEN. Exposed so sub-resources
 * that mutate a task (tags, ...) can reuse the same gate as updateTask.
 */
export const assertTaskEditable = async (
  userId: number,
  role: UserRole | null,
  taskId: number,
) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      creatorId: true,
      assigneeId: true,
      status: true,
      priority: true,
      deadline: true,
    },
  });
  if (!task) {
    throw new ServiceError(RESPONSE_CODES.TASK_NOT_FOUND);
  }

  await assertTaskAccess(userId, role, task);

  const canEdit =
    isPrivileged(role) || task.creatorId === userId || task.assigneeId === userId;
  if (!canEdit) {
    throw new ServiceError(RESPONSE_CODES.FORBIDDEN, 'You are not allowed to edit this task');
  }

  return task;
};

export const createTask = async (
  creatorId: number,
  role: UserRole | null,
  dto: CreateTaskDto,
): Promise<TaskItem> => {
  await assertProjectAccess(creatorId, role, dto.projectId);

  if (dto.assigneeId != null) {
    await assertAssigneeIsMember(dto.projectId, dto.assigneeId);
  }

  const created = await prisma.task.create({
    data: {
      title: dto.title,
      description: dto.description ?? null,
      projectId: dto.projectId,
      creatorId,
      assigneeId: dto.assigneeId ?? null,
      ...(dto.priority && { priority: dto.priority }),
      deadline: dto.deadline ?? null,
    },
    select: selectTaskListItem,
  });

  await logActivity(created.id, creatorId, ACTIVITY_ACTIONS.TASK_CREATED, undefined, {
    title: created.title,
  });

  return created;
};

export const getTasks = async (
  userId: number,
  role: UserRole | null,
  params: TaskListParams = {},
): Promise<PaginatedResult<TaskWithTags>> => {
  const {
    page = 1,
    limit = 20,
    projectId,
    assigneeId,
    status,
    priority,
    tagId,
    deadlineFrom,
    deadlineTo,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = params;

  const conditions: Prisma.TaskWhereInput[] = [];

  if (projectId !== undefined) {
    // Explicit project → verify access once, then scope to it.
    await assertProjectAccess(userId, role, projectId);
    conditions.push({ projectId });
  } else if (!isPrivileged(role)) {
    // No project filter → limit to tasks in projects the user belongs to.
    conditions.push({
      project: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    });
  }

  if (assigneeId !== undefined) {
    conditions.push({ assigneeId });
  }
  if (status) {
    conditions.push({ status });
  }
  if (priority) {
    conditions.push({ priority });
  }
  if (tagId !== undefined) {
    conditions.push({ tags: { some: { tagId } } });
  }
  if (deadlineFrom || deadlineTo) {
    conditions.push({
      deadline: {
        ...(deadlineFrom && { gte: deadlineFrom }),
        ...(deadlineTo && { lte: deadlineTo }),
      },
    });
  }
  if (search) {
    conditions.push({
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  const where: Prisma.TaskWhereInput = conditions.length ? { AND: conditions } : {};

  const total = await prisma.task.count({ where });

  const data = await prisma.task.findMany({
    where,
    select: selectTaskWithTags,
    orderBy: { [sortBy]: sortOrder },
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    data: data.map(flattenTaskTags),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getTaskById = async (
  userId: number,
  role: UserRole | null,
  taskId: number,
): Promise<TaskWithTags> => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: selectTaskWithTags,
  });
  if (!task) {
    throw new ServiceError(RESPONSE_CODES.TASK_NOT_FOUND);
  }

  await assertTaskAccess(userId, role, task);
  return flattenTaskTags(task);
};

export const updateTask = async (
  userId: number,
  role: UserRole | null,
  taskId: number,
  dto: UpdateTaskDto,
): Promise<TaskItem> => {
  const task = await assertTaskEditable(userId, role, taskId);

  if (dto.assigneeId != null && task.projectId != null) {
    await assertAssigneeIsMember(task.projectId, dto.assigneeId);
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.deadline !== undefined && { deadline: dto.deadline }),
    },
    select: selectTaskListItem,
  });

  // Record an activity entry for each meaningful field change.
  const sameTime = (a: Date | null, b: Date | null) =>
    (a ? a.getTime() : null) === (b ? b.getTime() : null);

  if (dto.status !== undefined && dto.status !== task.status) {
    await logActivity(taskId, userId, ACTIVITY_ACTIONS.STATUS_CHANGED, { status: task.status }, { status: dto.status });
  }
  if (dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId) {
    await logActivity(taskId, userId, ACTIVITY_ACTIONS.ASSIGNEE_CHANGED, { assigneeId: task.assigneeId }, { assigneeId: dto.assigneeId });
  }
  if (dto.priority !== undefined && dto.priority !== task.priority) {
    await logActivity(taskId, userId, ACTIVITY_ACTIONS.PRIORITY_CHANGED, { priority: task.priority }, { priority: dto.priority });
  }
  if (dto.deadline !== undefined && !sameTime(dto.deadline, task.deadline)) {
    await logActivity(
      taskId,
      userId,
      ACTIVITY_ACTIONS.DEADLINE_CHANGED,
      { deadline: task.deadline ? task.deadline.toISOString() : null },
      { deadline: dto.deadline ? dto.deadline.toISOString() : null },
    );
  }

  return updated;
};

export const deleteTask = async (
  userId: number,
  role: UserRole | null,
  taskId: number,
): Promise<void> => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, creatorId: true },
  });
  if (!task) {
    throw new ServiceError(RESPONSE_CODES.TASK_NOT_FOUND);
  }

  // Only the creator or an admin may delete.
  if (!isPrivileged(role) && task.creatorId !== userId) {
    throw new ServiceError(RESPONSE_CODES.FORBIDDEN, 'Only the task creator can delete this task');
  }

  await prisma.task.delete({ where: { id: taskId } });
};
