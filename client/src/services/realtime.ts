import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Read-only Supabase Realtime client — subscribes to the "something
 * changed" broadcasts the server publishes (see
 * server/src/services/realtime.ts) and never writes anything itself. Only
 * ever holds the public anon key, never a service role key.
 *
 * Ships disabled (null) until both VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY are set — see client/.env.example — same
 * placeholder-until-configured pattern as services/paddle.ts.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;
let warned = false;

export function getSupabaseClient(): SupabaseClient | null {
  if (client) {
    return client;
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    if (!warned) {
      console.warn(
        '[realtime] VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY not set; live updates disabled, falling back to periodic polling',
      );
      warned = true;
    }
    return null;
  }
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
