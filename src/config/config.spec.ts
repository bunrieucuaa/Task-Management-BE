import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * config/index.ts validates env at import time (fail-fast). We re-import it in a
 * fresh module registry per case with stubbed env to exercise each branch.
 */
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const importConfig = () => import('@/config/index');

describe('config fail-fast', () => {
  it('throws when JWT_SECRET is missing/empty', async () => {
    vi.resetModules();
    vi.stubEnv('JWT_SECRET', '');
    await expect(importConfig()).rejects.toThrow(/JWT_SECRET|bắt buộc/);
  });

  it('throws when JWT_SECRET is shorter than 32 chars', async () => {
    vi.resetModules();
    vi.stubEnv('JWT_SECRET', 'too-short');
    await expect(importConfig()).rejects.toThrow(/quá yếu|>= 32/);
  });

  it('throws when JWT_SECRET is a known weak/sample value', async () => {
    vi.resetModules();
    vi.stubEnv('JWT_SECRET', 'change-this-secret-in-production');
    await expect(importConfig()).rejects.toThrow(/quá yếu|mẫu/);
  });

  it('accepts a strong secret and parses CORS origins', async () => {
    vi.resetModules();
    vi.stubEnv('JWT_SECRET', 'a'.repeat(40));
    vi.stubEnv('CORS_ORIGIN', 'https://a.com, https://b.com');
    const { config } = await importConfig();
    expect(config.jwt.secret.length).toBeGreaterThanOrEqual(32);
    expect(config.corsOrigins).toEqual(['https://a.com', 'https://b.com']);
    expect(config.jwt.accessExpiresInSeconds).toBe(3600);
  });
});
