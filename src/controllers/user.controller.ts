import { Request, Response } from 'express';
import { RESPONSE_CODES } from "@/constants/response-codes.constant";
import { createErrorResponse, createSuccessResponse, getHttpStatus } from "@/dtos/api-response.dto";
import { CreateUserSchema, ListUsersQuerySchema, UpdateUserSchema, UpdateUserStatusSchema } from '@/dtos/user.dto';
import { createUser, deleteUser, getAllUsers, getUserById, resetUserPassword, toUserResponse, updateUser, updateUserStatus } from '@/services/user.service';
import { UserRole } from '@/generated/prisma/enums';

/**
 * POST /api/v1/users
 * Create a new user (admin-only)
 */

export const createUserHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        // Validate request body
        const validation = CreateUserSchema.safeParse(req.body);

        if (!validation.success) {
        const errorResponse = createErrorResponse(
            RESPONSE_CODES.VALIDATION_ERROR,
            undefined,
            validation.error.issues,
        );
        res.status(getHttpStatus(RESPONSE_CODES.VALIDATION_ERROR)).json(errorResponse);
        return;
        }

        const { user, temporaryPassword } = await createUser(validation.data);

        const response = createSuccessResponse(
          { user, temporaryPassword },
          'User created successfully',
        );
        res.status(getHttpStatus(RESPONSE_CODES.CREATED)).json(response);
  } catch (error) {
        const errorResponse = createErrorResponse(
        RESPONSE_CODES.INVALID_INPUT,
        error instanceof Error ? error.message : 'Failed to create user',
        );
        res.status(getHttpStatus(RESPONSE_CODES.INVALID_INPUT)).json(errorResponse);
  }
};

// =====================================

export const listUsersHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const validation = ListUsersQuerySchema.safeParse(req.query);

        if (!validation.success) {
        const errorResponse = createErrorResponse(
            RESPONSE_CODES.VALIDATION_ERROR,
            undefined,
            validation.error.issues,
        );
        res.status(getHttpStatus(RESPONSE_CODES.VALIDATION_ERROR)).json(errorResponse);
            return;
        }

        const result = await getAllUsers(validation.data);
        const response = createSuccessResponse(result);
        res.status(getHttpStatus(RESPONSE_CODES.SUCCESS)).json(response);
 
    } catch (error) {
        const errorResponse = createErrorResponse(
            RESPONSE_CODES.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error.message : 'Failed to fetch users',
        );
        console.log("Error", errorResponse);
        
        res.status(getHttpStatus(RESPONSE_CODES.INTERNAL_SERVER_ERROR)).json(errorResponse);
    }
}

export const getUserHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetId = parseInt(req.params.id, 10);

    if (isNaN(targetId)) {
      const errorResponse = createErrorResponse(RESPONSE_CODES.VALIDATION_ERROR, 'Invalid user ID');
      res.status(getHttpStatus(RESPONSE_CODES.VALIDATION_ERROR)).json(errorResponse);
      return;
    }

    // User can view themselves, ADMIN can view anyone
    if (req.user!.role !== UserRole.ADMIN && req.user!.id !== targetId) {
      const errorResponse = createErrorResponse(RESPONSE_CODES.FORBIDDEN);
      res.status(getHttpStatus(RESPONSE_CODES.FORBIDDEN)).json(errorResponse);
      return;
    }

    const user = await getUserById(targetId);

    if (!user) {
      const errorResponse = createErrorResponse(RESPONSE_CODES.USER_NOT_FOUND);
      res.status(getHttpStatus(RESPONSE_CODES.USER_NOT_FOUND)).json(errorResponse);
      return;
    }

    const response = createSuccessResponse({ user: toUserResponse(user) });
    res.status(getHttpStatus(RESPONSE_CODES.SUCCESS)).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(RESPONSE_CODES.INTERNAL_SERVER_ERROR);
    res.status(getHttpStatus(RESPONSE_CODES.INTERNAL_SERVER_ERROR)).json(errorResponse);
  }
};

export const updateUserHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetId = parseInt(req.params.id, 10);

    if (isNaN(targetId)) {
      const errorResponse = createErrorResponse(RESPONSE_CODES.VALIDATION_ERROR, 'Invalid user ID');
      res.status(getHttpStatus(RESPONSE_CODES.VALIDATION_ERROR)).json(errorResponse);
      return;
    }

    // Only allow user to update themselves
    if (req.user!.id !== targetId) {
      const errorResponse = createErrorResponse(RESPONSE_CODES.FORBIDDEN, 'You can only update your own profile');
      res.status(getHttpStatus(RESPONSE_CODES.FORBIDDEN)).json(errorResponse);
      return;
    }

    // Validate request body
    const validation = UpdateUserSchema.safeParse(req.body);

    if (!validation.success) {
      const errorResponse = createErrorResponse(
        RESPONSE_CODES.VALIDATION_ERROR,
        undefined,
        validation.error.issues,
      );
      res.status(getHttpStatus(RESPONSE_CODES.VALIDATION_ERROR)).json(errorResponse);
      return;
    }

    const user = await updateUser(String(targetId), validation.data);

    const response = createSuccessResponse({ user }, 'User updated successfully');
    res.status(getHttpStatus(RESPONSE_CODES.SUCCESS)).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(
      RESPONSE_CODES.INVALID_INPUT,
      error instanceof Error ? error.message : 'Failed to update user',
    );
    res.status(getHttpStatus(RESPONSE_CODES.INVALID_INPUT)).json(errorResponse);
  }
};

export const updateUserStatusHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetId = parseInt(req.params.id, 10);

    if (isNaN(targetId)) {
      const errorResponse = createErrorResponse(RESPONSE_CODES.VALIDATION_ERROR, 'Invalid user ID');
      res.status(getHttpStatus(RESPONSE_CODES.VALIDATION_ERROR)).json(errorResponse);
      return;
    }

    // Prevent admin from changing their own status
    if (req.user!.id === targetId) {
      const errorResponse = createErrorResponse(RESPONSE_CODES.FORBIDDEN, 'Cannot change your own status');
      res.status(getHttpStatus(RESPONSE_CODES.FORBIDDEN)).json(errorResponse);
      return;
    }

    // Validate request body
    const validation = UpdateUserStatusSchema.safeParse(req.body);

    if (!validation.success) {
      const errorResponse = createErrorResponse(
        RESPONSE_CODES.VALIDATION_ERROR,
        undefined,
        validation.error.issues,
      );
      res.status(getHttpStatus(RESPONSE_CODES.VALIDATION_ERROR)).json(errorResponse);
      return;
    }

    const { status } = validation.data;

    const user = await updateUserStatus(String(targetId), status);

    const response = createSuccessResponse({ user: toUserResponse(user) }, 'User status updated successfully');
    res.status(getHttpStatus(RESPONSE_CODES.SUCCESS)).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(
      RESPONSE_CODES.INVALID_INPUT,
      error instanceof Error ? error.message : 'Failed to update user status',
    );
    res.status(getHttpStatus(RESPONSE_CODES.INVALID_INPUT)).json(errorResponse);
  }
};


export const resetUserPasswordHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Prevent admin from resetting their own password
    if (req.user && req.user.id === +id) {
      const errorResponse = createErrorResponse(
        RESPONSE_CODES.FORBIDDEN,
        'Cannot reset your own password. Use change-password instead.',
      );
      res.status(getHttpStatus(RESPONSE_CODES.FORBIDDEN)).json(errorResponse);
      return;
    }

    const { user, temporaryPassword } = await resetUserPassword(+id);

    const response = createSuccessResponse(
      { user, temporaryPassword },
      'Password reset successfully. User must change password on next login.',
    );
    res.status(getHttpStatus(RESPONSE_CODES.SUCCESS)).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(
      RESPONSE_CODES.INVALID_INPUT,
      error instanceof Error ? error.message : 'Failed to reset password',
    );
    res.status(getHttpStatus(RESPONSE_CODES.INVALID_INPUT)).json(errorResponse);
  }
};

export const deleteUserHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetId = parseInt(req.params.id, 10);

    if (isNaN(targetId)) {
      const errorResponse = createErrorResponse(RESPONSE_CODES.VALIDATION_ERROR, 'Invalid user ID');
      res.status(getHttpStatus(RESPONSE_CODES.VALIDATION_ERROR)).json(errorResponse);
      return;
    }

    // Prevent admin from deleting themselves
    if (req.user!.id === targetId) {
      const errorResponse = createErrorResponse(RESPONSE_CODES.FORBIDDEN, 'Cannot delete your own account');
      res.status(getHttpStatus(RESPONSE_CODES.FORBIDDEN)).json(errorResponse);
      return;
    }

    await deleteUser(targetId);

    const response = createSuccessResponse(null, 'User has been deleted successfully');
    res.status(getHttpStatus(RESPONSE_CODES.SUCCESS)).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(
      RESPONSE_CODES.INVALID_INPUT,
      error instanceof Error ? error.message : 'Failed to delete user',
    );
    res.status(getHttpStatus(RESPONSE_CODES.INVALID_INPUT)).json(errorResponse);
  }
}
