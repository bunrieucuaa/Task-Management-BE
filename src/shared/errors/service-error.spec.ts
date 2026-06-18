import { describe, it, expect } from 'vitest';
import { RESPONSE_CODES } from '@/constants/response-codes.constant';
import { ServiceError, resolveError } from './service-error';

describe('ServiceError', () => {
  it('carries its codeKey and message', () => {
    const err = new ServiceError(RESPONSE_CODES.PROJECT_NOT_FOUND, 'nope');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ServiceError');
    expect(err.codeKey).toBe(RESPONSE_CODES.PROJECT_NOT_FOUND);
    expect(err.message).toBe('nope');
  });
});

describe('resolveError', () => {
  it('preserves the codeKey + message of a ServiceError', () => {
    const err = new ServiceError(RESPONSE_CODES.FORBIDDEN, 'denied');
    expect(resolveError(err)).toEqual({
      codeKey: RESPONSE_CODES.FORBIDDEN,
      message: 'denied',
    });
  });

  it('falls back to INTERNAL_SERVER_ERROR for a plain Error', () => {
    expect(resolveError(new Error('boom'))).toEqual({
      codeKey: RESPONSE_CODES.INTERNAL_SERVER_ERROR,
      message: 'boom',
    });
  });

  it('honours a custom fallback code', () => {
    const res = resolveError(new Error('bad'), RESPONSE_CODES.VALIDATION_ERROR);
    expect(res.codeKey).toBe(RESPONSE_CODES.VALIDATION_ERROR);
  });

  it('handles a non-Error throw (string) with no message', () => {
    expect(resolveError('weird')).toEqual({
      codeKey: RESPONSE_CODES.INTERNAL_SERVER_ERROR,
      message: undefined,
    });
  });
});
