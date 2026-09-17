import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Realtime Broadcast — the replacement for clients polling this
 * server every few seconds. The server stays the sole gatekeeper: every
 * broadcast carries no actual data (empty payload), just "something in this
 * family changed, go refetch" — the real data still only ever comes back
 * through the normal authenticated REST endpoints. This is deliberate, not
 * an oversight: Broadcast channels are topic-named strings a client can
 * subscribe to with nothing but the public anon key, so even though a
 * familyId (a random UUID) is practically unguessable, the payload itself
 * must never be sensitive — the channel is a doorbell, not a data pipe.
 *
 * Uses httpSend() (a plain REST call, supabase-js >= 2.37) rather than
 * opening a websocket to publish — appropriate for a stateless Express
 * process that shouldn't hold a persistent Realtime connection open just to
 * fire occasional one-off events.
 *
 * Ships disabled — every call warns and no-ops — until SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are both set (see server/.env.example), same
 * placeholder-until-configured pattern as services/paddle.ts and
 * services/oneSignal.ts. Every exported broadcast* function is
 * fire-and-forget: callers never await them.
 */

function getClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return null;
  }
  return createClient(url, serviceRoleKey);
}

function sendBroadcastInBackground(channelTopic: string, event: string): void {
  const supabase = getClient();
  if (!supabase) {
    console.warn(`[realtime] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set; broadcast "${event}" on ${channelTopic} skipped`);
    return;
  }

  const channel = supabase.channel(channelTopic);
  channel
    .httpSend(event, {})
    .then((result) => {
      if (!result.success) {
        console.error(`[realtime] broadcast "${event}" on ${channelTopic} failed:`, result.status, result.error);
      }
    })
    .catch((err: unknown) => {
      console.error(`[realtime] broadcast "${event}" on ${channelTopic} threw:`, err);
    })
    .finally(() => {
      supabase.removeChannel(channel);
    });
}

/**
 * Tells every device belonging to this family "something changed, go
 * refetch" — tasks, rewards, wallet balances, or membership. Deliberately
 * one generic event rather than several fine-grained ones: every dashboard
 * that listens already knows how to refetch its own slice of data, so the
 * cost of an occasional unnecessary refetch is far cheaper than the
 * complexity of routing event types end to end.
 */
export function broadcastFamilyUpdate(familyId: string): void {
  sendBroadcastInBackground(`family:${familyId}`, 'family_updated');
}
