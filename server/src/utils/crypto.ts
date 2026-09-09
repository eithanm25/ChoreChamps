import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'crypto';

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
 * Generate a short single-use co-parent invite code (8 hex chars) — shorter
 * than generateInviteCode's 12, matching the "short" requirement for a code
 * meant to be typed or pasted into a URL and used exactly once before being
 * cleared by the server.
 */
export function generateShortInviteCode(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Generate a 6-digit numeric household code (e.g. "830715") for device-agnostic
 * login. 900,000 possible values — wide enough that collisions are rare and a
 * code is not feasibly guessable (combined with the name + PIN also required at
 * login, and API rate limiting). Uses crypto.randomInt for a uniform, unbiased,
 * crypto-grade draw. Uniqueness against existing families is still the caller's
 * responsibility — see generateUniqueFamilyCode in services/familyCode.ts.
 */
export function generateSixDigitCode(): string {
  return String(randomInt(100000, 1000000));
}
