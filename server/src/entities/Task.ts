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

export enum TaskFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
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
   * subscriptionLimits.ts's MAX_REFERENCE_PHOTOS_BY_TIER — FREE: 1, PREMIUM: 10
   * + PDFs). Stored the same way as Submission.photoUrls: bare
   * R2 object keys, comma-separated. Deleted from storage once the task is
   * approved (see deleteObjects in task.routes.ts) — the learning/chore cycle is
   * done by then, so there's nothing left to compare against.
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

  /**
   * Recurring-task TEMPLATE flag. A template is a hidden, never-directly-
   * actionable config row — it never appears on any board (see the
   * isRecurring: false filter on GET /family-tasks and /open) and is never
   * itself completed, assigned-to-be-done, or deleted. It exists only to be
   * read by generateDueRecurringTasks, which spawns real, independent,
   * fully-visible occurrences (plain tasks with isRecurring: false) on
   * schedule — one immediately at creation time, then one per `frequency`
   * interval after that. Only `lastGeneratedAt` ever changes on a template
   * post-creation. See deadlineDurationMinutes below for why a template
   * can't carry a literal dueAt the way a normal task does.
   */
  @Column({ type: 'boolean', default: false })
  isRecurring!: boolean;

  /**
   * True on every clone generateDueRecurringTasks/buildOccurrenceFromTemplate
   * spawns (never on a template itself, never on a genuinely standalone
   * task). A clone's `referencePhotoUrls` are the SAME R2 keys as its
   * template's — copied by reference, not duplicated bytes, to avoid storing
   * N copies of an identical image across N occurrences — so unlike a
   * standalone task, a clone's reference photos must survive its own
   * approval: every sibling occurrence (past and future) is still showing
   * the same keys. Only deleting the template itself (stopping the series)
   * retires them — see DELETE /:id's isRecurring branch.
   */
  @Column({ type: 'boolean', default: false })
  isRecurringOccurrence!: boolean;

  /** Recurrence cadence — meaningful only when isRecurring is true. */
  @Column({ type: 'enum', enum: TaskFrequency, nullable: true })
  frequency!: TaskFrequency | null;

  /** When this template last spawned an occurrence (set at creation time too — the immediate first clone counts). */
  @Column({ type: 'timestamp', nullable: true })
  lastGeneratedAt!: Date | null;

  /**
   * Optional deadline for an ordinary (non-template) task: an absolute
   * moment, fixed at creation time (now + however many hours/minutes the
   * parent chose) and never recalculated — assigning the task later never
   * extends it ("a deadline is a deadline"). Enforced lazily from GET
   * /api/tasks/family-tasks (see enforceDueDeadlines): past this moment with
   * the task still OPEN or PENDING (never submitted), the task is deleted
   * and the relevant child(ren) are fined — see latePenaltyAmount.
   *
   * Always null on a template (isRecurring: true) — a template is never
   * itself "due," only its occurrences are. A recurring task's deadline is
   * configured as a duration instead — see deadlineDurationMinutes — so each
   * freshly generated clone can compute its OWN dueAt as
   * "generated-just-now + that duration," rather than every clone sharing
   * one fixed moment that would make no sense once the schedule has run a
   * few cycles.
   */
  @Column({ type: 'timestamp', nullable: true })
  dueAt!: Date | null;

  /**
   * Coins docked when a deadline passes unmet — from every child in the
   * family if the task was still OPEN (nobody claimed it), or from the one
   * assigned child if it was PENDING (they held it and missed it). Carried
   * over verbatim from a recurring template onto every clone it generates.
   * Meaningful only alongside a deadline (dueAt on a plain task, or
   * deadlineDurationMinutes on a template); 0/null means "no coin penalty."
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  latePenaltyAmount!: string | null;

  /**
   * A recurring template's deadline, expressed as a duration (hours+minutes,
   * stored as total minutes) rather than a fixed moment — see dueAt's
   * docstring for why. Meaningful only when isRecurring is true; every clone
   * generateDueRecurringTasks spawns gets its own dueAt computed as
   * generation-time + this many minutes, and its own fresh
   * deadlineReminderSentAt/enforcement lifecycle, independent of every other
   * occurrence.
   */
  @Column({ type: 'int', nullable: true })
  deadlineDurationMinutes!: number | null;

  /**
   * Set once the "time's running out" reminder push has fired for this
   * deadline, so the background check (see deadlineReminders.ts) never sends
   * it twice. Unrelated to dueAt being cleared — that only happens when the
   * deadline is actually missed/enforced.
   */
  @Column({ type: 'timestamp', nullable: true })
  deadlineReminderSentAt!: Date | null;

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
