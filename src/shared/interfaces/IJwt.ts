import { UserRole } from "@/generated/prisma/enums";

export enum TokenType {
  Access = "access",
  Refresh = "refresh"
}
export interface JwtPayload {
    sub: string; // user id
    email: string;
    role: UserRole;
    tokenVersion: number;
    type: TokenType;
    iat?: number;
    exp?: number;
  }