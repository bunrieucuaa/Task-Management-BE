/**
 * Response code configuration
 */
interface ResponseCodeConfig {
  code: number;
  httpStatus: number;
  message: string;
}

/**
 * Response code keys
 */
export const RESPONSE_CODES = {
  // Success
  SUCCESS: 'SUCCESS',
  CREATED: 'CREATED',

  // Validation Errors (4001-4009)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Authentication Errors (4011-4019)
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  MUST_CHANGE_PASSWORD: 'MUST_CHANGE_PASSWORD',

  // Authorization Errors (4031-4039)
  FORBIDDEN: 'FORBIDDEN',

  // Not Found Errors (4041-4049)
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',

  // Conflict Errors (4091-4099)
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',

  // Account Status Errors (4231-4239)
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',

  // Server Errors (5001-5009)
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ResponseCodeKey = typeof RESPONSE_CODES[keyof typeof RESPONSE_CODES];

/**
 * Complete response code configuration
 * Maps each response code key to its code, HTTP status, and message
 */
export const ResponseCodeConfig: Record<ResponseCodeKey, ResponseCodeConfig> = {
  // Success
  SUCCESS: {
    code: 200,
    httpStatus: 200,
    message: 'Request completed successfully',
  },

  CREATED: {
    code: 201,
    httpStatus: 201,
    message: 'Created completed successfully',
  },

  // Validation Errors
  VALIDATION_ERROR: {
    code: 4001,
    httpStatus: 400,
    message: 'Validation error',
  },
  INVALID_INPUT: {
    code: 4002,
    httpStatus: 400,
    message: 'Invalid input provided',
  },

  // Authentication Errors
  INVALID_CREDENTIALS: {
    code: 4011,
    httpStatus: 401,
    message: 'Invalid username or password',
  },
  AUTHENTICATION_REQUIRED: {
    code: 4012,
    httpStatus: 401,
    message: 'Authentication required',
  },
  INVALID_TOKEN: {
    code: 4013,
    httpStatus: 401,
    message: 'Invalid token',
  },
  TOKEN_EXPIRED: {
    code: 4014,
    httpStatus: 401,
    message: 'Token has expired',
  },
  MUST_CHANGE_PASSWORD: {
    code: 4015,
    httpStatus: 403,
    message: 'You must change your password before logging in',
  },

  // Authorization Errors
  FORBIDDEN: {
    code: 4031,
    httpStatus: 403,
    message: 'Access forbidden',
  },

  // Not Found Errors
  USER_NOT_FOUND: {
    code: 4041,
    httpStatus: 404,
    message: 'User not found',
  },
  PROJECT_NOT_FOUND: {
    code: 4042,
    httpStatus: 404,
    message: 'Project not found',
  },
  TASK_NOT_FOUND: {
    code: 4043,
    httpStatus: 404,
    message: 'Task not found',
  },

  // Conflict Errors
  USER_ALREADY_EXISTS: {
    code: 4091,
    httpStatus: 409,
    message: 'User already exists',
  },

  // Account Status Errors
  ACCOUNT_DISABLED: {
    code: 4231,
    httpStatus: 403,
    message: 'User account is disabled',
  },
  ACCOUNT_LOCKED: {
    code: 4232,
    httpStatus: 403,
    message: 'User account is locked',
  },

  // Server Errors
  INTERNAL_SERVER_ERROR: {
    code: 5001,
    httpStatus: 500,
    message: 'Internal server error',
  },
  DATABASE_ERROR: {
    code: 5002,
    httpStatus: 500,
    message: 'Database error',
  },
  SERVICE_UNAVAILABLE: {
    code: 5003,
    httpStatus: 503,
    message: 'Service temporarily unavailable',
  },
};
