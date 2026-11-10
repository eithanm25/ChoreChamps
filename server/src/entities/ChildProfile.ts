import {
  Entity,
  PrimaryColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';

/**
 * Allowance ledger for a child user.
 *
 * balance is the single source of truth for "ChoreCoins this child can spend
 * right now" — the only money ledger on ChildProfile. It's mutated directly
 * by every action that earns or spends coins: incremented on task-approval
 * payout (taskReview.runReview), decremented when a reward contribution is
 * made (rewardStore.contributeToReward), and credited back when a
 * contributed-to reward is archived/cancelled (rewardStore.archiveReward).
 * RewardContribution rows are kept purely as a historical ledger (who gave
 * how much, and when) — they are no longer summed on every read to derive
 * spendable balance, since balance itself is now always current.
 *
 * Primary key mirrors the linked User id (shared PK via OneToOne JoinColumn).
 */
@Entity('child_profiles')
export class ChildProfile {
  @PrimaryColumn('uuid')
  id!: string;

  @OneToOne(() => User, (user) => user.childProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id' })
  user!: User;

  /**
   * Spendable ChoreCoins right now. Directly incremented/decremented — never
   * derived. Can go negative: a parent fine or an automatic missed-deadline
   * penalty (taskDeadlines.ts) always deducts the full amount regardless of
   * what the child currently has — there's no separate debt ledger, the
   * client just displays a negative value as "0 + a debt note" (see
   * client/src/utils/balance.ts) until future earnings bring it back above
   * zero on their own. Voluntary spends (reward purchases, sibling
   * transfers) still guard against going negative — only punitive
   * deductions bypass that floor.
   */
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  balance!: string;

  /** Total number of approved tasks the child has completed. */
  @Column({ type: 'int', default: 0 })
  lifetimeTasksCount!: number;
}
