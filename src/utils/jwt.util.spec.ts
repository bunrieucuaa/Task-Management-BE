import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signAccessToken, signRefreshToken, verifyToken } from './jwt.util';
import { TokenType } from '@/shared/interfaces/IJwt';
import { UserRole } from '@/generated/prisma/enums';
import { config } from '@/config/index';

const payload = {
  id: 42,
  email: 'user@example.com',
  role: UserRole.MEMBER,
  tokenVersion: 3,
};

describe('jwt.util', () => {
  it('signs an access token that verifies to the right claims', () => {
    const token = signAccessToken(payload);
    const decoded = verifyToken(token);
    expect(decoded.sub).toBe('42');
    expect(decoded.email).toBe('user@example.com');
    expect(decoded.role).toBe(UserRole.MEMBER);
    expect(decoded.type).toBe(TokenType.Access);
    expect(decoded.tokenVersion).toBe(3);
  });

  it('signs a refresh token with the refresh type', () => {
    expect(verifyToken(signRefreshToken(payload)).type).toBe(TokenType.Refresh);
  });

  it('throws "Token không hợp lệ" for a malformed token', () => {
    expect(() => verifyToken('not-a-jwt')).toThrow('Token không hợp lệ');
  });

  it('throws "Token không hợp lệ" for a token signed with another secret', () => {
    const bad = jwt.sign({ sub: '1' }, 'a-totally-different-secret-value-1234567890');
    expect(() => verifyToken(bad)).toThrow('Token không hợp lệ');
  });

  it('throws "Token đã hết hạn" for an expired token', () => {
    const expired = jwt.sign(
      { sub: '1', type: TokenType.Access, tokenVersion: 0 },
      config.jwt.secret,
      { expiresIn: -10 },
    );
    expect(() => verifyToken(expired)).toThrow('Token đã hết hạn');
  });
});
