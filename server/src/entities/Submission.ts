import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Task } from './Task';
import { User } from './User';

/**
 * Structured review of a proof photo produced by the Anthropic vision call in
 * services/aiVision.ts.
 *
 * recommendedScore is advisory only — the parent still sets Task.finalScore,
 * which is what the payout is calculated from.
 */
export interface AiReview {
  /** Hebrew sentence describing what was done. */
  summary: string;
  /** Recommended quality score, 0–100. */
  recommendedScore: number;
  /** Hebrew sentence explaining the score. */
  reasoning: string;
}

/**
 * Proof-of-work submitted by a child for a task.
 *
 * Relations:
 * - Submission → Task: OneToOne (one submission per task).
 * - Submission → User (child): ManyToOne (the submitting child).
 *
 * Stores photo URLs plus a structured AI review of the submitted work.
 */
@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  taskId!: string;

  /** Nullable so deleting the submitting child doesn't block the deletion. */
  @Column({ type: 'uuid', nullable: true })
  childId!: string | null;

  /** URLs of uploaded proof photos (stored as a comma-separated simple-array). */
  @Column({ type: 'simple-array' })
  photoUrls!: string[];

  /**
   * Structured AI review (summary, recommended score, reasoning), persisted as
   * JSON. Null when the vision call failed — a submission is still accepted
   * without it so the child is never blocked by an AI outage.
   */
  @Column({ type: 'simple-json', nullable: true })
  aiSummary!: AiReview | null;

  @CreateDateColumn()
  submittedAt!: Date;

  /**
   * The task this submission belongs to (one submission per task). Cascades so
   * deleting a task (e.g. a parent discarding a completed chore) never leaves a
   * foreign-key violation behind — the proof row goes with it.
   */
  @OneToOne(() => Task, (task) => task.submission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task!: Task;

  /** The child who submitted the proof (nullable — SET NULL if the child is later deleted). */
  @ManyToOne(() => User, (user) => user.submissions, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'childId' })
  child!: User | null;
}
