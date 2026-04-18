import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const GENERATED_PASSWORD_MIN_LENGTH = 12;
const GENERATED_PASSWORD_MAX_LENGTH = 16;

/**
 * Generate a random salt
 * @returns Random salt string
 */
export const generateSalt = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Generate a strong random password
 * @param length Length of password (default: random between 12-16)
 * @returns Generated password
 */
export const generateRandomPassword = (
  length: number = Math.floor(
    Math.random() * (GENERATED_PASSWORD_MAX_LENGTH - GENERATED_PASSWORD_MIN_LENGTH + 1)
  ) + GENERATED_PASSWORD_MIN_LENGTH
): string => {
  const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
  const numberChars = '0123456789';
  const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const allChars = uppercaseChars + lowercaseChars + numberChars + specialChars;

  let password = '';
  // Ensure at least one character from each category
  
  password += uppercaseChars[Math.floor(Math.random() * uppercaseChars.length)];
  password += lowercaseChars[Math.floor(Math.random() * lowercaseChars.length)];
  password += numberChars[Math.floor(Math.random() * numberChars.length)];
  password += specialChars[Math.floor(Math.random() * specialChars.length)];

  // Fill the rest with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
};

/**
 * Hash a password with the provided salt using bcrypt
 * @param password Plain text password
 * @param salt Salt to use for hashing
 * @returns Hashed password
 */
export const hashPassword = async (password: string, salt: string): Promise<string> => {
  // Combine password with custom salt before bcrypt hashing
  const saltedPassword = password + salt;
  return await bcrypt.hash(saltedPassword, SALT_ROUNDS);
};

/**
 * Verify a password against its hash and salt
 * @param password Plain text password to verify
 * @param hash Stored password hash
 * @param salt Stored salt
 * @returns True if password matches
 */
export const verifyPassword = async (
  password: string,
  hash: string,
  salt: string
): Promise<boolean> => {
  const saltedPassword = password + salt;
  return await bcrypt.compare(saltedPassword, hash);
};

/**
 * Validate password strength requirements
 * @param password Password to validate
 * @returns Validation result with error message if invalid
 */
export const validatePasswordStrength = (
  password: string
): {
  isValid: boolean;
  message?: string;
} => {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      isValid: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      isValid: false,
      message: `Password must not exceed ${MAX_PASSWORD_LENGTH} characters`,
    };
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one uppercase letter',
    };
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one lowercase letter',
    };
  }

  // Check for at least one number
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }

  // Check for at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one special character',
    };
  }

  return { isValid: true };
};
