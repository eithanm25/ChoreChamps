import { useEffect, useRef } from 'react';

/** Default refresh cadence for shared family data (tasks, members). */
export const DEFAULT_POLL_INTERVAL_MS = 8000;

/**
 * Refetches on a fixed interval, and immediately whenever the tab regains
 * focus or becomes visible again — so a task another family member created,
 * approved, or a member someone deleted shows up without a manual reload.
 *
 * fetchFn is expected to manage its own loading state and never flip it back
 * to a "loading" flag on repeat calls, so background refreshes swap data in
 * silently instead of flashing a full-page spinner every interval.
 */
export function usePolling(fetchFn: () => void | Promise<void>, intervalMs: number = DEFAULT_POLL_INTERVAL_MS): void {
  // Held in a ref so the interval/listeners below don't need to be torn down
  // and recreated every render just because fetchFn is a new function identity.
  const fetchRef = useRef(fetchFn);
  useEffect(() => {
    fetchRef.current = fetchFn;
  }, [fetchFn]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchRef.current();
    }, intervalMs);

    const handleFocus = () => {
      fetchRef.current();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchRef.current();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs]);
}
