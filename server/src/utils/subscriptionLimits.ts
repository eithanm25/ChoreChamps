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
  // "Unlimited" in spirit — bounded here to a generous ceiling for
  // abuse-safety rather than left fully unenforced.
  [SubscriptionTier.PREMIUM]: 20,
};

/** Max parent reference photos/PDFs attached at task creation, by tier. */
export const MAX_REFERENCE_PHOTOS_BY_TIER: Record<SubscriptionTier, number> = {
  [SubscriptionTier.FREE]: 1,
  [SubscriptionTier.PREMIUM]: 10,
};

/** Only PREMIUM may submit PDF proof (multi-page worksheets/booklets) alongside images. */
export function tierAllowsPdfUploads(tier: SubscriptionTier): boolean {
  return tier === SubscriptionTier.PREMIUM;
}

// The wallet ledger (sibling transfers, parent adjustments) is available on
// every tier, FREE included — see wallet.routes.ts, which no longer gates on
// tier at all.

// ─────────────────────────────────────────────────────────────────────────
// Flat anti-abuse ceilings — NOT tier-gated. These apply to every family
// regardless of plan; they exist to bound worst-case DB row growth, storage
// use, and Anthropic spend from a runaway script or a compromised account,
// not to upsell. See family.routes.ts (add-child) and task.routes.ts
// (task creation, proof submission) for where each is enforced.
// ─────────────────────────────────────────────────────────────────────────

/** Hard cap on child profiles per family. */
export const MAX_CHILDREN_PER_FAMILY = 6;

/** Hard cap on tasks a family may have sitting in 'pending' (assigned, not yet submitted) at once. */
export const MAX_PENDING_TASKS_PER_FAMILY = 10;

/** Hard cap on proof submissions a family may make across the whole household in one calendar day. */
export const MAX_DAILY_SUBMISSIONS_PER_FAMILY = 15;
