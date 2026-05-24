import { prisma } from "@/config/prisma";
import type { User } from "@/generated/prisma/client";

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
