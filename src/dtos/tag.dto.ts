import { z } from 'zod';

export const CreateTagSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const AttachTagSchema = z.object({
  tagId: z.coerce.number().int().positive(),
});

export type CreateTagDto = z.infer<typeof CreateTagSchema>;
export type AttachTagDto = z.infer<typeof AttachTagSchema>;
