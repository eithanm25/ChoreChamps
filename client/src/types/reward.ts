export type RewardCategory = 'household' | 'marketplace';
export type RewardType = 'individual' | 'collaborative';
export type RewardStatus = 'active' | 'completed' | 'fulfilled' | 'archived';

export interface PublicMember {
  id: string;
  name: string;
}

export interface RewardContributionDto {
  childId: string | null;
  childName: string;
  amount: string;
  contributedAt: string;
}

/** Mirrors server/src/utils/rewardSerializers.ts's RewardDto exactly. */
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
  targetChild: PublicMember | null;
  createdBy: PublicMember | null;
  fulfilledBy: PublicMember | null;
  completedAt: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  contributions: RewardContributionDto[];
}
