import { prisma } from '@/config/prisma';
import type { Prisma } from '@/generated/prisma/client';
import type { UserRole } from '@/generated/prisma/enums';
import { RESPONSE_CODES } from '@/constants/response-codes.constant';
import { ServiceError } from '@/shared/errors/service-error';
import { isPrivileged } from '@/shared/auth/roles';
import {
  selectTaskListItem,
  type PaginatedResult,
  type TaskListParams,
} from '@/shared/interfaces/ITask';
import type { CreateTaskDto, UpdateTaskDto } from '@/dtos/task.dto';
import { assertProjectAccess } from './project.service';

type TaskItem = Prisma.TaskGetPayload<{ select: typeof selectTaskListItem }>;

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

export const createTask = async (
  creatorId: number,
  role: UserRole | null,
  dto: CreateTaskDto,
): Promise<TaskItem> => {
  await assertProjectAccess(creatorId, role, dto.projectId);

  if (dto.assigneeId != null) {
    await assertAssigneeIsMember(dto.projectId, dto.assigneeId);
  }

  return prisma.task.create({
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
};

export const getTasks = async (
  userId: number,
  role: UserRole | null,
  params: TaskListParams = {},
): Promise<PaginatedResult<TaskItem>> => {
  const {
    page = 1,
    limit = 20,
    projectId,
    assigneeId,
    status,
    priority,
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
    select: selectTaskListItem,
    orderBy: { [sortBy]: sortOrder },
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getTaskById = async (
  userId: number,
  role: UserRole | null,
  taskId: number,
): Promise<TaskItem> => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: selectTaskListItem,
  });
  if (!task) {
    throw new ServiceError(RESPONSE_CODES.TASK_NOT_FOUND);
  }

  await assertTaskAccess(userId, role, task);
  return task;
};

export const updateTask = async (
  userId: number,
  role: UserRole | null,
  taskId: number,
  dto: UpdateTaskDto,
): Promise<TaskItem> => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, creatorId: true, assigneeId: true },
  });
  if (!task) {
    throw new ServiceError(RESPONSE_CODES.TASK_NOT_FOUND);
  }

  await assertTaskAccess(userId, role, task);

  // Ownership: only creator, current assignee, or admin may edit.
  const canEdit =
    isPrivileged(role) || task.creatorId === userId || task.assigneeId === userId;
  if (!canEdit) {
    throw new ServiceError(RESPONSE_CODES.FORBIDDEN, 'You are not allowed to edit this task');
  }

  if (dto.assigneeId != null && task.projectId != null) {
    await assertAssigneeIsMember(task.projectId, dto.assigneeId);
  }

  return prisma.task.update({
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
