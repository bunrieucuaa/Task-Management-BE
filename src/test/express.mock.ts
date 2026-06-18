import { vi } from 'vitest';
import type { Request, Response } from 'express';

/** Minimal mocked Express Response with chainable status()/json(). */
export const mockResponse = () => {
  const res: Partial<Response> & { body?: unknown; statusCode?: number } = {};
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res as Response;
  }) as unknown as Response['status'];
  res.json = vi.fn((payload: unknown) => {
    res.body = payload;
    return res as Response;
  }) as unknown as Response['json'];
  return res as Response & { body?: unknown; statusCode?: number };
};

export const mockRequest = (overrides: Partial<Request> = {}): Request =>
  ({ headers: {}, path: '/', ...overrides } as Request);

export const mockNext = () => vi.fn();
