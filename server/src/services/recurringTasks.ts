import { AppDataSource } from '../data-source';
import { Task, TaskFrequency, TaskStatus } from '../entities/Task';
import { childHasPendingTask } from './taskGuardrails';
import { broadcastFamilyUpdate } from './realtime';

const FREQUENCY_INTERVAL_MS: Record<TaskFrequency, number> = {
  [TaskFrequency.DAILY]: 24 * 60 * 60 * 1000,
  [TaskFrequency.WEEKLY]: 7 * 24 * 60 * 60 * 1000,
  [TaskFrequency.MONTHLY]: 30 * 24 * 60 * 60 * 1000,
};

/**
 * Builds (but does not save) the Task that should exist for one occurrence
 * of a recurring template, generated right now. Shared by the lazy
 * once-per-interval generator below AND by POST /api/tasks, which calls this
 * once immediately at template-creation time so there's always a real,
 * visible first occurrence from the moment a parent publishes a recurring
 * chore — never a window where only the hidden template exists.
 *
 * The clone's own dueAt, if the template has a deadline duration configured,
 * is computed fresh from "now" — never copied from any prior occurrence —
 * which is exactly what lets the same template keep producing occurrences
 * with sensible, independent deadlines indefinitely.
 */
export function buildOccurrenceFromTemplate(template: Task): Task {
  const taskRepo = AppDataSource.getRepository(Task);
  const now = Date.now();

  return taskRepo.create({
    title: template.title,
    description: template.description,
    basePrice: template.basePrice,
    maxBonusPrice: template.maxBonusPrice,
    status: template.assignedTo ? TaskStatus.PENDING : TaskStatus.OPEN,
    family: template.family,
    createdBy: template.createdBy,
    assignedTo: template.assignedTo,
    referencePhotoUrls: template.referencePhotoUrls,
    useAiReview: template.useAiReview,
    isRecurring: false,
    isRecurringOccurrence: true,
    // Purely cosmetic on a clone (generateDueRecurringTasks only ever reads
    // frequency off a true template) — kept so the UI can still show "🔁 כל
    // שבוע" on the visible occurrence itself, since the template that
    // actually owns this field is permanently hidden.
    frequency: template.frequency,
    lastGeneratedAt: null,
    dueAt: template.deadlineDurationMinutes ? new Date(now + template.deadlineDurationMinutes * 60_000) : null,
    latePenaltyAmount: template.latePenaltyAmount,
    deadlineDurationMinutes: null,
  });
}

/**
 * Lazy-evaluation trigger for recurring chores — deliberately no cron
 * runner, no job queue. Called at the top of GET /api/tasks/family-tasks:
 * any recurring template (isRecurring: true) whose interval has elapsed
 * spawns one fresh, independent occurrence right there, inline in whichever
 * request happened to notice it was due. The template itself is untouched
 * beyond its `lastGeneratedAt` stamp — it never appears on any board itself
 * (see the isRecurring: false filters on GET /family-tasks and /open),
 * existing purely to keep producing the next real, visible occurrence.
 *
 * Concurrency: two requests racing to notice the same stale template (two
 * tabs, parent + child dashboards loading at once) must not both spawn a
 * duplicate occurrence. Guarded with a single atomic conditional UPDATE per
 * template — `lastGeneratedAt` is claimed via a compare-and-set WHERE
 * clause, so only the request whose UPDATE actually affects a row proceeds
 * to clone; the loser sees `affected: 0` and moves on. No SELECT ... FOR
 * UPDATE, no transaction, no external lock needed for that part.
 *
 * Known limitation: the claim above is per-template, not per-child. If the
 * same child is assigned to two *different* recurring templates that both
 * go stale in the same instant across two concurrent requests, both can
 * pass the one-pending-task-per-child guardrail before either inserts,
 * yielding two pending tasks for that child. This is a narrow, rare race —
 * acceptable for a lightweight lazy trigger. A strict fix would need a
 * per-child advisory lock (e.g. pg_advisory_xact_lock), which is exactly
 * the heavier machinery this approach exists to avoid.
 */
export async function generateDueRecurringTasks(familyId: string): Promise<void> {
  const taskRepo = AppDataSource.getRepository(Task);

  const templates = await taskRepo.find({
    where: { family: { id: familyId }, isRecurring: true },
    relations: ['assignedTo', 'createdBy', 'family'],
  });
  if (templates.length === 0) {
    return;
  }

  const now = Date.now();
  let generatedAny = false;

  for (const template of templates) {
    if (!template.frequency) {
      continue;
    }

    const intervalMs = FREQUENCY_INTERVAL_MS[template.frequency];
    const lastGenerated = template.lastGeneratedAt ?? template.createdAt;
    if (now - new Date(lastGenerated).getTime() < intervalMs) {
      continue;
    }

    // Guardrail: never hand an assigned child a second concurrent pending
    // task — the same rule POST /tasks and /:taskId/accept already enforce
    // (see taskGuardrails.ts). Deliberately does NOT claim lastGeneratedAt
    // when skipped, so the very next fetch retries — and generates
    // immediately — as soon as the child's board clears, instead of losing
    // the occurrence for a full interval.
    if (template.assignedTo) {
      const busy = await childHasPendingTask(template.assignedTo.id);
      if (busy) {
        continue;
      }
    }

    const threshold = new Date(now - intervalMs);
    const claim = await taskRepo
      .createQueryBuilder()
      .update(Task)
      .set({ lastGeneratedAt: new Date(now) })
      .where('id = :id', { id: template.id })
      .andWhere('"isRecurring" = true')
      .andWhere('("lastGeneratedAt" IS NULL OR "lastGeneratedAt" <= :threshold)', { threshold })
      .execute();

    if (!claim.affected) {
      // Another concurrent request already generated this occurrence.
      continue;
    }

    const clone = buildOccurrenceFromTemplate(template);
    await taskRepo.save(clone);
    generatedAny = true;
  }

  if (generatedAny) {
    broadcastFamilyUpdate(familyId);
  }
}
