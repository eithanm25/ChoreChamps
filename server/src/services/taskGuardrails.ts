import { AppDataSource } from '../data-source';
import { Task, TaskStatus } from '../entities/Task';

/**
 * Business-rule guardrails for task assignment and submission cancellation.
 *
 * Rule 1 — Accept task:
 *   A child may accept a task only when they have NO other task in 'pending' status.
 *
 * Rule 2 — Cancel submission on a completed task:
 *   A child cannot cancel submission on a completed task if they already have
 *   another active task in 'pending' status (would block their workflow).
 */

export async function childHasPendingTask(
  childId: string,
  excludeTaskId?: string,
): Promise<boolean> {
  const taskRepo = AppDataSource.getRepository(Task);

  const pendingTasks = await taskRepo.find({
    where: {
      assignedTo: { id: childId },
      status: TaskStatus.PENDING,
    },
    select: ['id'],
  });

  if (excludeTaskId) {
    return pendingTasks.some((task) => task.id !== excludeTaskId);
  }

  return pendingTasks.length > 0;
}

export async function canAcceptTask(childId: string): Promise<{ allowed: boolean; reason?: string }> {
  const hasPending = await childHasPendingTask(childId);
  if (hasPending) {
    return {
      allowed: false,
      reason: 'You already have a task in pending status. Complete or cancel it before accepting another.',
    };
  }
  return { allowed: true };
}

export async function canCancelSubmission(
  childId: string,
  taskStatus: TaskStatus,
): Promise<{ allowed: boolean; reason?: string }> {
  if (taskStatus !== TaskStatus.COMPLETED) {
    return { allowed: true };
  }

  const hasOtherPending = await childHasPendingTask(childId);
  if (hasOtherPending) {
    return {
      allowed: false,
      reason:
        'Cannot cancel submission on a completed task while you have another task in pending status.',
    };
  }

  return { allowed: true };
}
