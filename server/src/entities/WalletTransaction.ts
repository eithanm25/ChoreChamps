import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Family } from './Family';
import { User } from './User';

export enum WalletTransactionType {
  /** A child sending coins to a sibling's wallet (or a parent doing it on their behalf). */
  SIBLING_TRANSFER = 'sibling_transfer',
  /** A parent manually crediting a child's wallet (bonus, allowance top-up). */
  PARENT_GIVE = 'parent_give',
  /** A parent manually debiting a child's wallet (fine, correction). */
  PARENT_TAKE = 'parent_take',
}

/**
 * Audit ledger for every ACADEMY-tier wallet movement — sibling-to-sibling
 * transfers and manual parent adjustments (see wallet.routes.ts). Every row
 * is written inside the same DB transaction as the ChildProfile.balance
 * mutation it records, so the ledger can never drift from actual balances.
 *
 * fromChild/toChild are both nullable because a single row covers three
 * shapes: a transfer has both; a PARENT_GIVE only has toChild; a
 * PARENT_TAKE only has fromChild.
 */
@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  familyId!: string;

  @ManyToOne(() => Family)
  @JoinColumn({ name: 'familyId' })
  family!: Family;

  @Column({ type: 'enum', enum: WalletTransactionType })
  type!: WalletTransactionType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: string;

  /** Free-text reason ("הלוואה לקניית לגו", "קנס על התנהגות") — mandatory for a sibling transfer, optional for a parent adjustment. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  reason!: string | null;

  /** Child whose balance decreased. Null for a PARENT_GIVE, which has no source. */
  @Column({ type: 'uuid', nullable: true })
  fromChildId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fromChildId' })
  fromChild!: User | null;

  /** Child whose balance increased. Null for a PARENT_TAKE, which has no destination. */
  @Column({ type: 'uuid', nullable: true })
  toChildId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'toChildId' })
  toChild!: User | null;

  /** The parent who performed a manual adjustment. Null for a child-initiated sibling transfer. */
  @Column({ type: 'uuid', nullable: true })
  initiatedById!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'initiatedById' })
  initiatedBy!: User | null;

  @CreateDateColumn()
  createdAt!: Date;
}
