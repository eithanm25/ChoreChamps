import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Family } from './Family';
import { User } from './User';
import { RewardContribution } from './RewardContribution';

export enum RewardCategory {
  /** Free, non-tangible perks a parent creates (screen time, choosing Friday's movie). Costs the family nothing. */
  HOUSEHOLD = 'household',
  /** Real-world products with a tracked affiliateUrl — how ChoreChamps monetizes. */
  MARKETPLACE = 'marketplace',
}

export enum RewardType {
  /** Targeted at exactly one child — a fixed-price purchase. */
  INDIVIDUAL = 'individual',
  /** Visible to every child in the family — a crowdfunded group goal. */
  COLLABORATIVE = 'collaborative',
}

export enum RewardStatus {
  /** Open for contributions/purchase. */
  ACTIVE = 'active',
  /** Fully funded — cumulative contributions reached targetAmount. Frozen from further contributions. */
  COMPLETED = 'completed',
  /** A parent confirmed the real-world reward was actually handed over. */
  FULFILLED = 'fulfilled',
  /** Cancelled by a parent. Any contributed coins are refunded (see rewardStore.archiveReward). */
  ARCHIVED = 'archived',
}

/**
 * A catalog entry in the family rewards store.
 *
 * Individual and collaborative rewards share one funding mechanism (see
 * RewardContribution and services/rewardStore.ts): an individual "purchase"
 * is just a single contribution equal to the full targetAmount, made only by
 * the reward's targetChild. A collaborative reward accepts many partial
 * contributions from any child in the family, each choosing their own
 * amount. Both flip to 'completed' via the exact same atomic compare-and-set
 * the instant cumulative contributions reach targetAmount — there is only
 * one completion code path in this app, so the two reward types can never
 * drift into inconsistent behavior.
 */
@Entity('rewards')
export class Reward {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  familyId!: string;

  @ManyToOne(() => Family)
  @JoinColumn({ name: 'familyId' })
  family!: Family;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'enum', enum: RewardCategory })
  category!: RewardCategory;

  @Column({ type: 'enum', enum: RewardType })
  type!: RewardType;

  /** ChoreCoins needed to fully fund this reward — a fixed price for individual rewards, a crowdfunding target for collaborative ones. */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  targetAmount!: string;

  /** Tracked affiliate/purchase link — marketplace rewards only, required there. */
  @Column({ type: 'varchar', length: 1024, nullable: true })
  affiliateUrl!: string | null;

  /** The one child this reward is for — individual rewards only. Always null for collaborative (visible to every child). */
  @Column({ type: 'uuid', nullable: true })
  targetChildId!: string | null;

  /**
   * Cascades: an individual reward with no target child left doesn't mean
   * anything, so it (and its single contribution row, via RewardContribution's
   * own cascade) is removed along with the child. Never applies to
   * collaborative rewards, whose targetChildId is always null.
   */
  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'targetChildId' })
  targetChild!: User | null;

  /** The parent who added this reward to the catalog. */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy!: User | null;

  @Column({ type: 'enum', enum: RewardStatus, default: RewardStatus.ACTIVE })
  status!: RewardStatus;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  fulfilledAt!: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fulfilledById' })
  fulfilledBy!: User | null;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => RewardContribution, (contribution) => contribution.reward)
  contributions!: RewardContribution[];
}
