import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { errorHandler } from './error.middleware';
import { mockRequest, mockResponse, mockNext } from '@/test/express.mock';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.NODE_ENV;
});

describe('errorHandler', () => {
  it('uses err.statusCode and err.message when present', () => {
    const res = mockResponse();
    errorHandler({ statusCode: 418, message: 'teapot' } as any, mockRequest(), res, mockNext());
    expect(res.statusCode).toBe(418);
    expect((res.body as any)).toMatchObject({ success: false, message: 'teapot' });
  });

  it('defaults to 500 and a generic message', () => {
    const res = mockResponse();
    errorHandler({} as any, mockRequest(), res, mockNext());
    expect(res.statusCode).toBe(500);
    expect((res.body as any).message).toBe('Internal Server Error');
  });

  it('hides the stack outside development', () => {
    process.env.NODE_ENV = 'production';
    const res = mockResponse();
    errorHandler({ message: 'x', stack: 'secret-stack' } as any, mockRequest(), res, mockNext());
    expect((res.body as any).stack).toBeUndefined();
  });

  it('exposes the stack in development', () => {
    process.env.NODE_ENV = 'development';
    const res = mockResponse();
    errorHandler({ message: 'x', stack: 'dev-stack' } as any, mockRequest(), res, mockNext());
    expect((res.body as any).stack).toBe('dev-stack');
  });
});
