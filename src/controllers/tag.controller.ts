import { Request, Response } from 'express';
import { RESPONSE_CODES, type ResponseCodeKey } from '@/constants/response-codes.constant';
import {
  createErrorResponse,
  createSuccessResponse,
  getHttpStatus,
} from '@/dtos/api-response.dto';
import { AttachTagSchema, CreateTagSchema } from '@/dtos/tag.dto';
import {
  attachTagToTask,
  createTag,
  deleteTag,
  detachTagFromTask,
  getTags,
} from '@/services/tag.service';
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

/** GET /api/v1/tags */
export const listTagsHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const tags = await getTags();
    res.status(getHttpStatus(RESPONSE_CODES.SUCCESS)).json(createSuccessResponse({ tags }));
  } catch (error) {
    sendError(res, error);
  }
};

/** POST /api/v1/tags */
export const createTagHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = CreateTagSchema.safeParse(req.body);
    if (!validation.success) {
      sendValidationError(res, validation.error.issues);
      return;
    }

    const tag = await createTag(req.user!.role, validation.data);
    res
      .status(getHttpStatus(RESPONSE_CODES.CREATED))
      .json(createSuccessResponse({ tag }, 'Tag created successfully'));
  } catch (error) {
    sendError(res, error, RESPONSE_CODES.INVALID_INPUT);
  }
};

/** DELETE /api/v1/tags/:id */
export const deleteTagHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const tagId = parseId(req.params.id);
    if (tagId === null) {
      sendValidationError(res, [{ message: 'Invalid tag ID' }]);
      return;
    }

    await deleteTag(req.user!.role, tagId);
    res
      .status(getHttpStatus(RESPONSE_CODES.SUCCESS))
      .json(createSuccessResponse(null, 'Tag deleted successfully'));
  } catch (error) {
    sendError(res, error);
  }
};

/** POST /api/v1/tasks/:taskId/tags */
export const attachTagHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = parseId(req.params.taskId);
    if (taskId === null) {
      sendValidationError(res, [{ message: 'Invalid task ID' }]);
      return;
    }

    const validation = AttachTagSchema.safeParse(req.body);
    if (!validation.success) {
      sendValidationError(res, validation.error.issues);
      return;
    }

    await attachTagToTask(req.user!.id, req.user!.role, taskId, validation.data.tagId);
    res
      .status(getHttpStatus(RESPONSE_CODES.CREATED))
      .json(createSuccessResponse(null, 'Tag attached successfully'));
  } catch (error) {
    sendError(res, error, RESPONSE_CODES.INVALID_INPUT);
  }
};

/** DELETE /api/v1/tasks/:taskId/tags/:tagId */
export const detachTagHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = parseId(req.params.taskId);
    const tagId = parseId(req.params.tagId);
    if (taskId === null || tagId === null) {
      sendValidationError(res, [{ message: 'Invalid task or tag ID' }]);
      return;
    }

    await detachTagFromTask(req.user!.id, req.user!.role, taskId, tagId);
    res
      .status(getHttpStatus(RESPONSE_CODES.SUCCESS))
      .json(createSuccessResponse(null, 'Tag detached successfully'));
  } catch (error) {
    sendError(res, error);
  }
};
