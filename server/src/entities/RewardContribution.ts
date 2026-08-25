import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Reward } from './Reward';
import { User } from './User';

/**
 * One ledger entry: a child putting some of their ChoreCoin balance toward a
 * reward. For an individual reward this is always exactly one row (the full
 * targetAmount, contributed only by the reward's targetChild). For a
 * collaborative reward this can be many rows from many children over time,
 * each choosing their own amount — see services/rewardStore.ts for the
 * shared completion logic both flows go through.
 */
@Entity('reward_contributions')
export class RewardContribution {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  rewardId!: string;

  /** Cascades — a reward being deleted takes its own ledger history with it. */
  @ManyToOne(() => Reward, (reward) => reward.contributions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rewardId' })
  reward!: Reward;

  /** Nullable so removing a child from the family doesn't erase the household's funding history. */
  @Column({ type: 'uuid', nullable: true })
  childId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'childId' })
  child!: User | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: string;

  @CreateDateColumn()
  contributedAt!: Date;
}
