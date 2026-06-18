import { vi } from 'vitest';

/**
 * A fully-mocked Prisma client for service unit tests. Every model delegate
 * exposes the common methods as `vi.fn()`, and `$transaction` invokes its
 * callback with the same mock (so `tx.*` calls hit the same spies).
 *
 * Usage (note the dynamic import to dodge vi.mock hoisting pitfalls):
 *
 *   vi.mock('@/config/prisma', async () => {
 *     const { createPrismaMock } = await import('@/test/prisma.mock');
 *     const prisma = createPrismaMock();
 *     return { prisma, default: prisma };
 *   });
 *   import { prisma } from '@/config/prisma';
 *   const db = prisma as unknown as PrismaMock;
 */
const modelMethods = () => ({
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  count: vi.fn(),
});

export type PrismaMock = ReturnType<typeof createPrismaMock>;

export const createPrismaMock = () => {
  const prisma = {
    user: modelMethods(),
    project: modelMethods(),
    projectMember: modelMethods(),
    task: modelMethods(),
    taskComment: modelMethods(),
    tag: modelMethods(),
    $transaction: vi.fn(),
  };

  // Support both callback form and array form of $transaction.
  prisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: typeof prisma) => unknown)(prisma)
      : Promise.all(arg as Promise<unknown>[]),
  );

  return prisma;
};
