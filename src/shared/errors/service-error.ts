import { RESPONSE_CODES, type ResponseCodeKey } from '@/constants/response-codes.constant';

/**
 * Error carrying a response-code key so controllers can map it to the right
 * HTTP status (403/404/409...) instead of collapsing everything to one code.
 * Keeps the existing per-handler try/catch style — just makes it precise.
 */
export class ServiceError extends Error {
  codeKey: ResponseCodeKey;

  constructor(codeKey: ResponseCodeKey, message?: string) {
    super(message);
    this.name = 'ServiceError';
    this.codeKey = codeKey;
  }
}

/**
 * Resolve any thrown value into a { codeKey, message } pair for the response.
 * `ServiceError` keeps its code; anything else falls back to the given code.
 */
export const resolveError = (
  error: unknown,
  fallback: ResponseCodeKey = RESPONSE_CODES.INTERNAL_SERVER_ERROR,
): { codeKey: ResponseCodeKey; message?: string } => {
  if (error instanceof ServiceError) {
    return { codeKey: error.codeKey, message: error.message };
  }
  return {
    codeKey: fallback,
    message: error instanceof Error ? error.message : undefined,
  };
};
