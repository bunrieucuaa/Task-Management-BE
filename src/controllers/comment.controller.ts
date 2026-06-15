import { Request, Response } from 'express';
import { RESPONSE_CODES, type ResponseCodeKey } from '@/constants/response-codes.constant';
import {
  createErrorResponse,
  createSuccessResponse,
  getHttpStatus,
} from '@/dtos/api-response.dto';
import { CreateCommentSchema, ListCommentsQuerySchema } from '@/dtos/comment.dto';
import { createComment, deleteComment, getComments } from '@/services/comment.service';
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

/** GET /api/v1/tasks/:taskId/comments */
export const listCommentsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = parseId(req.params.taskId);
    if (taskId === null) {
      sendValidationError(res, [{ message: 'Invalid task ID' }]);
      return;
    }

    const validation = ListCommentsQuerySchema.safeParse(req.query);
    if (!validation.success) {
      sendValidationError(res, validation.error.issues);
      return;
    }

    const result = await getComments(req.user!.id, req.user!.role, taskId, validation.data);
    res.status(getHttpStatus(RESPONSE_CODES.SUCCESS)).json(createSuccessResponse(result));
  } catch (error) {
    sendError(res, error);
  }
};

/** POST /api/v1/tasks/:taskId/comments */
export const createCommentHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = parseId(req.params.taskId);
    if (taskId === null) {
      sendValidationError(res, [{ message: 'Invalid task ID' }]);
      return;
    }

    const validation = CreateCommentSchema.safeParse(req.body);
    if (!validation.success) {
      sendValidationError(res, validation.error.issues);
      return;
    }

    const comment = await createComment(req.user!.id, req.user!.role, taskId, validation.data);
    res
      .status(getHttpStatus(RESPONSE_CODES.CREATED))
      .json(createSuccessResponse({ comment }, 'Comment created successfully'));
  } catch (error) {
    sendError(res, error, RESPONSE_CODES.INVALID_INPUT);
  }
};

/** DELETE /api/v1/tasks/:taskId/comments/:commentId */
export const deleteCommentHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = parseId(req.params.taskId);
    const commentId = parseId(req.params.commentId);
    if (taskId === null || commentId === null) {
      sendValidationError(res, [{ message: 'Invalid task or comment ID' }]);
      return;
    }

    await deleteComment(req.user!.id, req.user!.role, taskId, commentId);
    res
      .status(getHttpStatus(RESPONSE_CODES.SUCCESS))
      .json(createSuccessResponse(null, 'Comment deleted successfully'));
  } catch (error) {
    sendError(res, error);
  }
};
