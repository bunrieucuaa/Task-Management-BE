import { z } from 'zod';

export const CreateCommentSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

// Helper: convert empty string to undefined (for query params)
const emptyToUndefined = (val: unknown) => (val === '' ? undefined : val);

export const ListCommentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
});

export type CreateCommentDto = z.infer<typeof CreateCommentSchema>;
export type ListCommentsQueryDto = z.infer<typeof ListCommentsQuerySchema>;
