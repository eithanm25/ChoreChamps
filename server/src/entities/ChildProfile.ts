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
 * Balance and bonus totals live here — not on User — so only children carry
 * spendable allowance. Each child's earnings are independent (no sibling competition).
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

  /** Current spendable allowance balance. */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balance!: string;

  /** Lifetime bonus earnings (excludes base price). */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalBonusEarned!: string;

  /** Lifetime earnings including base price + bonuses. */
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  lifetimeEarnings!: string;

  /** Total number of approved tasks the child has completed. */
  @Column({ type: 'int', default: 0 })
  lifetimeTasksCount!: number;
}
