import { prisma } from '@/config/prisma';
import type { Prisma } from '@/generated/prisma/client';
import type { UserRole } from '@/generated/prisma/enums';
import { RESPONSE_CODES } from '@/constants/response-codes.constant';
import { ServiceError } from '@/shared/errors/service-error';
import { isAdmin, isPrivileged } from '@/shared/auth/roles';
import { selectTagItem } from '@/shared/interfaces/ITag';
import type { CreateTagDto } from '@/dtos/tag.dto';
import { assertTaskEditable } from './task.service';

type TagItem = Prisma.TagGetPayload<{ select: typeof selectTagItem }>;

/** List the whole tag catalogue (any authenticated user). */
export const getTags = async (): Promise<TagItem[]> => {
  return prisma.tag.findMany({
    select: selectTagItem,
    orderBy: { name: 'asc' },
  });
};

/** Create a catalogue tag. ADMIN/PM only. Duplicate name → conflict. */
export const createTag = async (
  role: UserRole | null,
  dto: CreateTagDto,
): Promise<TagItem> => {
  if (!isPrivileged(role)) {
    throw new ServiceError(RESPONSE_CODES.FORBIDDEN, 'Only an admin or PM can create tags');
  }

  const existing = await prisma.tag.findUnique({
    where: { name: dto.name },
    select: { id: true },
  });
  if (existing) {
    throw new ServiceError(RESPONSE_CODES.TAG_ALREADY_EXISTS);
  }

  return prisma.tag.create({ data: { name: dto.name }, select: selectTagItem });
};

/** Delete a catalogue tag (cascades task_tags). ADMIN only. */
export const deleteTag = async (role: UserRole | null, tagId: number): Promise<void> => {
  if (!isAdmin(role)) {
    throw new ServiceError(RESPONSE_CODES.FORBIDDEN, 'Only an admin can delete tags');
  }

  const tag = await prisma.tag.findUnique({ where: { id: tagId }, select: { id: true } });
  if (!tag) {
    throw new ServiceError(RESPONSE_CODES.TAG_NOT_FOUND);
  }

  await prisma.tag.delete({ where: { id: tagId } });
};

/** Attach a tag to a task. Requires edit access to the task. */
export const attachTagToTask = async (
  userId: number,
  role: UserRole | null,
  taskId: number,
  tagId: number,
): Promise<void> => {
  await assertTaskEditable(userId, role, taskId);

  const tag = await prisma.tag.findUnique({ where: { id: tagId }, select: { id: true } });
  if (!tag) {
    throw new ServiceError(RESPONSE_CODES.TAG_NOT_FOUND);
  }

  const existing = await prisma.taskTag.findUnique({
    where: { taskId_tagId: { taskId, tagId } },
    select: { id: true },
  });
  if (existing) {
    throw new ServiceError(RESPONSE_CODES.TAG_ALREADY_ATTACHED);
  }

  await prisma.taskTag.create({ data: { taskId, tagId } });
};

/** Detach a tag from a task. Requires edit access to the task. */
export const detachTagFromTask = async (
  userId: number,
  role: UserRole | null,
  taskId: number,
  tagId: number,
): Promise<void> => {
  await assertTaskEditable(userId, role, taskId);
  await prisma.taskTag.deleteMany({ where: { taskId, tagId } });
};
