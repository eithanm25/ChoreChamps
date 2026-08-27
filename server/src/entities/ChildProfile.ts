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

  /** Spendable ChoreCoins right now. Directly incremented/decremented — never derived. */
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  balance!: string;

  /** Total number of approved tasks the child has completed. */
  @Column({ type: 'int', default: 0 })
  lifetimeTasksCount!: number;
}
