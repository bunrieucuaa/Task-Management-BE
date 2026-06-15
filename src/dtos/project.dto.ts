import { ProjectStatus } from '@/generated/prisma/enums';
import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).optional(),
  // Optional initial members (besides the owner) added atomically on create.
  memberIds: z.array(z.coerce.number().int().positive()).optional(),
});

export const UpdateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: z.nativeEnum(ProjectStatus).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const AddMemberSchema = z.object({
  email: z.string().trim().email(),
});

// Helper: convert empty string to undefined (for query params)
const emptyToUndefined = (val: unknown) => (val === '' ? undefined : val);

export const ListProjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  search: z.preprocess(emptyToUndefined, z.string().optional()),
  status: z.preprocess(emptyToUndefined, z.nativeEnum(ProjectStatus).optional()),
  sortBy: z.preprocess(
    emptyToUndefined,
    z.enum(['name', 'status', 'createdAt', 'updatedAt']).optional().default('createdAt'),
  ),
  sortOrder: z.preprocess(emptyToUndefined, z.enum(['asc', 'desc']).optional().default('desc')),
});

export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectDto = z.infer<typeof UpdateProjectSchema>;
export type AddMemberDto = z.infer<typeof AddMemberSchema>;
export type ListProjectsQueryDto = z.infer<typeof ListProjectsQuerySchema>;
