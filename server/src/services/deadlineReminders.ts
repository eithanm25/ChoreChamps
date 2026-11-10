import { AppDataSource } from '../data-source';
import { Task, TaskStatus } from '../entities/Task';
import { notifyDeadlineReminderAssigned, notifyDeadlineReminderUnassigned } from './oneSignal';

/**
 * The one background-timer feature in this codebase — everything else (task
 * recurrence, deadline enforcement) is lazy, checked only when a request
 * happens to touch the board. A reminder can't work that way: the entire
 * point is to reach a kid who is *not* currently looking at the app. See
 * index.ts for the setInterval that drives this.
 *
 * "Big" vs "small" deadline is classified by the task's ORIGINAL total
 * span (dueAt - createdAt), not by how much is left right now — a task
 * published with a 6-hour window is "big" the whole time it's open, not
 * just at the start. Big deadlines (> 2h total) get a reminder at the
 * 2-hours-remaining mark; small deadlines (<= 2h total, but > 1h, so
 * there's actually a meaningful 1-hour mark to hit) get one at 1 hour
 * remaining. A deadline an hour or shorter has no reminder at all — there's
 * no sensible single checkpoint to fire at.
 */

const BIG_THRESHOLD_MS = 2 * 60 * 60 * 1000;
const SMALL_THRESHOLD_MS = 60 * 60 * 1000;

function formatTimeLeftHebrew(isBig: boolean): string {
  return isBig ? '2 שעות' : 'שעה';
}

export async function checkDeadlineReminders(): Promise<void> {
  const taskRepo = AppDataSource.getRepository(Task);
  const now = Date.now();

  const candidates = await taskRepo
    .createQueryBuilder('task')
    .leftJoinAndSelect('task.assignedTo', 'assignedTo')
    .leftJoinAndSelect('task.family', 'family')
    .where('task.status IN (:...statuses)', { statuses: [TaskStatus.OPEN, TaskStatus.PENDING] })
    .andWhere('task."dueAt" IS NOT NULL')
    .andWhere('task."deadlineReminderSentAt" IS NULL')
    .getMany();

  for (const task of candidates) {
    const dueAtMs = task.dueAt!.getTime();
    const totalMs = dueAtMs - task.createdAt.getTime();
    const remainingMs = dueAtMs - now;

    if (remainingMs <= 0) {
      // Already overdue — enforceDueDeadlines (the lazy, on-fetch check) owns this, not us.
      continue;
    }

    const isBigDeadline = totalMs > BIG_THRESHOLD_MS;
    if (!isBigDeadline && totalMs <= SMALL_THRESHOLD_MS) {
      // Too short a window for even the "small" checkpoint to make sense.
      continue;
    }

    const threshold = isBigDeadline ? BIG_THRESHOLD_MS : SMALL_THRESHOLD_MS;
    if (remainingMs > threshold) {
      continue; // not there yet
    }

    // Atomic claim — in practice only one process ever runs this interval,
    // but the same compare-and-set discipline as every other lazy trigger in
    // this codebase costs nothing and means this is still safe if that ever changes.
    const claim = await taskRepo
      .createQueryBuilder()
      .update(Task)
      .set({ deadlineReminderSentAt: new Date() })
      .where('id = :id', { id: task.id })
      .andWhere('"deadlineReminderSentAt" IS NULL')
      .execute();

    if (!claim.affected) {
      continue;
    }

    const timeLeftLabel = formatTimeLeftHebrew(isBigDeadline);

    if (task.status === TaskStatus.PENDING && task.assignedTo) {
      notifyDeadlineReminderAssigned(task.assignedTo.id, task.assignedTo.name, task.title, timeLeftLabel);
    } else if (task.status === TaskStatus.OPEN) {
      notifyDeadlineReminderUnassigned(task.family.id, task.title, timeLeftLabel);
    }
  }
}
