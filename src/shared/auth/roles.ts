import { UserRole } from '@/generated/prisma/enums';

/** Full system admin. */
export const isAdmin = (role: UserRole | null): boolean => role === UserRole.ADMIN;

/** Project Manager — admin-equal for projects/tasks, but not user administration. */
export const isPM = (role: UserRole | null): boolean => role === UserRole.PM;

/**
 * Privileged = ADMIN or PM. These roles may create projects, view the user
 * directory, and manage members/tasks across every project.
 */
export const isPrivileged = (role: UserRole | null): boolean =>
  isAdmin(role) || isPM(role);
