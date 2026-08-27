import { Reward, RewardCategory, RewardStatus, RewardType } from '../entities/Reward';
import { toPublicMember, PublicMember } from './serializers';
import { toCents, fromCents } from './money';

export interface RewardContributionDto {
  childId: string | null;
  childName: string;
  amount: string;
  contributedAt: Date;
}

export interface RewardDto {
  id: string;
  title: string;
  description: string;
  category: RewardCategory;
  type: RewardType;
  status: RewardStatus;
  targetAmount: string;
  totalContributed: string;
  remaining: string;
  progressPercent: number;
  affiliateUrl: string | null;
  imageUrl: string | null;
  targetChild: PublicMember | null;
  createdBy: PublicMember | null;
  fulfilledBy: PublicMember | null;
  completedAt: Date | null;
  fulfilledAt: Date | null;
  createdAt: Date;
  /** Newest first — who has put coins toward this reward, and how much. */
  contributions: RewardContributionDto[];
}

/**
 * Convert a Reward (with its contributions relation loaded) into the
 * client-safe DTO, computing live funding metrics from the ledger every time
 * — there is no separately-stored "total raised" counter to drift out of
 * sync, the sum of contribution rows is always the source of truth.
 */
export function toRewardDto(reward: Reward): RewardDto {
  const targetCents = toCents(reward.targetAmount);
  const contributions = reward.contributions ?? [];
  const totalCents = contributions.reduce((sum, c) => sum + toCents(c.amount), 0);

  return {
    id: reward.id,
    title: reward.title,
    description: reward.description,
    category: reward.category,
    type: reward.type,
    status: reward.status,
    targetAmount: reward.targetAmount,
    totalContributed: fromCents(totalCents),
    remaining: fromCents(Math.max(0, targetCents - totalCents)),
    progressPercent: targetCents > 0 ? Math.min(100, Math.round((totalCents / targetCents) * 100)) : 0,
    affiliateUrl: reward.affiliateUrl,
    imageUrl: reward.imageUrl,
    targetChild: toPublicMember(reward.targetChild),
    createdBy: toPublicMember(reward.createdBy),
    fulfilledBy: toPublicMember(reward.fulfilledBy),
    completedAt: reward.completedAt,
    fulfilledAt: reward.fulfilledAt,
    createdAt: reward.createdAt,
    contributions: contributions
      .slice()
      .sort((a, b) => b.contributedAt.getTime() - a.contributedAt.getTime())
      .map((c) => ({
        childId: c.childId,
        childName: c.child?.name ?? 'צ׳אמפ (הוסר מהמערכת)',
        amount: c.amount,
        contributedAt: c.contributedAt,
      })),
  };
}
