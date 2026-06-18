import { describe, it, expect } from 'vitest';
import { UserRole } from '@/generated/prisma/enums';
import { isAdmin, isPM, isPrivileged } from './roles';

describe('shared/auth/roles', () => {
  it('isAdmin only for ADMIN', () => {
    expect(isAdmin(UserRole.ADMIN)).toBe(true);
    expect(isAdmin(UserRole.PM)).toBe(false);
    expect(isAdmin(UserRole.MEMBER)).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it('isPM only for PM', () => {
    expect(isPM(UserRole.PM)).toBe(true);
    expect(isPM(UserRole.ADMIN)).toBe(false);
    expect(isPM(null)).toBe(false);
  });

  it('isPrivileged for ADMIN or PM, not MEMBER/null', () => {
    expect(isPrivileged(UserRole.ADMIN)).toBe(true);
    expect(isPrivileged(UserRole.PM)).toBe(true);
    expect(isPrivileged(UserRole.MEMBER)).toBe(false);
    expect(isPrivileged(null)).toBe(false);
  });
});
