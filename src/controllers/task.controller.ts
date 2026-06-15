import { Request, Response } from 'express';
import { RESPONSE_CODES, type ResponseCodeKey } from '@/constants/response-codes.constant';
import {
  createErrorResponse,
  createSuccessResponse,
  getHttpStatus,
} from '@/dtos/api-response.dto';
import {
  CreateTaskSchema,
  ListTasksQuerySchema,
  UpdateTaskSchema,
} from '@/dtos/task.dto';
import {
  createTask,
  deleteTask,
  getTaskById,
  getTasks,
  updateTask,
} from '@/services/task.service';
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

/** POST /api/v1/tasks */
export const createTaskHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = CreateTaskSchema.safeParse(req.body);
    if (!validation.success) {
      sendValidationError(res, validation.error.issues);
      return;
    }

    const task = await createTask(req.user!.id, req.user!.role, validation.data);
    res
      .status(getHttpStatus(RESPONSE_CODES.CREATED))
      .json(createSuccessResponse({ task }, 'Task created successfully'));
  } catch (error) {
    sendError(res, error, RESPONSE_CODES.INVALID_INPUT);
  }
};

/** GET /api/v1/tasks */
export const listTasksHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = ListTasksQuerySchema.safeParse(req.query);
    if (!validation.success) {
      sendValidationError(res, validation.error.issues);
      return;
    }

    const result = await getTasks(req.user!.id, req.user!.role, validation.data);
    res.status(getHttpStatus(RESPONSE_CODES.SUCCESS)).json(createSuccessResponse(result));
  } catch (error) {
    sendError(res, error);
  }
};

/** GET /api/v1/tasks/:id */
export const getTaskHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      sendValidationError(res, [{ message: 'Invalid task ID' }]);
      return;
    }

    const task = await getTaskById(req.user!.id, req.user!.role, id);
    res.status(getHttpStatus(RESPONSE_CODES.SUCCESS)).json(createSuccessResponse({ task }));
  } catch (error) {
    sendError(res, error);
  }
};

/** PATCH /api/v1/tasks/:id */
export const updateTaskHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      sendValidationError(res, [{ message: 'Invalid task ID' }]);
      return;
    }

    const validation = UpdateTaskSchema.safeParse(req.body);
    if (!validation.success) {
      sendValidationError(res, validation.error.issues);
      return;
    }

    const task = await updateTask(req.user!.id, req.user!.role, id, validation.data);
    res
      .status(getHttpStatus(RESPONSE_CODES.SUCCESS))
      .json(createSuccessResponse({ task }, 'Task updated successfully'));
  } catch (error) {
    sendError(res, error, RESPONSE_CODES.INVALID_INPUT);
  }
};

/** DELETE /api/v1/tasks/:id */
export const deleteTaskHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      sendValidationError(res, [{ message: 'Invalid task ID' }]);
      return;
    }

    await deleteTask(req.user!.id, req.user!.role, id);
    res
      .status(getHttpStatus(RESPONSE_CODES.SUCCESS))
      .json(createSuccessResponse(null, 'Task deleted successfully'));
  } catch (error) {
    sendError(res, error);
  }
};
