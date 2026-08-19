import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 64;

/**
 * Hash a plaintext password with Node crypto scrypt (no bcrypt dependency).
 * Stored format: "<salt>:<hex-hash>"
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

/** Verify a plaintext password against a scrypt hash produced by hashPassword. */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) {
    return false;
  }

  const expected = Buffer.from(expectedHex, 'hex');
  const derived = scryptSync(password, salt, KEY_LENGTH);

  if (expected.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(expected, derived);
}

/** Generate a short unique invite code for family join links. */
export function generateInviteCode(): string {
  return randomBytes(6).toString('hex').toUpperCase();
}
