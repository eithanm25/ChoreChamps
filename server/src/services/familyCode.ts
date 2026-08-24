import { AppDataSource } from '../data-source';
import { Family } from '../entities/Family';
import { generateFourDigitCode } from '../utils/crypto';

/** Postgres unique-violation error code, used to turn a duplicate name/code into a friendly 4xx. */
export const PG_UNIQUE_VIOLATION = '23505';

/**
 * Generate a family code that doesn't already exist. A bare random 4-digit
 * code collides often enough at real scale to need a check-and-retry loop —
 * this is not just theoretical, 10,000 total values is a small keyspace.
 * Falls back to a wider random range after repeated collisions rather than
 * looping forever.
 *
 * Shared by POST /api/family/create and POST /api/auth/google (Flow A, where
 * a brand-new family is created inline for a first-time Google sign-in).
 */
export async function generateUniqueFamilyCode(): Promise<string> {
  const familyRepo = AppDataSource.getRepository(Family);

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateFourDigitCode();
    const existing = await familyRepo.findOne({ where: { familyCode: code } });
    if (!existing) {
      return code;
    }
  }

  // Extremely unlikely after 10 attempts, but widen the keyspace rather than
  // ever returning a colliding code.
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const existing = await familyRepo.findOne({ where: { familyCode: code } });
    if (!existing) {
      return code;
    }
  }

  throw new Error('לא ניתן היה להנפיק קוד משפחה ייחודי, נסו שוב');
}
