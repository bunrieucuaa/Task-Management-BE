import { TaskPriority, TaskStatus } from '@/generated/prisma/enums';
import { z } from 'zod';

export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).optional(),
  projectId: z.coerce.number().int().positive(),
  assigneeId: z.coerce.number().int().positive().nullable().optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  deadline: z.coerce.date().nullable().optional(),
});

export const UpdateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    assigneeId: z.coerce.number().int().positive().nullable().optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    deadline: z.coerce.date().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

// Helper: convert empty string to undefined (for query params)
const emptyToUndefined = (val: unknown) => (val === '' ? undefined : val);

export const ListTasksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  projectId: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
  assigneeId: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
  status: z.preprocess(emptyToUndefined, z.nativeEnum(TaskStatus).optional()),
  priority: z.preprocess(emptyToUndefined, z.nativeEnum(TaskPriority).optional()),
  deadlineFrom: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  deadlineTo: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  search: z.preprocess(emptyToUndefined, z.string().optional()),
  sortBy: z.preprocess(
    emptyToUndefined,
    z.enum(['title', 'status', 'priority', 'deadline', 'createdAt', 'updatedAt']).optional().default('createdAt'),
  ),
  sortOrder: z.preprocess(emptyToUndefined, z.enum(['asc', 'desc']).optional().default('desc')),
});

export type CreateTaskDto = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskDto = z.infer<typeof UpdateTaskSchema>;
export type ListTasksQueryDto = z.infer<typeof ListTasksQuerySchema>;
