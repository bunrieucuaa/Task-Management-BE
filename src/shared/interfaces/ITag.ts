export type { PaginationParams, PaginatedResult } from './IUser';

/** A tag row exposed to clients (catalog item). */
export const selectTagItem = {
  id: true,
  name: true,
} as const;
