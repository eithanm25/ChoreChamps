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

/**
 * Generate a 4-digit numeric household code (e.g. "4092") for device-agnostic
 * login. Uniqueness against existing families is the caller's responsibility
 * (see generateFamilyCode in family.routes.ts) — a random 4-digit code alone
 * has only 10,000 possible values, so collisions are expected at scale.
 */
export function generateFourDigitCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
