import { prisma } from '@/config/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { ProjectStatus, UserRole, UserStatus } from '@/generated/prisma/enums';
import { RESPONSE_CODES } from '@/constants/response-codes.constant';
import { ServiceError } from '@/shared/errors/service-error';
import { isPrivileged } from '@/shared/auth/roles';
import {
  PROJECT_ROLE,
  selectProjectDetail,
  selectProjectListItem,
  selectProjectMember,
  type PaginatedResult,
  type ProjectListParams,
} from '@/shared/interfaces/IProject';
import type { CreateProjectDto, UpdateProjectDto } from '@/dtos/project.dto';
import { getUserByEmail } from './user.service';

type ProjectListItem = Prisma.ProjectGetPayload<{ select: typeof selectProjectListItem }>;
type ProjectMemberItem = Prisma.ProjectMemberGetPayload<{ select: typeof selectProjectMember }>;
type ProjectDetail = Prisma.ProjectGetPayload<{ select: typeof selectProjectDetail }>;

/**
 * Ensure the user can read the project (admin, owner, or member).
 * Throws PROJECT_NOT_FOUND / FORBIDDEN. Returns a lightweight access summary.
 */
export const assertProjectAccess = async (
  userId: number,
  role: UserRole | null,
  projectId: number,
): Promise<{ id: number; ownerId: number | null }> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      members: { where: { userId }, select: { id: true } },
    },
  });

  if (!project) {
    throw new ServiceError(RESPONSE_CODES.PROJECT_NOT_FOUND);
  }

  const isMember = project.ownerId === userId || project.members.length > 0;
  if (!isPrivileged(role) && !isMember) {
    throw new ServiceError(RESPONSE_CODES.FORBIDDEN, 'You do not have access to this project');
  }

  return { id: project.id, ownerId: project.ownerId };
};

/**
 * Ensure the user can manage the project (admin or owner only).
 */
export const assertProjectManage = async (
  userId: number,
  role: UserRole | null,
  projectId: number,
): Promise<{ id: number; ownerId: number | null }> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true },
  });

  if (!project) {
    throw new ServiceError(RESPONSE_CODES.PROJECT_NOT_FOUND);
  }

  if (!isPrivileged(role) && project.ownerId !== userId) {
    throw new ServiceError(RESPONSE_CODES.FORBIDDEN, 'Only the project owner can manage this project');
  }

  return project;
};

export const createProject = async (
  ownerId: number,
  dto: CreateProjectDto,
): Promise<ProjectDetail> => {
  // Resolve the requested initial members to valid, ACTIVE users (excluding the
  // owner, who is always added as OWNER). Silently drops invalid/inactive ids.
  const requestedIds = [...new Set(dto.memberIds ?? [])].filter((id) => id !== ownerId);
  const validMembers = requestedIds.length
    ? await prisma.user.findMany({
        where: { id: { in: requestedIds }, status: UserStatus.ACTIVE },
        select: { id: true },
      })
    : [];

  return prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        ownerId,
        status: ProjectStatus.ACTIVE,
      },
    });

    // The creator joins as OWNER so member-based queries include them.
    await tx.projectMember.create({
      data: { projectId: created.id, userId: ownerId, role: PROJECT_ROLE.OWNER },
    });

    if (validMembers.length) {
      await tx.projectMember.createMany({
        data: validMembers.map((member) => ({
          projectId: created.id,
          userId: member.id,
          role: PROJECT_ROLE.MEMBER,
        })),
        skipDuplicates: true,
      });
    }

    return tx.project.findUniqueOrThrow({
      where: { id: created.id },
      select: selectProjectDetail,
    });
  });
};

export const getProjects = async (
  userId: number,
  role: UserRole | null,
  params: ProjectListParams = {},
): Promise<PaginatedResult<ProjectListItem>> => {
  const {
    page = 1,
    limit = 20,
    search,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = params;

  const conditions: Prisma.ProjectWhereInput[] = [];

  // Non-privileged users only see projects they own or are a member of.
  if (!isPrivileged(role)) {
    conditions.push({ OR: [{ ownerId: userId }, { members: { some: { userId } } }] });
  }

  if (search) {
    conditions.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  if (status) {
    conditions.push({ status });
  }

  const where: Prisma.ProjectWhereInput = conditions.length ? { AND: conditions } : {};

  const total = await prisma.project.count({ where });

  const data = await prisma.project.findMany({
    where,
    select: selectProjectListItem,
    orderBy: { [sortBy]: sortOrder },
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getProjectById = async (
  userId: number,
  role: UserRole | null,
  projectId: number,
): Promise<ProjectDetail> => {
  await assertProjectAccess(userId, role, projectId);

  return prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: selectProjectDetail,
  });
};

export const updateProject = async (
  userId: number,
  role: UserRole | null,
  projectId: number,
  dto: UpdateProjectDto,
): Promise<ProjectDetail> => {
  await assertProjectManage(userId, role, projectId);

  return prisma.project.update({
    where: { id: projectId },
    data: {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.status !== undefined && { status: dto.status }),
    },
    select: selectProjectDetail,
  });
};

/**
 * Soft delete: archive the project (keeps history/tasks intact).
 */
export const archiveProject = async (
  userId: number,
  role: UserRole | null,
  projectId: number,
): Promise<void> => {
  await assertProjectManage(userId, role, projectId);

  await prisma.project.update({
    where: { id: projectId },
    data: { status: ProjectStatus.ARCHIVED },
  });
};

export const listMembers = async (
  userId: number,
  role: UserRole | null,
  projectId: number,
): Promise<ProjectMemberItem[]> => {
  await assertProjectAccess(userId, role, projectId);

  return prisma.projectMember.findMany({
    where: { projectId },
    select: selectProjectMember,
    orderBy: { joinedAt: 'asc' },
  });
};

export const addMember = async (
  userId: number,
  role: UserRole | null,
  projectId: number,
  email: string,
): Promise<ProjectMemberItem> => {
  await assertProjectManage(userId, role, projectId);

  const user = await getUserByEmail(email);
  if (!user) {
    throw new ServiceError(RESPONSE_CODES.USER_NOT_FOUND, 'No user found with that email');
  }

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { id: true },
  });
  if (existing) {
    throw new ServiceError(RESPONSE_CODES.USER_ALREADY_EXISTS, 'User is already a member of this project');
  }

  return prisma.projectMember.create({
    data: { projectId, userId: user.id, role: PROJECT_ROLE.MEMBER },
    select: selectProjectMember,
  });
};

export const removeMember = async (
  userId: number,
  role: UserRole | null,
  projectId: number,
  targetUserId: number,
): Promise<void> => {
  const project = await assertProjectManage(userId, role, projectId);

  if (project.ownerId === targetUserId) {
    throw new ServiceError(RESPONSE_CODES.FORBIDDEN, 'Cannot remove the project owner');
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: targetUserId } },
    select: { id: true },
  });
  if (!membership) {
    throw new ServiceError(RESPONSE_CODES.USER_NOT_FOUND, 'Member not found in this project');
  }

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId: targetUserId } },
  });
};
