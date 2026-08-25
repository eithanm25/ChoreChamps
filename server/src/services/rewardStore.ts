import type { EntityManager } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Family } from '../entities/Family';
import { Reward, RewardCategory, RewardType, RewardStatus } from '../entities/Reward';
import { RewardContribution } from '../entities/RewardContribution';
import { ChildProfile } from '../entities/ChildProfile';
import { User, UserRole } from '../entities/User';
import { toCents, fromCents } from '../utils/money';

// ── Spendable balance (derived, never stored) ──────────────────────────────

/**
 * Sum of a child's contributions to every reward that's still valid — i.e.
 * excluding rewards that were archived, since an archived reward's coins are
 * implicitly "returned" the moment it stops counting against spendable
 * balance. Nothing is ever written back to ChildProfile for a "refund"; the
 * refund is just this filter naturally excluding it going forward.
 */
async function getSpentCents(manager: EntityManager, childId: string): Promise<number> {
  const row = await manager
    .createQueryBuilder(RewardContribution, 'c')
    .innerJoin(Reward, 'r', 'r.id = c."rewardId"')
    .select('COALESCE(SUM(c.amount), 0)', 'spent')
    .where('c."childId" = :childId', { childId })
    .andWhere('r.status != :archived', { archived: RewardStatus.ARCHIVED })
    .getRawOne<{ spent: string }>();
  return toCents(row?.spent ?? '0');
}

/**
 * ChoreCoins a child can spend right now: everything they've ever earned
 * (ChildProfile.lifetimeEarnings, which only ever grows via task approvals)
 * minus everything they've put toward a still-valid reward. This is the only
 * definition of "balance" in the rewards system — there is no separate
 * stored counter that could drift out of sync with it.
 */
export async function getSpendableBalance(childId: string): Promise<string> {
  const profile = await AppDataSource.getRepository(ChildProfile).findOne({ where: { id: childId } });
  if (!profile) {
    return '0.00';
  }
  const spentCents = await getSpentCents(AppDataSource.manager, childId);
  return fromCents(Math.max(0, toCents(profile.lifetimeEarnings) - spentCents));
}

// ── Create ──────────────────────────────────────────────────────────────

export interface CreateRewardInput {
  family: Family;
  createdBy: User;
  title: string;
  description: string;
  category: RewardCategory;
  type: RewardType;
  targetAmount: number;
  affiliateUrl?: string | null;
  targetChildId?: string | null;
}

export type CreateRewardOutcome =
  | { ok: true; reward: Reward }
  | { ok: false; status: number; error: string };

/**
 * Add a reward to the family catalog. Validation depends on category
 * (marketplace requires a real affiliateUrl) and type (individual requires a
 * real child in this family; collaborative must not name one, since it's
 * visible to everyone).
 */
export async function createReward(input: CreateRewardInput): Promise<CreateRewardOutcome> {
  const { family, createdBy, title, description, category, type, targetAmount, affiliateUrl, targetChildId } = input;

  if (!title.trim()) {
    return { ok: false, status: 400, error: 'שם התגמול הוא שדה חובה' };
  }
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return { ok: false, status: 400, error: 'עלות התגמול חייבת להיות מספר חיובי' };
  }

  let normalizedAffiliateUrl: string | null = null;
  if (category === RewardCategory.MARKETPLACE) {
    const trimmed = affiliateUrl?.trim();
    if (!trimmed) {
      return { ok: false, status: 400, error: 'תגמול משיווק (Marketplace) חייב לכלול קישור למוצר' };
    }
    try {
      new URL(trimmed);
    } catch {
      return { ok: false, status: 400, error: 'קישור המוצר אינו תקין' };
    }
    normalizedAffiliateUrl = trimmed;
  }

  let targetChild: User | null = null;
  if (type === RewardType.INDIVIDUAL) {
    if (!targetChildId) {
      return { ok: false, status: 400, error: 'יש לבחור עבור איזה ילד/ה מיועד התגמול האישי' };
    }
    const userRepo = AppDataSource.getRepository(User);
    targetChild = await userRepo.findOne({
      where: { id: targetChildId, family: { id: family.id }, role: UserRole.CHILD },
    });
    if (!targetChild) {
      return { ok: false, status: 404, error: 'הילד/ה שנבחרו לא נמצאו במשפחה זו' };
    }
  } else if (targetChildId) {
    return { ok: false, status: 400, error: 'תגמול משפחתי-שיתופי לא יכול להיות משויך לילד ספציפי' };
  }

  const rewardRepo = AppDataSource.getRepository(Reward);
  const reward = rewardRepo.create({
    family,
    title: title.trim(),
    description: description.trim(),
    category,
    type,
    targetAmount: targetAmount.toFixed(2),
    affiliateUrl: normalizedAffiliateUrl,
    targetChild,
    createdBy,
    status: RewardStatus.ACTIVE,
  });
  await rewardRepo.save(reward);

  return { ok: true, reward };
}

// ── Catalog ─────────────────────────────────────────────────────────────

/**
 * The family's active reward catalog. A parent sees every non-archived
 * reward, for management. A child sees every collaborative reward (visible
 * family-wide) plus only their own individual ones — never a sibling's.
 */
export async function getRewardCatalog(family: Family, requester: User): Promise<Reward[]> {
  const query = AppDataSource.getRepository(Reward)
    .createQueryBuilder('reward')
    .leftJoinAndSelect('reward.targetChild', 'targetChild')
    .leftJoinAndSelect('reward.createdBy', 'createdBy')
    .leftJoinAndSelect('reward.fulfilledBy', 'fulfilledBy')
    .leftJoinAndSelect('reward.contributions', 'contribution')
    .leftJoinAndSelect('contribution.child', 'contributorChild')
    .where('reward.familyId = :familyId', { familyId: family.id })
    .andWhere('reward.status != :archived', { archived: RewardStatus.ARCHIVED })
    .orderBy('reward.createdAt', 'DESC');

  if (requester.role === UserRole.CHILD) {
    query.andWhere('(reward.type = :collaborative OR reward.targetChildId = :childId)', {
      collaborative: RewardType.COLLABORATIVE,
      childId: requester.id,
    });
  }

  return query.getMany();
}

// ── Contribute (purchase = a single full-amount contribution) ─────────────

export type ContributeOutcome =
  | {
      ok: true;
      totalContributed: string;
      targetAmount: string;
      remaining: string;
      completed: boolean;
    }
  | { ok: false; status: number; error: string };

/**
 * A child puts `amount` ChoreCoins toward a reward. For an individual reward
 * this must be exactly the full targetAmount, and only the reward's own
 * targetChild may call it (i.e. "buying" it). For a collaborative reward any
 * family child may contribute any positive amount, as many times as they
 * like, including an amount that overshoots what's left — the child chooses
 * their own generosity.
 *
 * Concurrency: BOTH the reward row and the contributing child's ChildProfile
 * row are locked (SELECT ... FOR UPDATE) for the duration of the transaction
 * — two separate races, two separate locks:
 *   - The reward lock serializes contributions FROM DIFFERENT CHILDREN to the
 *     SAME reward. Without it, two contributions arriving at nearly the same
 *     instant could each read the pre-contribution sum, each individually
 *     stay under the target, and neither would ever trigger the flip to
 *     'completed' even though their combined total crossed it.
 *   - The ChildProfile lock serializes contributions FROM THE SAME CHILD,
 *     even to two DIFFERENT rewards at once (the reward lock alone can't
 *     catch that, since it's a different row each time). Without it, a child
 *     firing two simultaneous contributions could have each one individually
 *     see a spendable balance that doesn't yet reflect the other's in-flight
 *     spend, together overspending past what they've actually earned.
 */
export async function contributeToReward(
  rewardId: string,
  child: User,
  amount: number,
): Promise<ContributeOutcome> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, status: 400, error: 'סכום התרומה חייב להיות גדול מאפס' };
  }
  if (!child.family) {
    return { ok: false, status: 400, error: 'עליך להשתייך למשפחה כדי לתרום לתגמול' };
  }

  const amountCents = Math.round(amount * 100);
  const amountStr = fromCents(amountCents);

  return AppDataSource.transaction(async (manager) => {
    const reward = await manager.findOne(Reward, {
      where: { id: rewardId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!reward) {
      return { ok: false, status: 404, error: 'התגמול לא נמצא' };
    }
    if (reward.familyId !== child.family!.id) {
      return { ok: false, status: 403, error: 'התגמול אינו שייך למשפחה שלך' };
    }
    if (reward.status !== RewardStatus.ACTIVE) {
      return { ok: false, status: 409, error: 'התגמול הזה כבר לא פתוח לתרומות' };
    }

    if (reward.type === RewardType.INDIVIDUAL) {
      if (reward.targetChildId !== child.id) {
        return { ok: false, status: 403, error: 'תגמול אישי זה שייך לצ׳אמפ אחר/ת במשפחה' };
      }
      const targetCents = toCents(reward.targetAmount);
      if (amountCents !== targetCents) {
        return {
          ok: false,
          status: 400,
          error: `רכישת תגמול אישי היא תמיד בעלות המלאה — ${reward.targetAmount} מטבעות`,
        };
      }
    }
    // Collaborative: any positive amount from any child in the family is
    // accepted as-is, overshoot included — see docstring above.

    const profile = await manager.findOne(ChildProfile, {
      where: { id: child.id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!profile) {
      return { ok: false, status: 404, error: 'לא נמצא תיק דמי כיס עבור ילד/ה זו' };
    }

    const spentCents = await getSpentCents(manager, child.id);
    const spendableCents = Math.max(0, toCents(profile.lifetimeEarnings) - spentCents);
    if (amountCents > spendableCents) {
      return { ok: false, status: 409, error: 'אין מספיק מטבעות ביתרה לתרומה הזו' };
    }

    const contribution = manager.create(RewardContribution, {
      rewardId: reward.id,
      childId: child.id,
      amount: amountStr,
    });
    await manager.save(contribution);

    const sumRow = await manager
      .createQueryBuilder(RewardContribution, 'c')
      .select('COALESCE(SUM(c.amount), 0)', 'sum')
      .where('c."rewardId" = :rewardId', { rewardId })
      .getRawOne<{ sum: string }>();

    const totalCents = toCents(sumRow?.sum ?? '0');
    const targetCents = toCents(reward.targetAmount);
    let completed = false;

    if (totalCents >= targetCents) {
      const transition = await manager
        .createQueryBuilder()
        .update(Reward)
        .set({ status: RewardStatus.COMPLETED, completedAt: () => 'now()' })
        .where('id = :rewardId AND status = :expected', { rewardId, expected: RewardStatus.ACTIVE })
        .execute();
      completed = !!transition.affected;
    }

    return {
      ok: true,
      totalContributed: fromCents(totalCents),
      targetAmount: reward.targetAmount,
      remaining: fromCents(Math.max(0, targetCents - totalCents)),
      completed,
    };
  });
}

// ── Fulfill ─────────────────────────────────────────────────────────────

export type FulfillOutcome =
  | { ok: true; rewardId: string }
  | { ok: false; status: number; error: string };

/** Parent confirms a fully-funded reward was actually handed over in real life. */
export async function fulfillReward(rewardId: string, familyId: string, parent: User): Promise<FulfillOutcome> {
  const rewardRepo = AppDataSource.getRepository(Reward);
  const reward = await rewardRepo.findOne({ where: { id: rewardId } });

  if (!reward) {
    return { ok: false, status: 404, error: 'התגמול לא נמצא' };
  }
  if (reward.familyId !== familyId) {
    return { ok: false, status: 403, error: 'התגמול אינו שייך למשפחתך' };
  }
  if (reward.status !== RewardStatus.COMPLETED) {
    return { ok: false, status: 409, error: 'ניתן לסמן כמומש רק תגמול שהמימון שלו הושלם' };
  }

  const transition = await rewardRepo
    .createQueryBuilder()
    .update(Reward)
    .set({ status: RewardStatus.FULFILLED, fulfilledAt: () => 'now()', fulfilledBy: parent })
    .where('id = :rewardId AND status = :expected', { rewardId, expected: RewardStatus.COMPLETED })
    .execute();

  if (!transition.affected) {
    return { ok: false, status: 409, error: 'התגמול כבר סומן כמומש' };
  }

  return { ok: true, rewardId };
}

// ── Archive (cancel + refund) ───────────────────────────────────────────

export type ArchiveOutcome =
  | { ok: true; refundedTotal: string }
  | { ok: false; status: number; error: string };

/**
 * Parent cancels a reward. Since spendable balance is always derived as
 * lifetimeEarnings minus contributions to non-archived rewards (see
 * getSpendableBalance above), there is no explicit refund step to perform —
 * the moment this reward's status flips to 'archived', its contributions
 * stop counting against every contributor's spendable balance automatically.
 * The contribution rows themselves are kept for history, not deleted.
 */
export async function archiveReward(rewardId: string, familyId: string): Promise<ArchiveOutcome> {
  return AppDataSource.transaction(async (manager) => {
    const reward = await manager.findOne(Reward, {
      where: { id: rewardId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!reward) {
      return { ok: false, status: 404, error: 'התגמול לא נמצא' };
    }
    if (reward.familyId !== familyId) {
      return { ok: false, status: 403, error: 'התגמול אינו שייך למשפחתך' };
    }
    if (reward.status === RewardStatus.FULFILLED) {
      return { ok: false, status: 400, error: 'לא ניתן לבטל תגמול שכבר מומש' };
    }
    if (reward.status === RewardStatus.ARCHIVED) {
      return { ok: false, status: 409, error: 'התגמול כבר בוטל' };
    }

    const contributedRow = await manager
      .createQueryBuilder(RewardContribution, 'c')
      .select('COALESCE(SUM(c.amount), 0)', 'total')
      .where('c."rewardId" = :rewardId', { rewardId })
      .getRawOne<{ total: string }>();

    await manager
      .createQueryBuilder()
      .update(Reward)
      .set({ status: RewardStatus.ARCHIVED })
      .where('id = :rewardId', { rewardId })
      .execute();

    return { ok: true, refundedTotal: contributedRow?.total ?? '0.00' };
  });
}
