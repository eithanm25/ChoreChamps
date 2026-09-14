import { initializePaddle, type Paddle } from '@paddle/paddle-js';
import type { BillingInterval } from '../data/subscriptionPlans';

/**
 * Paddle Billing (v3) checkout overlay. Ships with placeholder/empty env vars
 * until the real "Osek Patur" account credentials exist — see
 * client/.env.example. Nothing here throws at import time; a missing token
 * just makes getPaddle() resolve to null, which callers turn into a friendly
 * Hebrew message instead of a broken button. Once the real env vars are set,
 * this file needs no changes.
 */

let paddlePromise: Promise<Paddle | null> | null = null;

/** Loads and initializes Paddle.js exactly once, caching the (possibly null) result. */
function getPaddle(): Promise<Paddle | null> {
  if (paddlePromise) {
    return paddlePromise;
  }

  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
  if (!token) {
    console.warn('[paddle] VITE_PADDLE_CLIENT_TOKEN is not set; checkout is disabled');
    paddlePromise = Promise.resolve(null);
    return paddlePromise;
  }

  paddlePromise = initializePaddle({
    token,
    environment: import.meta.env.VITE_PADDLE_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
  }).then((paddle) => paddle ?? null);

  return paddlePromise;
}

/** The Paddle Price ID for the one paid tier's monthly or annual billing frequency, or null if unset (still a placeholder). */
export function priceIdForBilling(interval: BillingInterval): string | null {
  if (interval === 'month') {
    return import.meta.env.VITE_PADDLE_PRICE_ID_MONTHLY || null;
  }
  return import.meta.env.VITE_PADDLE_PRICE_ID_ANNUAL || null;
}

export interface OpenCheckoutParams {
  priceId: string;
  /** Round-trips into every Paddle webhook for this subscription — how the backend knows which family to upgrade. */
  familyId: string;
  email?: string;
}

/**
 * Opens the Paddle Checkout overlay for one price. Throws a plain Error with a
 * Hebrew message on any reason it can't (not configured yet, or Paddle.js
 * failed to load) — callers should catch it and show the message, not crash.
 */
export async function openCheckout({ priceId, familyId, email }: OpenCheckoutParams): Promise<void> {
  const paddle = await getPaddle();
  if (!paddle) {
    throw new Error('התשלומים עדיין לא הוגדרו במערכת — נסו שוב בקרוב');
  }

  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customData: { familyId },
    ...(email ? { customer: { email } } : {}),
  });
}
