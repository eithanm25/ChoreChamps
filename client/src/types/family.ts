export type SubscriptionTier = 'free' | 'premium' | 'academy';

/** Mirrors GET /api/family/me's response shape. */
export interface FamilyInfo {
  id: string;
  familyName: string;
  familyCode: string | null;
  parentInviteCode?: string;
  tier: SubscriptionTier;
  aiUsageCount: number;
  /** null means unlimited (PREMIUM/ACADEMY) — only FREE carries a real cap here. */
  aiUsagesRemaining: number | null;
}

/** Mirrors server/src/utils/subscriptionLimits.ts's MAX_EXECUTION_PHOTOS_BY_TIER. */
export const MAX_EXECUTION_PHOTOS_BY_TIER: Record<SubscriptionTier, number> = {
  free: 3,
  premium: 5,
  academy: 20,
};

/** Mirrors server/src/utils/subscriptionLimits.ts's MAX_REFERENCE_PHOTOS_BY_TIER. */
export const MAX_REFERENCE_PHOTOS_BY_TIER: Record<SubscriptionTier, number> = {
  free: 1,
  premium: 3,
  academy: 10,
};

/** Only ACADEMY tier may attach PDF proof (multi-page worksheets/booklets) alongside images. */
export function tierAllowsPdfUploads(tier: SubscriptionTier): boolean {
  return tier === 'academy';
}

/** Only ACADEMY tier unlocks the internal wallet (sibling transfers). */
export function tierAllowsWallet(tier: SubscriptionTier): boolean {
  return tier === 'academy';
}
