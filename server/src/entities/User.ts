import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Family } from './Family';
import { ChildProfile } from './ChildProfile';
import { Task } from './Task';
import { Submission } from './Submission';

export enum UserRole {
  PARENT = 'parent',
  CHILD = 'child',
}

/**
 * A family member — parent (manager) or child (chore doer).
 *
 * Auth flow:
 * - Primary parent signs up with email/password; familyId is null until POST /api/family/create.
 * - Co-parents and children are created by a parent (email nullable, name + password required).
 *
 * Relations:
 * - User → Family: ManyToOne (nullable until the user joins or creates a household).
 * - User → ChildProfile: OneToOne (nullable; only populated for role = child).
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** Nullable for co-parents and children created in-app by a parent. */
  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 255 })
  password!: string;

  @Column({ type: 'enum', enum: UserRole })
  role!: UserRole;

  /** Household membership — null for a newly signed-up parent before family creation. */
  @ManyToOne(() => Family, (family) => family.members, { nullable: true })
  @JoinColumn({ name: 'familyId' })
  family!: Family | null;

  /** Allowance ledger — only set for children. */
  @OneToOne(() => ChildProfile, (profile) => profile.user, { nullable: true })
  childProfile!: ChildProfile | null;

  /** Tasks assigned to this child. */
  @OneToMany(() => Task, (task) => task.assignedTo)
  tasks!: Task[];

  /** Photo submissions made by this child. */
  @OneToMany(() => Submission, (submission) => submission.child)
  submissions!: Submission[];
}
