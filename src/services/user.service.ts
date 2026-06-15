import { prisma } from "@/config/prisma";
import type { Prisma, User } from "@/generated/prisma/client";
import { generateSalt, hashPassword, generateRandomPassword } from '@/utils/password.util';
import { UserRole, UserStatus } from '@/generated/prisma/enums';
import { PaginatedResult, PaginationParams, SafeUser, selectSafeUser, type ICreateUserResponse, type IListUsersResponse, type IUserResponse } from '@/shared/interfaces/IUser';
import type { CreateUserDto, UpdateUserDto, ListUsersQueryDto } from '@/dtos/user.dto';

/**
 * Get user by email
 */
export const getUserByEmail = async (email: string): Promise<User | null> => {
  return await prisma.user.findUnique({
    where: { email },
  });
};

/**
 * Get user by id
 */
export const getUserById = async (id: number): Promise<User | null> => {
  return await prisma.user.findUnique({
    where: { id },
  });
};

/**
 * Increment user's tokenVersion to invalidate all existing tokens
 */
export const incrementTokenVersion = async (id: number): Promise<User> => {
  return await prisma.user.update({
    where: { id },
    data: { tokenVersion: { increment: 1 } },
  });
};

/**
 * Update user's password (hash + salt) and invalidate all existing tokens
 * by bumping tokenVersion. Also clears `mustChangePassword` flag.
 */
export const updatePassword = async (
  id: number,
  passwordHash: string,
  passwordSalt: string,
): Promise<User> => {
  return await prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      passwordSalt,
      mustChangePassword: false,
      tokenVersion: { increment: 1 },
    },
  });
};

/**
 * Lightweight directory of ACTIVE users for member/assignee pickers.
 * Exposes only non-sensitive summary fields.
 */
export const getDirectory = async () => {
  return prisma.user.findMany({
    where: { status: UserStatus.ACTIVE },
    select: { id: true, name: true, email: true, avatarUrl: true, role: true },
    orderBy: { name: 'asc' },
  });
};

export const toUserResponse = (user: User): IUserResponse => {
  const { passwordHash, passwordSalt, tokenVersion, ...rest } = user;
  return rest;
};

export const createUser = async (dto: CreateUserDto): Promise<ICreateUserResponse> => {
  if (dto.email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingEmail) {
      throw new Error('Email already exists');
    }
  }

  //Tạo mật khẩu tạm thời
  const temporaryPassword = generateRandomPassword();
  const salt = generateSalt();
  const hashedPassword = await hashPassword(temporaryPassword, salt);

    const user = await prisma.user.create({
      data: {
      name: dto.name,
      email: dto.email,
      role: dto.role,
      passwordHash: hashedPassword,
      passwordSalt: salt,
      mustChangePassword: true,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    },
  });

  return { user: toUserResponse(user), temporaryPassword };
}

export const getAllUsers = async (
  params: PaginationParams = {}
): Promise<PaginatedResult<SafeUser>> => {

    const {
    page = 1,
    limit = 10,
    search,
    role,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = params;

  // Build where clause
  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } }, //Không phân biệt chữ hoa và thường
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) {
    where.role = role;
  }

  if (status) {
    where.status = status;
  }

  // Get total count
  const total = await prisma.user.count({ where });

  // Get paginated users
  const users = await prisma.user.findMany({
    where,
    select: selectSafeUser,
    orderBy: { [sortBy]: sortOrder },
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export const updateUser = async (
  userId: string,
  data: { name?: string; email?: string ; role?: UserRole }
): Promise<SafeUser> => {
  const user = await getUserById(+userId);

  if (!user) {
    throw new Error('User not found');
  }

  // Check email uniqueness if changing email
  if (data.email && data.email !== user.email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingEmail) {
      throw new Error('Email already exists');
    }
  }

  const shouldInvalidateTokens = data.role && data.role !== user.role;

  const updatedUser = await prisma.user.update({
    where: { id: +userId },
    data: {
      ...(typeof data.name === "string" && {name: data.name}),
      ...(typeof data.email === "string" && { email: data.email }),
      ...(data.role && { role: data.role }),
      ...(shouldInvalidateTokens && { tokenVersion: { increment: 1 } }),
    },
    select: selectSafeUser,
  });

  return updatedUser;
}

export const updateUserStatus = async (userId: string, status: UserStatus): Promise<User> => {
  const user = await getUserById(+userId);

  if (!user) {
    throw new Error('User not found');
  }

  // Increment tokenVersion when disabling user
  const shouldInvalidateTokens = status === UserStatus.BLOCKED;

  const updatedUser = await prisma.user.update({
    where: { id: +userId },
    data: {
      status,
      ...(shouldInvalidateTokens && { tokenVersion: { increment: 1 } }),
    },
  });

  return updatedUser;
};


export const resetUserPassword = async (id: number): Promise<ICreateUserResponse> => {
  const user = await getUserById(id);

  if (!user) {
    throw new Error('User not found');
  }

  // Generate new temporary password
  const temporaryPassword = generateRandomPassword();
  const salt = generateSalt();
  const hashedPassword = await hashPassword(temporaryPassword, salt);

  // Update password and force change on next login
  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      passwordHash: hashedPassword,
      passwordSalt: salt,
      mustChangePassword: true,
      tokenVersion: { increment: 1 },
    },
  });

  return { user: toUserResponse(updatedUser), temporaryPassword };
};


export const deleteUser = async (id: number): Promise<void> => {
  const user = await getUserById(id);

  if (!user) {
    throw new Error('User not found');
  }

  await prisma.user.update({
    where: { id },
    data: {
      status: UserStatus.BLOCKED,
      tokenVersion: { increment: 1 },
    },
  });
};
