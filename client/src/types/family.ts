/**
 * A single paid PREMIUM tier, billed monthly or annually (see
 * data/subscriptionPlans.ts) — there used to be a second, pricier ACADEMY
 * tier; it was folded into PREMIUM when the product moved to one unified
 * paid plan.
 */
export type SubscriptionTier = 'free' | 'premium';

/** Mirrors GET /api/family/me's response shape. */
export interface FamilyInfo {
  id: string;
  familyName: string;
  familyCode: string | null;
  parentInviteCode?: string;
  tier: SubscriptionTier;
  aiUsageCount: number;
  /** null means unlimited (PREMIUM) — only FREE carries a real cap here. */
  aiUsagesRemaining: number | null;
}

/** Mirrors server/src/utils/subscriptionLimits.ts's MAX_EXECUTION_PHOTOS_BY_TIER. */
export const MAX_EXECUTION_PHOTOS_BY_TIER: Record<SubscriptionTier, number> = {
  free: 3,
  premium: 20,
};

/** Mirrors server/src/utils/subscriptionLimits.ts's MAX_REFERENCE_PHOTOS_BY_TIER. */
export const MAX_REFERENCE_PHOTOS_BY_TIER: Record<SubscriptionTier, number> = {
  free: 1,
  premium: 10,
};

/** Only PREMIUM may attach PDF proof (multi-page worksheets/booklets) alongside images. */
export function tierAllowsPdfUploads(tier: SubscriptionTier): boolean {
  return tier === 'premium';
}

// The wallet (sibling transfers, parent adjustments) is available on every
// tier, FREE included — there is no tierAllowsWallet gate any more.
