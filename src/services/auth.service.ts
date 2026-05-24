import { ApiResponse, createSuccessResponse } from "@/dtos/api-response.dto";
import { ILoginResponseData, IRefreshTokenResponseData } from "@/shared/interfaces/IAuth";
import {
  getUserByEmail,
  getUserById,
  incrementTokenVersion,
  updatePassword,
} from "./user.service";
import { UserStatus } from "@/generated/prisma/enums";
import {
  generateSalt,
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from "@/utils/password.util";
import { signAccessToken, signRefreshToken, verifyToken } from "@/utils/jwt.util";
import { TokenType } from "@/shared/interfaces/IJwt";

/**
 * Authenticate user and generate JWT tokens
 */
export const login = async (
  email: string,
  password: string,
): Promise<ApiResponse<ILoginResponseData>> => {
  const user = await getUserByEmail(email);

  if (!user) {
    throw new Error('Email hoặc password không hợp lệ');
  }

  if (user.status === UserStatus.INACTIVE) {
    throw new Error('Tài khoản người dùng không hoạt động');
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash, user.passwordSalt);

  if (!isValidPassword) {
    throw new Error('Invalid username or password');
  }

  if (!user.role) {
    throw new Error('User role is not defined');
  }

  const tokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  const responseData: ILoginResponseData = {
    user: {
      id: String(user.id),
      email: user.email,
      role: user.role,
    },
    accessToken,
    refreshToken,
    mustChangePassword: user.mustChangePassword,
  };

  if (user.mustChangePassword) {
    return createSuccessResponse(
      responseData,
      'Login successful, but you must change your password',
    );
  }

  return createSuccessResponse(responseData, 'Login successful');
};

/**
 * Verify refresh token and issue a new access token
 */
export const refreshAccessToken = async (
  refreshToken: string,
): Promise<ApiResponse<IRefreshTokenResponseData>> => {
  const payload = verifyToken(refreshToken);

  if (payload.type !== TokenType.Refresh) {
    throw new Error('Invalid token type. Refresh token required.');
  }

  const user = await getUserById(Number(payload.sub));

  if (!user) {
    throw new Error('User not found');
  }

  if (user.status === UserStatus.INACTIVE) {
    throw new Error('Tài khoản người dùng không hoạt động');
  }

  if (user.tokenVersion !== payload.tokenVersion) {
    throw new Error('Token has been revoked. Please login again.');
  }

  if (!user.role) {
    throw new Error('User role is not defined');
  }

  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  return createSuccessResponse({ accessToken }, 'Access token refreshed');
};

/**
 * Logout: invalidate all tokens by bumping tokenVersion
 */
export const logout = async (userId: number): Promise<ApiResponse<null>> => {
  await incrementTokenVersion(userId);
  return createSuccessResponse(null, 'Logged out successfully');
};

/**
 * Change password for a logged-in user.
 * Verifies the old password, validates the new password strength,
 * persists a new hash + salt and bumps tokenVersion to revoke all existing tokens.
 * The user must login again afterwards.
 */
export const changePassword = async (
  userId: number,
  oldPassword: string,
  newPassword: string,
): Promise<ApiResponse<null>> => {
  if (oldPassword === newPassword) {
    throw new Error('New password must be different from old password');
  }

  const strengthCheck = validatePasswordStrength(newPassword);
  if (!strengthCheck.isValid) {
    throw new Error(strengthCheck.message ?? 'Password does not meet strength requirements');
  }

  const user = await getUserById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  const isOldPasswordValid = await verifyPassword(
    oldPassword,
    user.passwordHash,
    user.passwordSalt,
  );

  if (!isOldPasswordValid) {
    throw new Error('Old password is incorrect');
  }

  const newSalt = generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);

  await updatePassword(userId, newHash, newSalt);

  return createSuccessResponse(
    null,
    'Password changed successfully. Please login again.',
  );
};
