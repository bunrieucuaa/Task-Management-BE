import {
  RESPONSE_CODES,
  ResponseCodeConfig,
  ResponseCodeKey,
} from '../constants/response-codes.constant';


export interface ApiResponse<T = any> {
  code: number;
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
}

/**
 * Create a success response
 * @param data Response data
 * @param message Optional custom message (defaults to success message)
 * @returns ApiResponse with success status
 */
export function createSuccessResponse<T>(data?: T, message?: string): ApiResponse<T> {
  const config = ResponseCodeConfig[RESPONSE_CODES.SUCCESS];
  return {
    code: config.code,
    success: true,
    message: message || config.message,
    data,
  };
}

/**
 * Create an error response
 * @param codeKey Response code key
 * @param message Optional custom message (defaults to code's default message from config)
 * @param errors Optional validation errors
 * @returns ApiResponse with error status
 */
export function createErrorResponse(
  codeKey: ResponseCodeKey,
  message?: string,
  errors?: any[],
): ApiResponse {
  const config = ResponseCodeConfig[codeKey];
  return {
    code: config.code,
    success: false,
    message: message || config.message,
    errors,
  };
}

/**
 * Get HTTP status code for a response code key
 * @param codeKey Response code key
 * @returns HTTP status code
 */
export function getHttpStatus(codeKey: ResponseCodeKey): number {
  return ResponseCodeConfig[codeKey].httpStatus;
}
