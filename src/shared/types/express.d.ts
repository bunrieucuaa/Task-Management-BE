import type { UserRole, UserStatus } from '@/generated/prisma/enums';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: UserRole | null;
        tokenVersion: number;
        name: string,
        avatarUrl? :string | "",
        status: UserStatus,
      };
    }
  }
}

export {};
