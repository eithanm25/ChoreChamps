import { Router, Response } from 'express';
import { RewardCategory, RewardType } from '../entities/Reward';
import { AuthenticatedRequest, requireAuth, requireParent, requireChild } from '../middleware/auth';
import { createReward, getRewardCatalog, contributeToReward, fulfillReward, archiveReward } from '../services/rewardStore';
import { toRewardDto } from '../utils/rewardSerializers';

const router = Router();

/**
 * POST /api/rewards
 * Parent adds a reward to the family catalog — household (free) or
 * marketplace (affiliate-tracked product), individual (one child) or
 * collaborative (crowdfunded by the whole family).
 */
router.post('/', requireAuth, requireParent, async (req: AuthenticatedRequest, res: Response) => {
  const parent = req.user!;
  if (!parent.family) {
    res.status(400).json({ error: 'עליך להשתייך למשפחה כדי להוסיף תגמולים' });
    return;
  }

  const { title, description, category, type, targetAmount, affiliateUrl, imageUrl, targetChildId } = req.body as {
    title?: string;
    description?: string;
    category?: string;
    type?: string;
    targetAmount?: unknown;
    affiliateUrl?: string;
    imageUrl?: string;
    targetChildId?: string;
  };

  if (category !== RewardCategory.HOUSEHOLD && category !== RewardCategory.MARKETPLACE) {
    res.status(400).json({ error: "category must be 'household' or 'marketplace'" });
    return;
  }
  if (type !== RewardType.INDIVIDUAL && type !== RewardType.COLLABORATIVE) {
    res.status(400).json({ error: "type must be 'individual' or 'collaborative'" });
    return;
  }

  const outcome = await createReward({
    family: parent.family,
    createdBy: parent,
    title: title ?? '',
    description: description ?? '',
    category,
    type,
    targetAmount: Number(targetAmount),
    affiliateUrl,
    imageUrl,
    targetChildId,
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  res.status(201).json({ reward: toRewardDto(outcome.reward) });
});

/**
 * GET /api/rewards
 * The family's live reward catalog. A parent sees everything, for
 * management; a child sees every collaborative reward plus only their own
 * individual ones. Every entry carries its own freshly-computed funding
 * progress (totalContributed / remaining / progressPercent), always derived
 * from the contribution ledger itself rather than a cached counter.
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  if (!user.family) {
    res.status(400).json({ error: 'עליך להשתייך למשפחה כדי לצפות בחנות' });
    return;
  }

  const rewards = await getRewardCatalog(user.family, user);
  res.json({ rewards: rewards.map(toRewardDto) });
});

/**
 * POST /api/rewards/:id/contribute
 * A child puts ChoreCoins toward a reward — the full price at once for an
 * individual reward (a "purchase"), or any amount they choose for a
 * collaborative family goal. Flips to 'completed' automatically the instant
 * cumulative contributions reach the target; see rewardStore.contributeToReward
 * for how that stays race-safe under concurrent contributions.
 */
router.post('/:id/contribute', requireAuth, requireChild, async (req: AuthenticatedRequest, res: Response) => {
  const child = req.user!;
  const rewardId = req.params.id as string;
  const { amount } = req.body as { amount?: unknown };

  const outcome = await contributeToReward(rewardId, child, Number(amount));
  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  res.status(201).json({
    message: outcome.completed
      ? '🎉 מזל טוב! התגמול מומן במלואו!'
      : 'התרומה נקלטה בהצלחה',
    totalContributed: outcome.totalContributed,
    targetAmount: outcome.targetAmount,
    remaining: outcome.remaining,
    completed: outcome.completed,
  });
});

/**
 * POST /api/rewards/:id/fulfill
 * Parent confirms a fully-funded reward was actually handed over.
 */
router.post('/:id/fulfill', requireAuth, requireParent, async (req: AuthenticatedRequest, res: Response) => {
  const parent = req.user!;
  if (!parent.family) {
    res.status(400).json({ error: 'עליך להשתייך למשפחה' });
    return;
  }

  const outcome = await fulfillReward(req.params.id as string, parent.family.id, parent);
  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  res.json({ message: 'התגמול סומן כמומש בהצלחה', rewardId: outcome.rewardId });
});

/**
 * POST /api/rewards/:id/archive
 * Parent cancels a reward. Any coins already contributed are refunded to the
 * children who put them in.
 */
router.post('/:id/archive', requireAuth, requireParent, async (req: AuthenticatedRequest, res: Response) => {
  const parent = req.user!;
  if (!parent.family) {
    res.status(400).json({ error: 'עליך להשתייך למשפחה' });
    return;
  }

  const outcome = await archiveReward(req.params.id as string, parent.family.id);
  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  res.json({ message: 'התגמול בוטל וכל התרומות הוחזרו', refundedTotal: outcome.refundedTotal });
});

export default router;
