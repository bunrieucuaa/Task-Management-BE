import { Request, Response } from 'express';
import { RESPONSE_CODES, type ResponseCodeKey } from '@/constants/response-codes.constant';
import {
  createErrorResponse,
  createSuccessResponse,
  getHttpStatus,
} from '@/dtos/api-response.dto';
import { ListActivitiesQuerySchema } from '@/dtos/activity.dto';
import { getTaskActivities } from '@/services/activity.service';
import { resolveError } from '@/shared/errors/service-error';

const parseId = (raw: string): number | null => {
  const id = parseInt(raw, 10);
  return Number.isNaN(id) ? null : id;
};

const sendValidationError = (res: Response, issues: unknown[]): void => {
  const errorResponse = createErrorResponse(RESPONSE_CODES.VALIDATION_ERROR, undefined, issues as any[]);
  res.status(getHttpStatus(RESPONSE_CODES.VALIDATION_ERROR)).json(errorResponse);
};

const sendError = (
  res: Response,
  error: unknown,
  fallback: ResponseCodeKey = RESPONSE_CODES.INTERNAL_SERVER_ERROR,
): void => {
  const { codeKey, message } = resolveError(error, fallback);
  res.status(getHttpStatus(codeKey)).json(createErrorResponse(codeKey, message));
};

/** GET /api/v1/tasks/:taskId/activities */
export const listActivitiesHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = parseId(req.params.taskId);
    if (taskId === null) {
      sendValidationError(res, [{ message: 'Invalid task ID' }]);
      return;
    }

    const validation = ListActivitiesQuerySchema.safeParse(req.query);
    if (!validation.success) {
      sendValidationError(res, validation.error.issues);
      return;
    }

    const result = await getTaskActivities(req.user!.id, req.user!.role, taskId, validation.data);
    res.status(getHttpStatus(RESPONSE_CODES.SUCCESS)).json(createSuccessResponse(result));
  } catch (error) {
    sendError(res, error);
  }
};
