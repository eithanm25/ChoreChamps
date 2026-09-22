/** Mirrors the server's TaskFrequency enum (server/src/entities/Task.ts) — no shared package between client/server, see types/family.ts for the same convention. */
export type TaskFrequency = 'daily' | 'weekly' | 'monthly';

export const FREQUENCY_LABELS: Record<TaskFrequency, string> = {
  daily: 'כל יום',
  weekly: 'כל שבוע',
  monthly: 'כל חודש',
};
