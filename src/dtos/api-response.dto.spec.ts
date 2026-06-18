import { describe, it, expect } from 'vitest';
import {
  createSuccessResponse,
  createErrorResponse,
  getHttpStatus,
} from './api-response.dto';
import {
  RESPONSE_CODES,
  ResponseCodeConfig,
} from '@/constants/response-codes.constant';

describe('api-response.dto', () => {
  describe('createSuccessResponse', () => {
    it('builds a success envelope with data and default message', () => {
      const res = createSuccessResponse({ id: 1 });
      expect(res).toMatchObject({ code: 200, success: true, data: { id: 1 } });
      expect(res.message).toBe(ResponseCodeConfig.SUCCESS.message);
    });

    it('uses a custom message when provided', () => {
      expect(createSuccessResponse(null, 'done').message).toBe('done');
    });
  });

  describe('createErrorResponse', () => {
    it('maps the code key to its numeric code + default message', () => {
      const res = createErrorResponse(RESPONSE_CODES.USER_NOT_FOUND);
      expect(res.success).toBe(false);
      expect(res.code).toBe(ResponseCodeConfig.USER_NOT_FOUND.code);
      expect(res.message).toBe(ResponseCodeConfig.USER_NOT_FOUND.message);
    });

    it('carries custom message + validation errors', () => {
      const res = createErrorResponse(RESPONSE_CODES.VALIDATION_ERROR, 'bad', [
        { field: 'email' },
      ]);
      expect(res.message).toBe('bad');
      expect(res.errors).toEqual([{ field: 'email' }]);
    });
  });

  describe('getHttpStatus', () => {
    it('returns the configured HTTP status for a code key', () => {
      expect(getHttpStatus(RESPONSE_CODES.FORBIDDEN)).toBe(403);
      expect(getHttpStatus(RESPONSE_CODES.USER_ALREADY_EXISTS)).toBe(409);
      expect(getHttpStatus(RESPONSE_CODES.SUCCESS)).toBe(200);
    });
  });

  describe('ResponseCodeConfig integrity', () => {
    it('every RESPONSE_CODES key has a matching config entry', () => {
      for (const key of Object.values(RESPONSE_CODES)) {
        expect(ResponseCodeConfig[key]).toBeDefined();
        expect(typeof ResponseCodeConfig[key].httpStatus).toBe('number');
      }
    });
  });
});
