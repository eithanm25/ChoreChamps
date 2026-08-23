import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from './User';
import { Task } from './Task';

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

  /** Unique code for inviting additional co-parents. */
  @Column({ type: 'varchar', length: 32, unique: true, nullable: true })
  parentInviteCode!: string | null;

  /** Unique code for inviting children to the household. */
  @Column({ type: 'varchar', length: 32, unique: true, nullable: true })
  childInviteCode!: string | null;

  /**
   * Human-memorable household code (4–6 digits) used for device-agnostic login:
   * any family member can log in from any device with familyCode + their name +
   * their password/PIN, with no UUID or saved link required. Generated once at
   * family creation (see family.routes.ts) with a DB-backed uniqueness retry.
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
