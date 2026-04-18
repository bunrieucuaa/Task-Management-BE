import { prisma } from "@/config/prisma";
import type { users } from "@/generated/prisma/client";

/**
 * Get user by email
 * @param email email
 * @returns User or null
 */
export const getUserByEmail = async (email: string): Promise<users | null> => {
    return await prisma.users.findUnique({
      where: { email },
    });
  };