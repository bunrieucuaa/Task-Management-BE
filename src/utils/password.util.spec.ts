import { describe, it, expect } from 'vitest';
import {
  generateSalt,
  generateRandomPassword,
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from './password.util';

describe('password.util', () => {
  describe('generateSalt', () => {
    it('returns a 32-char hex string (16 bytes)', () => {
      const salt = generateSalt();
      expect(salt).toMatch(/^[0-9a-f]{32}$/);
    });

    it('returns a different value each call', () => {
      expect(generateSalt()).not.toBe(generateSalt());
    });
  });

  describe('generateRandomPassword', () => {
    it('respects the requested length', () => {
      expect(generateRandomPassword(20)).toHaveLength(20);
    });

    it('contains at least one upper, lower, digit and special char', () => {
      const pwd = generateRandomPassword(16);
      expect(pwd).toMatch(/[A-Z]/);
      expect(pwd).toMatch(/[a-z]/);
      expect(pwd).toMatch(/[0-9]/);
      expect(pwd).toMatch(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/);
    });

    it('default length falls within 12-16', () => {
      const len = generateRandomPassword().length;
      expect(len).toBeGreaterThanOrEqual(12);
      expect(len).toBeLessThanOrEqual(16);
    });
  });

  describe('hashPassword / verifyPassword', () => {
    it('verifies the correct password against its hash + salt', async () => {
      const salt = generateSalt();
      const hash = await hashPassword('Sup3r$ecret', salt);
      expect(hash).not.toBe('Sup3r$ecret');
      expect(await verifyPassword('Sup3r$ecret', hash, salt)).toBe(true);
    });

    it('rejects a wrong password', async () => {
      const salt = generateSalt();
      const hash = await hashPassword('Sup3r$ecret', salt);
      expect(await verifyPassword('wrong', hash, salt)).toBe(false);
    });

    it('rejects the right password with the wrong salt', async () => {
      const hash = await hashPassword('Sup3r$ecret', generateSalt());
      expect(await verifyPassword('Sup3r$ecret', hash, generateSalt())).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('accepts a strong password', () => {
      expect(validatePasswordStrength('Sup3r$ecret').isValid).toBe(true);
    });

    it.each([
      ['', 'Password is required'],
      ['Aa1!aa', 'at least 8 characters'],
      ['abcdefg1!', 'uppercase'],
      ['ABCDEFG1!', 'lowercase'],
      ['Abcdefgh!', 'one number'],
      ['Abcdefg1', 'special character'],
    ])('rejects %j with a message about %s', (pwd, fragment) => {
      const res = validatePasswordStrength(pwd as string);
      expect(res.isValid).toBe(false);
      expect(res.message).toContain(fragment as string);
    });

    it('rejects a password over 128 characters', () => {
      const res = validatePasswordStrength('Aa1!' + 'a'.repeat(130));
      expect(res.isValid).toBe(false);
      expect(res.message).toContain('not exceed 128');
    });
  });
});
