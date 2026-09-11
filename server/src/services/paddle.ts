import { Paddle, Environment } from '@paddle/paddle-node-sdk';
import { SubscriptionTier } from '../entities/Family';

/**
 * Paddle Billing (v3) integration. Every credential below is optional at boot —
 * this app ships with placeholder/empty values until the real "Osek Patur"
 * account credentials are dropped into the environment. Nothing here throws on
 * missing config; the webhook route degrades to a clear 503 instead, exactly
 * like the ANTHROPIC_API_KEY / R2 pattern elsewhere in this codebase. Once the
 * real env vars are set (see server/.env.example), this file needs no changes.
 */

let client: Paddle | null = null;

/** Constructed lazily so a missing PADDLE_API_KEY degrades this one feature instead of crashing startup. */
export function getPaddleClient(): Paddle | null {
  if (client) {
    return client;
  }

  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    console.warn('[paddle] PADDLE_API_KEY is not set; billing is disabled');
    return null;
  }

  client = new Paddle(apiKey, {
    environment: process.env.PADDLE_ENVIRONMENT === 'production' ? Environment.production : Environment.sandbox,
  });
  return client;
}

/** Signing secret for the webhook endpoint (Paddle dashboard → Notifications → your destination). */
export function getWebhookSecret(): string | null {
  return process.env.PADDLE_WEBHOOK_SECRET || null;
}

/**
 * Maps a Paddle Price ID (from a subscription/transaction line item) back to
 * one of our own paid tiers. Reads the mapping from env so the real price IDs
 * — created on the client's own Paddle account — are a pure config change,
 * never a code change. An unrecognized price ID (including while these are
 * still unset placeholders) returns null and the caller should no-op rather
 * than guess.
 */
export function tierForPriceId(priceId: string): SubscriptionTier.PREMIUM | SubscriptionTier.ACADEMY | null {
  if (priceId && priceId === process.env.PADDLE_PRICE_ID_PREMIUM) {
    return SubscriptionTier.PREMIUM;
  }
  if (priceId && priceId === process.env.PADDLE_PRICE_ID_ACADEMY) {
    return SubscriptionTier.ACADEMY;
  }
  return null;
}
