import { AppDataSource } from '../data-source';
import { Task, TaskStatus } from '../entities/Task';
import { User, UserRole } from '../entities/User';
import { ChildProfile } from '../entities/ChildProfile';
import { WalletTransaction, WalletTransactionType } from '../entities/WalletTransaction';
import { toCents, fromCents } from '../utils/money';
import { broadcastFamilyUpdate } from './realtime';

/**
 * Lazy-evaluation enforcement for task deadlines — same philosophy as
 * generateDueRecurringTasks: no cron runner, checked inline from GET
 * /api/tasks/family-tasks. A deadline (`dueAt`) is fixed at task creation and
 * never recalculated — assigning the task later never extends it.
 *
 * When a deadline passes on a task still OPEN or PENDING (never submitted):
 *  - PENDING (one child was holding it): that child alone is penalized, and
 *    the task is unassigned back to OPEN so anyone can pick it up — this is
 *    the core anti-hoarding behavior the feature exists for.
 *  - OPEN (nobody had claimed it): every child in the family is penalized —
 *    "nobody did it" is a shared failure, not any one child's.
 * A task already submitted (completed/rejected/approved) is untouched — the
 * child met the deadline the moment they submitted, regardless of what
 * happens to it afterward in the review/rework cycle.
 *
 * Concurrency: identical compare-and-set pattern to generateDueRecurringTasks
 * — the atomic UPDATE's WHERE clause re-checks dueAt/status, so only the
 * request that actually flips the row applies the penalty; everyone else
 * sees affected: 0 and moves on. No lock, no transaction needed for the claim
 * itself (the wallet debit below is its own per-child transaction).
 */
export async function enforceDueDeadlines(familyId: string): Promise<void> {
  const taskRepo = AppDataSource.getRepository(Task);

  const now = new Date();
  const candidates = await taskRepo
    .createQueryBuilder('task')
    .leftJoinAndSelect('task.assignedTo', 'assignedTo')
    .where('task."familyId" = :familyId', { familyId })
    .andWhere('task.status IN (:...statuses)', { statuses: [TaskStatus.OPEN, TaskStatus.PENDING] })
    .andWhere('task."dueAt" IS NOT NULL')
    .andWhere('task."dueAt" <= :now', { now })
    .getMany();

  if (candidates.length === 0) {
    return;
  }

  let anyProcessed = false;

  for (const task of candidates) {
    const claim = await taskRepo
      .createQueryBuilder()
      .update(Task)
      .set({ dueAt: null, status: TaskStatus.OPEN, assignedTo: null })
      .where('id = :id', { id: task.id })
      .andWhere('status = :expectedStatus', { expectedStatus: task.status })
      .andWhere('"dueAt" IS NOT NULL AND "dueAt" <= :now', { now })
      .execute();

    if (!claim.affected) {
      // Another concurrent request already enforced this deadline.
      continue;
    }

    anyProcessed = true;

    const penaltyCents = task.latePenaltyAmount ? toCents(task.latePenaltyAmount) : 0;
    if (penaltyCents <= 0) {
      continue;
    }

    if (task.status === TaskStatus.PENDING && task.assignedTo) {
      await applyDeadlinePenalty(familyId, [task.assignedTo.id], penaltyCents, task.title);
    } else if (task.status === TaskStatus.OPEN) {
      const children = await AppDataSource.getRepository(User).find({
        where: { family: { id: familyId }, role: UserRole.CHILD },
        select: ['id'],
      });
      if (children.length > 0) {
        await applyDeadlinePenalty(
          familyId,
          children.map((c) => c.id),
          penaltyCents,
          task.title,
        );
      }
    }
  }

  if (anyProcessed) {
    broadcastFamilyUpdate(familyId);
  }
}

/**
 * Debits each child the same penalty amount (not split between them),
 * clamped to their current balance — never goes negative, same ceiling as
 * the manual parent 'take' adjustment in wallet.routes.ts, except this never
 * *rejects* the whole operation over insufficient funds (there's no human
 * present to retry): it just takes what's available, down to zero. Each
 * debit is its own transaction, locked per child, with a WalletTransaction
 * audit row so the deduction is visible in wallet history, not a silent
 * balance change.
 */
async function applyDeadlinePenalty(
  familyId: string,
  childIds: string[],
  penaltyCents: number,
  taskTitle: string,
): Promise<void> {
  for (const childId of childIds) {
    await AppDataSource.transaction(async (manager) => {
      const profile = await manager.findOne(ChildProfile, {
        where: { id: childId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!profile) {
        return;
      }

      const balanceCents = toCents(profile.balance);
      const deductCents = Math.min(penaltyCents, balanceCents);
      if (deductCents <= 0) {
        return;
      }

      const newBalance = fromCents(balanceCents - deductCents);
      await manager.update(ChildProfile, { id: childId }, { balance: newBalance });

      const transaction = manager.create(WalletTransaction, {
        familyId,
        type: WalletTransactionType.TASK_DEADLINE_PENALTY,
        amount: fromCents(deductCents),
        reason: `איחור במשימה: ${taskTitle}`,
        fromChildId: childId,
        toChildId: null,
        initiatedById: null,
      });
      await manager.save(transaction);
    });
  }
}
