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
 * lifetimeEarnings is the single source of truth for "money earned" — every
 * task approval adds to it, and it never decreases (a true lifetime total,
 * including base price + bonus; a task's own bonus amount stays visible on
 * the Task row itself, this is just the running sum). There is deliberately
 * no separate stored "spendable balance" column: spending is tracked purely
 * as reward-contribution ledger rows (see RewardContribution), and the
 * amount a child can spend right now is always computed on demand as
 * lifetimeEarnings minus the sum of their contributions to still-valid
 * (non-archived) rewards — see rewardStore.getSpendableBalance. A stored
 * balance that both this and the rewards flow would need to keep in lockstep
 * is exactly the kind of two-copies-of-the-truth setup that drifts out of
 * sync; a single ledger can't.
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

  /** Lifetime earnings including base price + bonuses. Never decreases. */
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  lifetimeEarnings!: string;

  /** Total number of approved tasks the child has completed. */
  @Column({ type: 'int', default: 0 })
  lifetimeTasksCount!: number;
}
