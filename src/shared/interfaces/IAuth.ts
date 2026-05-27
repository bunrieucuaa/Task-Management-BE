import type { UserRole, UserStatus } from "../../generated/prisma/client";

export interface ILoginResponseData {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatarUrl: string;
    status: UserStatus
  };
  accessToken: string;
  refreshToken: string;
  mustChangePassword?: boolean;
}

export interface IRefreshTokenResponseData {
  accessToken: string;
}