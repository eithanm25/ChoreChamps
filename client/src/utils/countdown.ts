/**
 * "Time left" display for a task deadline (Task.dueAt). Computed at render
 * time from the task data's last fetch — not a live ticking clock, same
 * freshness model as the rest of the app (polling + realtime refetch), so it
 * can lag by up to one refresh interval, never by more.
 */
export function formatTimeLeft(dueAt: string): string {
  const diffMs = new Date(dueAt).getTime() - Date.now();
  if (diffMs <= 0) {
    return 'הזמן נגמר';
  }

  const totalMinutes = Math.ceil(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `נותרו ${minutes} דקות`;
  }
  if (minutes === 0) {
    return `נותרו ${hours} שעות`;
  }
  return `נותרו ${hours} שעות ו-${minutes} דקות`;
}
