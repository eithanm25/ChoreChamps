import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Family } from './Family';
import { User } from './User';
import { Submission } from './Submission';

export enum TaskStatus {
  OPEN = 'open',
  PENDING = 'pending',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  APPROVED = 'approved',
}

/**
 * A chore created by a parent for a family.
 *
 * Pricing:
 * - basePrice: guaranteed payout on approval.
 * - maxBonusPrice: maximum possible bonus; actual bonus = (finalScore / 100) * maxBonusPrice.
 *
 * Assignment guardrails (enforced in task routes/services):
 * - A child may accept a task only when they have NO other task in 'pending' status.
 * - Cancel-submission rules apply when a completed task would leave the child blocked
 *   by an existing pending task (see taskGuardrails service).
 *
 * Rework flow: a rejected task moves 'completed' -> 'rejected', never back through
 * 'pending' — re-submission goes straight to 'rejected' -> 'completed'. This keeps
 * 'pending' strictly capacity-limited to one per child (see taskReview service).
 */
@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  basePrice!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  maxBonusPrice!: string;

  /** Calculated bonus after parent review: (finalScore / 100) * maxBonusPrice */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  awardedBonus!: string | null;

  /** Parent-assigned quality score (0–100) used to compute awardedBonus. */
  @Column({ type: 'int', nullable: true })
  finalScore!: number | null;

  /** Parent's Hebrew note explaining what must be fixed. Cleared on re-submission. */
  @Column({ type: 'text', nullable: true })
  rejectionNote!: string | null;

  /** How many times this chore has been sent back for corrections. */
  @Column({ type: 'int', default: 0 })
  rejectionCount!: number;

  /**
   * Optional reference photo(s)/PDF the parent uploads when creating the task
   * — a blank worksheet/test to grade against, or a "golden standard" example
   * of a finished chore. How many are allowed is tier-gated (see
   * subscriptionLimits.ts's MAX_REFERENCE_PHOTOS_BY_TIER — FREE: 1, PREMIUM: 3,
   * ACADEMY: higher + PDFs). Stored the same way as Submission.photoUrls (bare
   * local filenames under uploads/, comma-separated). Deleted once the task is
   * approved (see deleteLocalPhotos in task.routes.ts) — the learning/chore
   * cycle is done by then, so there's nothing left to compare against.
   */
  @Column({ type: 'simple-array', nullable: true })
  referencePhotoUrls!: string[] | null;

  /**
   * Parent's per-task opt-in for Claude AI photo review, chosen at creation.
   * When false, submission skips reviewChorePhoto entirely (aiSummary stays
   * null and the family's aiUsageCount is untouched) — lets a parent save
   * quota on tasks that don't need AI grading.
   */
  @Column({ type: 'boolean', default: true })
  useAiReview!: boolean;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.OPEN })
  status!: TaskStatus;

  /** The household this chore belongs to. */
  @ManyToOne(() => Family, (family) => family.tasks)
  @JoinColumn({ name: 'familyId' })
  family!: Family;

  /** The parent who created this task (nullable so deleting a co-parent doesn't orphan the row). */
  @ManyToOne(() => User, (user) => user.createdTasks, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy!: User | null;

  /** The child responsible for completing this task (nullable while open). */
  @ManyToOne(() => User, (user) => user.tasks, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignedToId' })
  assignedTo!: User | null;

  @CreateDateColumn()
  createdAt!: Date;

  /** One submission per task — created when the child uploads proof photos. */
  @OneToOne(() => Submission, (submission) => submission.task)
  submission!: Submission;
}
