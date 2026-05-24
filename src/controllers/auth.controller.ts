import { Request, Response } from 'express';
import { RESPONSE_CODES } from "@/constants/response-codes.constant";
import { createErrorResponse, createSuccessResponse, getHttpStatus } from "@/dtos/api-response.dto";
import {
  ChangePasswordRequestSchema,
  LoginRequestSchema,
  RefreshTokenRequestSchema,
} from "@/dtos/auth.dto";
import {
  changePassword,
  login,
  logout,
  refreshAccessToken,
} from '@/services/auth.service';

/**
 * POST /api/v1/auth/login
 * Login with email and password
 */
export const loginHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = LoginRequestSchema.safeParse(req.body);

    if (!validation.success) {
      const errorResponse = createErrorResponse(
        RESPONSE_CODES.VALIDATION_ERROR,
        undefined,
        validation.error.issues,
      );
      res.status(getHttpStatus(RESPONSE_CODES.VALIDATION_ERROR)).json(errorResponse);
      return;
    }

    const { email, password } = validation.data;
    const result = await login(email, password);

    const httpStatus =
      result.code === 200 ? 200 : getHttpStatus(RESPONSE_CODES.MUST_CHANGE_PASSWORD);
    res.status(httpStatus).json(result);
  } catch (error) {
    const errorResponse = createErrorResponse(
      RESPONSE_CODES.INVALID_CREDENTIALS,
      error instanceof Error ? error.message : 'Login failed',
    );
    res.status(getHttpStatus(RESPONSE_CODES.INVALID_CREDENTIALS)).json(errorResponse);
  }
};

/**
 * GET /api/v1/auth/me
 * Get current authenticated user info
 */
export const getMeHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      const errorResponse = createErrorResponse(RESPONSE_CODES.AUTHENTICATION_REQUIRED);
      res.status(getHttpStatus(RESPONSE_CODES.AUTHENTICATION_REQUIRED)).json(errorResponse);
      return;
    }

    const response = createSuccessResponse({ user: req.user });
    res.status(getHttpStatus(RESPONSE_CODES.SUCCESS)).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(RESPONSE_CODES.INTERNAL_SERVER_ERROR);
    res.status(getHttpStatus(RESPONSE_CODES.INTERNAL_SERVER_ERROR)).json(errorResponse);
  }
};

/**
 * POST /api/v1/auth/refresh
 * Exchange a refresh token for a new access token
 */
export const refreshHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = RefreshTokenRequestSchema.safeParse(req.body);

    if (!validation.success) {
      const errorResponse = createErrorResponse(
        RESPONSE_CODES.VALIDATION_ERROR,
        undefined,
        validation.error.issues,
      );
      res.status(getHttpStatus(RESPONSE_CODES.VALIDATION_ERROR)).json(errorResponse);
      return;
    }

    const result = await refreshAccessToken(validation.data.refreshToken);
    res.status(getHttpStatus(RESPONSE_CODES.SUCCESS)).json(result);
  } catch (error) {
    const errorResponse = createErrorResponse(
      RESPONSE_CODES.INVALID_TOKEN,
      error instanceof Error ? error.message : 'Failed to refresh token',
    );
    res.status(getHttpStatus(RESPONSE_CODES.INVALID_TOKEN)).json(errorResponse);
  }
};

/**
 * POST /api/v1/auth/change-password
 * Change password for the currently authenticated user.
 * After success, all existing tokens are revoked.
 */
export const changePasswordHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      const errorResponse = createErrorResponse(RESPONSE_CODES.AUTHENTICATION_REQUIRED);
      res.status(getHttpStatus(RESPONSE_CODES.AUTHENTICATION_REQUIRED)).json(errorResponse);
      return;
    }

    const validation = ChangePasswordRequestSchema.safeParse(req.body);

    if (!validation.success) {
      const errorResponse = createErrorResponse(
        RESPONSE_CODES.VALIDATION_ERROR,
        undefined,
        validation.error.issues,
      );
      res.status(getHttpStatus(RESPONSE_CODES.VALIDATION_ERROR)).json(errorResponse);
      return;
    }

    const { oldPassword, newPassword } = validation.data;
    const result = await changePassword(req.user.id, oldPassword, newPassword);

    res.status(getHttpStatus(RESPONSE_CODES.SUCCESS)).json(result);
  } catch (error) {
    const errorResponse = createErrorResponse(
      RESPONSE_CODES.VALIDATION_ERROR,
      error instanceof Error ? error.message : 'Failed to change password',
    );
    res.status(getHttpStatus(RESPONSE_CODES.VALIDATION_ERROR)).json(errorResponse);
  }
};

/**
 * POST /api/v1/auth/logout
 * Invalidate all tokens of the current user
 */
export const logoutHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      const errorResponse = createErrorResponse(RESPONSE_CODES.AUTHENTICATION_REQUIRED);
      res.status(getHttpStatus(RESPONSE_CODES.AUTHENTICATION_REQUIRED)).json(errorResponse);
      return;
    }

    const result = await logout(req.user.id);
    res.status(getHttpStatus(RESPONSE_CODES.SUCCESS)).json(result);
  } catch (error) {
    const errorResponse = createErrorResponse(
      RESPONSE_CODES.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : 'Logout failed',
    );
    res.status(getHttpStatus(RESPONSE_CODES.INTERNAL_SERVER_ERROR)).json(errorResponse);
  }
};
