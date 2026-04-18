import { Request, Response } from 'express';
import { RESPONSE_CODES } from "@/constants/response-codes.constant";
import { createErrorResponse, getHttpStatus } from "@/dtos/api-response.dto";
import { LoginRequestSchema } from "@/dtos/auth.dto";
import { login } from '@/services/auth.service';

/**
 * POST /api/v1/auth/login
 * Login with username and password
 */
export const loginHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const validation = LoginRequestSchema.safeParse(req.body);
  
      if (!validation.success) {
        const errorResponse = createErrorResponse(
          RESPONSE_CODES.VALIDATION_ERROR,
          undefined,
          validation.error.errors,
        );
        res.status(getHttpStatus(RESPONSE_CODES.VALIDATION_ERROR)).json(errorResponse);
        return;
      }
  
      const { username, password } = validation.data;
  
      // Attempt login
      const result = await login(username, password);
  
      // Return response with appropriate HTTP status based on code
      // The result already contains the code from the service
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
  