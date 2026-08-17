import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { Submission } from './Submission';

export enum TaskStatus {
  OPEN = 'open',
  PENDING = 'pending',
  COMPLETED = 'completed',
  APPROVED = 'approved',
}

/**
 * A chore created by a parent for a family.
 *
 * Pricing:
 * - basePrice: guaranteed payout on approval.
 * - maxBonusPrice: maximum possible bonus; actual bonus = (finalScore / 100) * maxBonusPrice.
 *
 * Assignment constraint:
 * A child may have only ONE active task in 'pending' or 'completed' status at a time.
 * Enforce this in service/route logic before assigning or accepting a task.
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

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.OPEN })
  status!: TaskStatus;

  @Column({ type: 'uuid' })
  familyId!: string;

  /** The child responsible for completing this task (nullable while open). */
  @ManyToOne(() => User, (user) => user.tasks, { nullable: true })
  @JoinColumn({ name: 'assignedToId' })
  assignedTo!: User | null;

  @CreateDateColumn()
  createdAt!: Date;

  /** One submission per task — created when the child uploads proof photos. */
  @OneToOne(() => Submission, (submission) => submission.task)
  submission!: Submission;
}
