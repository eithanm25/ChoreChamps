import type { EntityManager } from 'typeorm';
import { Task, TaskStatus } from '../entities/Task';
import { Submission } from '../entities/Submission';
import { ChildProfile } from '../entities/ChildProfile';
import { toCents, fromCents } from '../utils/money';

export type ReviewAction =
  | { action: 'approve'; finalScore: number }
  | { action: 'reject'; note: string };

export type ReviewOutcome =
  | {
      ok: true;
      action: 'approve';
      awardedBonus: string;
      totalPayout: string;
      finalScore: number;
      childId: string;
      photoUrls: string[];
    }
  | {
      ok: true;
      action: 'reject';
      taskId: string;
      rejectionNote: string;
      rejectionCount: number;
      photoUrls: string[];
    }
  | { ok: false; status: number; error: string };

/** Narrow an untrusted request body into a ReviewAction, or explain why not. */
export function parseReviewAction(body: unknown): ReviewAction | { error: string } {
  if (typeof body !== 'object' || body === null) {
    return { error: 'גוף הבקשה חסר' };
  }
  const { action, finalScore, note } = body as Record<string, unknown>;

  if (action === 'approve') {
    if (typeof finalScore !== 'number' || !Number.isInteger(finalScore)) {
      return { error: 'finalScore must be an integer' };
    }
    if (finalScore < 0 || finalScore > 100) {
      return { error: 'finalScore must be between 0 and 100' };
    }
    return { action: 'approve', finalScore };
  }

  if (action === 'reject') {
    const trimmed = typeof note === 'string' ? note.trim() : '';
    if (!trimmed) {
      return { error: 'חובה לכתוב לילד מה צריך לתקן' };
    }
    if (trimmed.length > 500) {
      return { error: 'ההערה ארוכה מדי (עד 500 תווים)' };
    }
    return { action: 'reject', note: trimmed };
  }

  return { error: "action must be either 'approve' or 'reject'" };
}

/**
 * Approve or reject a completed task. Both transitions leave 'completed' via the
 * same compare-and-set, so a concurrent double-click resolves to exactly one
 * winner. Rejection moves the task to 'rejected' — never back through 'pending' —
 * so a child's pending count stays capped at one even mid-rework.
 */
export async function runReview(
  manager: EntityManager,
  taskId: string,
  familyId: string,
  review: ReviewAction,
): Promise<ReviewOutcome> {
  const task = await manager.findOne(Task, {
    where: { id: taskId },
    relations: ['family', 'assignedTo', 'submission'],
  });

  if (!task) {
    return { ok: false, status: 404, error: 'המשימה לא נמצאה' };
  }
  if (task.family.id !== familyId) {
    return { ok: false, status: 403, error: 'המשימה אינה שייכת למשפחתך' };
  }
  if (task.status !== TaskStatus.COMPLETED) {
    return { ok: false, status: 409, error: 'ניתן לבדוק רק משימה שהוגשה וממתינה לאישור' };
  }
  if (!task.assignedTo) {
    return { ok: false, status: 409, error: 'למשימה זו אין ילד משויך' };
  }

  const submissionPhotoUrls = task.submission?.photoUrls ?? [];

  if (review.action === 'reject') {
    const transition = await manager
      .createQueryBuilder()
      .update(Task)
      .set({
        status: TaskStatus.REJECTED,
        rejectionNote: review.note,
        rejectionCount: () => '"rejectionCount" + 1',
        finalScore: null,
        awardedBonus: null,
      })
      .where('id = :taskId AND status = :expected', { taskId, expected: TaskStatus.COMPLETED })
      .execute();

    if (!transition.affected) {
      return { ok: false, status: 409, error: 'המשימה כבר נבדקה' };
    }

    // The submission must go, or POST /submit's duplicate-submission guard
    // would permanently block the child from re-uploading fixed proof.
    if (task.submission) {
      await manager.delete(Submission, { taskId: task.id });
    }

    // The reference photo (if any) is deliberately NOT deleted here — a
    // rejected task goes back for rework, and the child needs it to see what
    // they're re-matching against on resubmission.
    return {
      ok: true,
      action: 'reject',
      taskId: task.id,
      rejectionNote: review.note,
      rejectionCount: task.rejectionCount + 1,
      photoUrls: submissionPhotoUrls,
    };
  }

  const childId = task.assignedTo.id;
  const profile = await manager.findOne(ChildProfile, { where: { id: childId } });
  if (!profile) {
    return { ok: false, status: 409, error: 'לילד המשויך אין תיק דמי כיס' };
  }

  const bonusCents = Math.round((toCents(task.maxBonusPrice) * review.finalScore) / 100);
  const totalCents = toCents(task.basePrice) + bonusCents;
  const awardedBonus = fromCents(bonusCents);
  const totalPayout = fromCents(totalCents);

  const transition = await manager
    .createQueryBuilder()
    .update(Task)
    .set({
      status: TaskStatus.APPROVED,
      finalScore: review.finalScore,
      awardedBonus,
      rejectionNote: null,
    })
    .where('id = :taskId AND status = :expected', { taskId, expected: TaskStatus.COMPLETED })
    .execute();

  if (!transition.affected) {
    return { ok: false, status: 409, error: 'המשימה כבר נבדקה' };
  }

  // Incremented in SQL so concurrent approvals for different tasks belonging to
  // the same child can never lose an update. balance is the only money ledger
  // on ChildProfile — see the entity's docstring.
  await manager
    .createQueryBuilder()
    .update(ChildProfile)
    .set({
      lifetimeTasksCount: () => '"lifetimeTasksCount" + 1',
      balance: () => '"balance" + CAST(:totalPayout AS numeric)',
    })
    .where('id = :childId', { childId })
    .setParameters({ totalPayout })
    .execute();

  // Approval closes out the task's learning/comparison cycle for good, so the
  // parent's reference photo is cleaned up here too, alongside the child's
  // submission photos — nothing is left to compare against anymore.
  const photoUrls = task.referencePhotoUrl
    ? [...submissionPhotoUrls, task.referencePhotoUrl]
    : submissionPhotoUrls;

  return {
    ok: true,
    action: 'approve',
    awardedBonus,
    totalPayout,
    finalScore: review.finalScore,
    childId,
    photoUrls,
  };
}
