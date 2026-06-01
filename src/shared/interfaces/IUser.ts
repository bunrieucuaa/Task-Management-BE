import { User } from '@/generated/prisma/client';
import type { UserRole, UserStatus } from '@/generated/prisma/enums';

export interface IUserResponse {
  id: number;
  name: string;
  email: string;
  role: UserRole | null;
  status: UserStatus | null;
  avatarUrl: string | null;
  mustChangePassword: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ICreateUserResponse {
  user: IUserResponse;
  temporaryPassword: string;   // Chỉ trả lần đầu khi tạo hoặc reset password
}

export interface IListUsersResponse {
  users: IUserResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

//FILTER
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  sortBy?: 'name' | 'email' | 'role' | 'status' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============ SAFE USER TYPE (without sensitive data) ============

export type SafeUser = Omit<User, 'passwordHash' | 'passwordSalt' | 'tokenVersion'>;

export const selectSafeUser = {
  id: true,
  name: true,
  email: true,
  role: true,
  mustChangePassword: true,
  status: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;
