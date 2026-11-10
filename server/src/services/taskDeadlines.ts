import { AppDataSource } from '../data-source';
import { Task, TaskStatus } from '../entities/Task';
import { User, UserRole } from '../entities/User';
import { ChildProfile } from '../entities/ChildProfile';
import { WalletTransaction, WalletTransactionType } from '../entities/WalletTransaction';
import { toCents, fromCents } from '../utils/money';
import { deleteObjects } from './storage';
import { broadcastFamilyUpdate } from './realtime';

/**
 * Lazy-evaluation enforcement for task deadlines — same philosophy as
 * generateDueRecurringTasks: no cron runner, checked inline from GET
 * /api/tasks/family-tasks. A deadline (`dueAt`) is fixed at task creation and
 * never recalculated — assigning the task later never extends it.
 *
 * When a deadline passes on a task still OPEN or PENDING (never submitted),
 * the task is DELETED outright, not returned to the board — the window of
 * real-world urgency it represented has closed, and the same fixed `dueAt`
 * would just expire again the instant anyone else claimed it. A parent can
 * always publish a fresh one if it's still needed; a recurring chore already
 * gets a fresh instance with its own full-length clock next cycle regardless.
 *  - PENDING (one child was holding it): that child alone is penalized.
 *  - OPEN (nobody had claimed it): every child in the family is penalized —
 *    "nobody did it" is a shared failure, not any one child's.
 * A task already submitted (completed/rejected/approved) is untouched — the
 * child met the deadline the moment they submitted, regardless of what
 * happens to it afterward in the review/rework cycle. A recurring TEMPLATE
 * is never a candidate here either — see Task.dueAt's docstring, a template
 * never has a dueAt of its own.
 *
 * Concurrency: identical compare-and-set pattern to generateDueRecurringTasks
 * — the atomic UPDATE's WHERE clause re-checks dueAt/status, so only the
 * request that actually claims the row proceeds to penalize-and-delete;
 * everyone else sees affected: 0 and moves on.
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
    // Claim first (mark dueAt null so a concurrent request can't double-process
    // this row), THEN penalize and delete — deleting can't itself be the
    // compare-and-set condition the way an UPDATE's WHERE clause can.
    const claim = await taskRepo
      .createQueryBuilder()
      .update(Task)
      .set({ dueAt: null })
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
    if (penaltyCents > 0) {
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

    await taskRepo.delete({ id: task.id });
    // isRecurringOccurrence: this clone shares its reference photo keys with
    // every sibling occurrence of the same recurring chore (see
    // Task.isRecurringOccurrence's docstring) — deleting this one missed
    // occurrence must never purge a key a sibling is still displaying.
    if (!task.isRecurringOccurrence && task.referencePhotoUrls && task.referencePhotoUrls.length > 0) {
      // Best-effort, same contract as every other deleteObjects call site —
      // the row is already gone either way.
      await deleteObjects(task.referencePhotoUrls);
    }
  }

  if (anyProcessed) {
    broadcastFamilyUpdate(familyId);
  }
}

/**
 * Debits each child the same penalty amount (not split between them) — the
 * full amount, even past zero, same rule as the manual parent 'take'
 * adjustment in wallet.routes.ts: a fee is a fee regardless of what the
 * child currently has, and there's no human present here to ask for a
 * smaller amount anyway. The client never shows the negative number itself —
 * see client/src/utils/balance.ts for the "0 + separate debt note" display.
 * Each debit is its own transaction, locked per child, with a
 * WalletTransaction audit row so the deduction is visible in wallet history,
 * not a silent balance change.
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
      const newBalance = fromCents(balanceCents - penaltyCents);
      await manager.update(ChildProfile, { id: childId }, { balance: newBalance });

      const transaction = manager.create(WalletTransaction, {
        familyId,
        type: WalletTransactionType.TASK_DEADLINE_PENALTY,
        amount: fromCents(penaltyCents),
        reason: `איחור במשימה: ${taskTitle}`,
        fromChildId: childId,
        toChildId: null,
        initiatedById: null,
      });
      await manager.save(transaction);
    });
  }
}
