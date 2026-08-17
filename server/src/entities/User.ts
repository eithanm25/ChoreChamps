import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { Task } from './Task';
import { Submission } from './Submission';

export enum UserRole {
  PARENT = 'parent',
  CHILD = 'child',
}

/**
 * A family member — either a parent (manager) or a child (chore doer).
 *
 * Allowance rules:
 * - Each child has an independent balance; there is NO competition between siblings.
 * - Earnings come from basePrice + bonus on approved tasks.
 * - Bonus formula: (finalScore / 100) * maxBonusPrice
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'enum', enum: UserRole })
  role!: UserRole;

  /** Groups users into a single household. */
  @Column({ type: 'uuid' })
  familyId!: string;

  /** Current spendable allowance balance. */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balance!: string;

  /** Lifetime bonus earnings (excludes base price). */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalBonusEarned!: string;

  /** Tasks assigned to this child. */
  @OneToMany(() => Task, (task) => task.assignedTo)
  tasks!: Task[];

  /** Photo submissions made by this child. */
  @OneToMany(() => Submission, (submission) => submission.child)
  submissions!: Submission[];
}
