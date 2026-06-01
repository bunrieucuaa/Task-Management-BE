import { UserRole, UserStatus } from '@/generated/prisma/enums';
import { z } from 'zod';

export const CreateUserSchema = z.object({
  name:  z.string().min(1).max(100),
  email: z.string().email(),
  role:  z.nativeEnum(UserRole).optional().default(UserRole.MEMBER),
})

export const UpdateUserSchema = z.object({
  name:      z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().nullable().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
})

export const UpdateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
})

export const ListUsersQuerySchema = z.object({
  page:   z.coerce.number().int().min(1).default(1).optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(20).optional(),
  search: z.string().optional(), 
  role:   z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  sortBy: z.enum(['name', 'email', 'role', 'status', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
export type UpdateUserStatusDto = z.infer<typeof UpdateUserStatusSchema>;
export type ListUsersQueryDto = z.infer<typeof ListUsersQuerySchema>;
