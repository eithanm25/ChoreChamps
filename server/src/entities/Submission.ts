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
 * Proof-of-work submitted by a child for a task.
 *
 * Links a task to the submitting child and stores photo URLs plus an AI-generated
 * summary of the submitted images (via Anthropic API in future routes).
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

  /** AI-generated description/summary of the submitted work. */
  @Column({ type: 'text' })
  aiSummary!: string;

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
