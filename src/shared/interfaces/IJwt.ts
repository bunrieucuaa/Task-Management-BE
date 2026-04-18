import { user_role } from "@/generated/prisma/enums";

export interface JwtPayload {
    sub: string; // user id
    email: string;
    role: user_role;
    tokenVersion: number;
    iat?: number;
    exp?: number;
  }