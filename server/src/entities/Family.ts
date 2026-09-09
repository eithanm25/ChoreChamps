import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from './User';
import { Task } from './Task';

/** Freemium plan for a household. Gates AI review quota, upload constraints, and wallet features. */
export enum SubscriptionTier {
  FREE = 'free',
  PREMIUM = 'premium',
  ACADEMY = 'academy',
}

/**
 * A household grouping parents and children under shared chores and allowance rules.
 *
 * Invite codes let additional parents or children join without email-based signup.
 * Codes are generated when the founding parent creates the family.
 */
@Entity('families')
export class Family {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  familyName!: string;

  /** Freemium plan. FREE by default; PREMIUM/ACADEMY unlock AI/upload limits and (ACADEMY only) the wallet ledger. */
  @Column({ type: 'enum', enum: SubscriptionTier, default: SubscriptionTier.FREE })
  tier!: SubscriptionTier;

  /**
   * Total Claude AI photo-review requests ever used by this household. This is a
   * ONE-TIME lifetime counter, not a monthly quota: it only ever grows. Enforced
   * as a hard cap on FREE tier (FREE_TIER_AI_LIMIT in subscriptionLimits.ts) —
   * once reached, AI review stays locked until the family buys a plan. Tracked
   * for every tier for visibility.
   */
  @Column({ type: 'int', default: 0 })
  aiUsageCount!: number;

  /** Unique code for inviting additional co-parents. */
  @Column({ type: 'varchar', length: 32, unique: true, nullable: true })
  parentInviteCode!: string | null;

  /** Unique code for inviting children to the household. */
  @Column({ type: 'varchar', length: 32, unique: true, nullable: true })
  childInviteCode!: string | null;

  /**
   * Human-memorable 6-digit household code used for device-agnostic login: any
   * family member can log in from any device with familyCode + their name +
   * their password/PIN, with no UUID or saved link required. Generated once at
   * family creation (see services/familyCode.ts) with a DB-backed uniqueness retry.
   */
  @Column({ type: 'varchar', length: 6, unique: true, nullable: true })
  familyCode!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  /** All members (parents and children) belonging to this household. */
  @OneToMany(() => User, (user) => user.family)
  members!: User[];

  /** Chores scoped to this household. */
  @OneToMany(() => Task, (task) => task.family)
  tasks!: Task[];
}
