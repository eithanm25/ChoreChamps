import { AppDataSource } from '../data-source';
import { Family } from '../entities/Family';
import { generateSixDigitCode } from '../utils/crypto';

/** Postgres unique-violation error code, used to turn a duplicate name/code into a friendly 4xx. */
export const PG_UNIQUE_VIOLATION = '23505';

/**
 * Generate a 6-digit family code that doesn't already exist. With a 900,000-value
 * keyspace, collisions are rare even at tens of thousands of families, but the
 * check-and-retry loop keeps the guarantee absolute rather than probabilistic.
 *
 * Shared by POST /api/family/create and POST /api/auth/google (Flow A, where
 * a brand-new family is created inline for a first-time Google sign-in).
 */
export async function generateUniqueFamilyCode(): Promise<string> {
  const familyRepo = AppDataSource.getRepository(Family);

  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateSixDigitCode();
    const existing = await familyRepo.findOne({ where: { familyCode: code } });
    if (!existing) {
      return code;
    }
  }

  throw new Error('לא ניתן היה להנפיק קוד משפחה ייחודי, נסו שוב');
}
