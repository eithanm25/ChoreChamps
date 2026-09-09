import { SubscriptionTier } from '../entities/Family';

/**
 * FREE tier's ONE-TIME lifetime allowance of Claude AI photo reviews per family
 * (see task.routes.ts submit handler). This is not a recurring monthly quota:
 * once a household has used all 5, AI review stays locked until they buy a plan.
 */
export const FREE_TIER_AI_LIMIT = 5;

/** Max child proof photos per task submission, by tier. */
export const MAX_EXECUTION_PHOTOS_BY_TIER: Record<SubscriptionTier, number> = {
  [SubscriptionTier.FREE]: 3,
  [SubscriptionTier.PREMIUM]: 5,
  // ACADEMY is "unlimited" in spirit — bounded here to a generous ceiling for
  // abuse-safety rather than left fully unenforced.
  [SubscriptionTier.ACADEMY]: 20,
};

/** Max parent reference photos/PDFs attached at task creation, by tier. */
export const MAX_REFERENCE_PHOTOS_BY_TIER: Record<SubscriptionTier, number> = {
  [SubscriptionTier.FREE]: 1,
  [SubscriptionTier.PREMIUM]: 3,
  [SubscriptionTier.ACADEMY]: 10,
};

/** Only ACADEMY tier may submit PDF proof (multi-page worksheets/booklets) alongside images. */
export function tierAllowsPdfUploads(tier: SubscriptionTier): boolean {
  return tier === SubscriptionTier.ACADEMY;
}

/** Only ACADEMY tier may use the internal wallet ledger (sibling transfers, parent adjustments). */
export function tierAllowsWallet(tier: SubscriptionTier): boolean {
  return tier === SubscriptionTier.ACADEMY;
}
