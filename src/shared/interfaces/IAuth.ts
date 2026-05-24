import type { UserRole } from "../../generated/prisma/client";

export interface ILoginResponseData {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
  accessToken: string;
  refreshToken: string;
  mustChangePassword?: boolean;
}

export interface IRefreshTokenResponseData {
  accessToken: string;
}