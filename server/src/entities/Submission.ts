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

  @Column({ type: 'uuid' })
  childId!: string;

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

  /** The task this submission belongs to (one submission per task). */
  @OneToOne(() => Task, (task) => task.submission)
  @JoinColumn({ name: 'taskId' })
  task!: Task;

  /** The child who submitted the proof. */
  @ManyToOne(() => User, (user) => user.submissions)
  @JoinColumn({ name: 'childId' })
  child!: User;
}
