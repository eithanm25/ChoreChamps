import { useEffect, useRef } from 'react';

/**
 * Runs `callback` every `delayMs` milliseconds, always invoking the latest
 * closure passed in (not one captured when the interval was created) without
 * tearing the interval down and recreating it every render just because the
 * caller's callback identity changed. Pass `delayMs = null` to pause.
 */
export function useInterval(callback: () => void, delayMs: number | null): void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null) {
      return;
    }
    const id = setInterval(() => callbackRef.current(), delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}
