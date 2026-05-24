import { z } from 'zod';

// Login DTO
export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginRequestDto = z.infer<typeof LoginRequestSchema>;

// Change Password DTO
export const ChangePasswordRequestSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'New password must not exceed 128 characters'),
});

// Refresh Token DTO
export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenRequestDto = z.infer<typeof RefreshTokenRequestSchema>;
