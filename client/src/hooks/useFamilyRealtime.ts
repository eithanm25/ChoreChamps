import { useEffect, useRef } from 'react';
import { getSupabaseClient } from '../services/realtime';

/**
 * Subscribes to this family's Supabase Realtime Broadcast channel and calls
 * onUpdate() whenever the server signals "something changed" (see
 * server/src/services/realtime.ts's broadcastFamilyUpdate) — the primary
 * mechanism keeping dashboards fresh now, replacing frequent polling.
 * usePolling is still kept alongside this everywhere it's used, just at a
 * much slower interval — a safety net for a missed broadcast (a dropped
 * connection, a backgrounded tab reconnecting), not the primary path.
 *
 * No-ops entirely — no subscription, no cleanup needed — when familyId is
 * unset or Supabase isn't configured (see services/realtime.ts).
 */
export function useFamilyRealtime(familyId: string | null | undefined, onUpdate: () => void): void {
  // Held in a ref so the subscription below isn't torn down and recreated
  // every render just because onUpdate is a new function identity.
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!familyId) {
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel(`family:${familyId}`)
      .on('broadcast', { event: 'family_updated' }, () => {
        onUpdateRef.current();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId]);
}
