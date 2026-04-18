import type { user_role as Role } from "../../generated/prisma/client";

export interface ILoginResponseData {
  user: {
    id: string;
    email: string;
    role: Role;
  };
  accessToken: string;
  mustChangePassword?: boolean;
}