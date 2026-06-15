import { Request, Response } from 'express';
import { RESPONSE_CODES, type ResponseCodeKey } from '@/constants/response-codes.constant';
import {
  createErrorResponse,
  createSuccessResponse,
  getHttpStatus,
} from '@/dtos/api-response.dto';
import {
  AddMemberSchema,
  CreateProjectSchema,
  ListProjectsQuerySchema,
  UpdateProjectSchema,
} from '@/dtos/project.dto';
import {
  addMember,
  archiveProject,
  createProject,
  getProjectById,
  getProjects,
  listMembers,
  removeMember,
  updateProject,
} from '@/services/project.service';
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

/** POST /api/v1/projects */
export const createProjectHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = CreateProjectSchema.safeParse(req.body);
    if (!validation.success) {
      sendValidationError(res, validation.error.issues);
      return;
    }

    const project = await createProject(req.user!.id, validation.data);
    res
      .status(getHttpStatus(RESPONSE_CODES.CREATED))
      .json(createSuccessResponse({ project }, 'Project created successfully'));
  } catch (error) {
    sendError(res, error, RESPONSE_CODES.INVALID_INPUT);
  }
};

/** GET /api/v1/projects */
export const listProjectsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = ListProjectsQuerySchema.safeParse(req.query);
    if (!validation.success) {
      sendValidationError(res, validation.error.issues);
      return;
    }

    const result = await getProjects(req.user!.id, req.user!.role, validation.data);
    res.status(getHttpStatus(RESPONSE_CODES.SUCCESS)).json(createSuccessResponse(result));
  } catch (error) {
    sendError(res, error);
  }
};

/** GET /api/v1/projects/:id */
export const getProjectHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      sendValidationError(res, [{ message: 'Invalid project ID' }]);
      return;
    }

    const project = await getProjectById(req.user!.id, req.user!.role, id);
    res.status(getHttpStatus(RESPONSE_CODES.SUCCESS)).json(createSuccessResponse({ project }));
  } catch (error) {
    sendError(res, error);
  }
};

/** PATCH /api/v1/projects/:id */
export const updateProjectHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      sendValidationError(res, [{ message: 'Invalid project ID' }]);
      return;
    }

    const validation = UpdateProjectSchema.safeParse(req.body);
    if (!validation.success) {
      sendValidationError(res, validation.error.issues);
      return;
    }

    const project = await updateProject(req.user!.id, req.user!.role, id, validation.data);
    res
      .status(getHttpStatus(RESPONSE_CODES.SUCCESS))
      .json(createSuccessResponse({ project }, 'Project updated successfully'));
  } catch (error) {
    sendError(res, error, RESPONSE_CODES.INVALID_INPUT);
  }
};

/** DELETE /api/v1/projects/:id  (soft delete → ARCHIVED) */
export const deleteProjectHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      sendValidationError(res, [{ message: 'Invalid project ID' }]);
      return;
    }

    await archiveProject(req.user!.id, req.user!.role, id);
    res
      .status(getHttpStatus(RESPONSE_CODES.SUCCESS))
      .json(createSuccessResponse(null, 'Project archived successfully'));
  } catch (error) {
    sendError(res, error);
  }
};

/** GET /api/v1/projects/:id/members */
export const listMembersHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      sendValidationError(res, [{ message: 'Invalid project ID' }]);
      return;
    }

    const members = await listMembers(req.user!.id, req.user!.role, id);
    res.status(getHttpStatus(RESPONSE_CODES.SUCCESS)).json(createSuccessResponse({ members }));
  } catch (error) {
    sendError(res, error);
  }
};

/** POST /api/v1/projects/:id/members  (body: { email }) */
export const addMemberHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      sendValidationError(res, [{ message: 'Invalid project ID' }]);
      return;
    }

    const validation = AddMemberSchema.safeParse(req.body);
    if (!validation.success) {
      sendValidationError(res, validation.error.issues);
      return;
    }

    const member = await addMember(req.user!.id, req.user!.role, id, validation.data.email);
    res
      .status(getHttpStatus(RESPONSE_CODES.CREATED))
      .json(createSuccessResponse({ member }, 'Member added successfully'));
  } catch (error) {
    sendError(res, error, RESPONSE_CODES.INVALID_INPUT);
  }
};

/** DELETE /api/v1/projects/:id/members/:userId */
export const removeMemberHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    const targetUserId = parseId(req.params.userId);
    if (id === null || targetUserId === null) {
      sendValidationError(res, [{ message: 'Invalid project or user ID' }]);
      return;
    }

    await removeMember(req.user!.id, req.user!.role, id, targetUserId);
    res
      .status(getHttpStatus(RESPONSE_CODES.SUCCESS))
      .json(createSuccessResponse(null, 'Member removed successfully'));
  } catch (error) {
    sendError(res, error);
  }
};
