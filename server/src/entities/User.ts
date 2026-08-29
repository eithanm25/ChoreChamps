import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Family } from './Family';
import { ChildProfile } from './ChildProfile';
import { Task } from './Task';
import { Submission } from './Submission';

export enum UserRole {
  PARENT = 'parent',
  CHILD = 'child',
}

export enum AuthProvider {
  /** Logs in with a password/PIN they chose themselves — email+password parents, and every child (familyCode + PIN). */
  PASSWORD = 'password',
  /** Logs in exclusively via Google Sign-In. `password` on these rows is a random value nobody knows (see auth.routes.ts) — deliberately unusable for password login, so callers must never prompt these users for "their password". */
  GOOGLE = 'google',
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
 *
 * Login: name is unique per household (not globally) — the (familyId, name) index
 * below is what makes familyCode + name a valid lookup key for device-agnostic
 * login (see POST /api/auth/profile-login). Postgres treats NULL familyId values
 * as distinct from each other, so multiple not-yet-onboarded parents (family is
 * still null) can share a name without conflict.
 */
@Entity('users')
@Index(['name', 'family'], { unique: true })
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

  /** Which credential this account actually authenticates with — see AuthProvider docstring. */
  @Column({ type: 'enum', enum: AuthProvider, default: AuthProvider.PASSWORD })
  authProvider!: AuthProvider;

  /** One of the fixed emoji choices in utils/avatars.ts. Null until the user picks one — the UI falls back to their name's initial. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  avatarUrl!: string | null;

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

  /** Tasks created by this parent (SET NULL on that side if this parent is deleted). */
  @OneToMany(() => Task, (task) => task.createdBy)
  createdTasks!: Task[];

  /** Photo submissions made by this child (SET NULL on that side if this child is deleted). */
  @OneToMany(() => Submission, (submission) => submission.child)
  submissions!: Submission[];
}
