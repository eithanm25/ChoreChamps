import express, { Router, Request, Response } from 'express';
import { EventName } from '@paddle/paddle-node-sdk';
import { AppDataSource } from '../data-source';
import { Family, SubscriptionTier } from '../entities/Family';
import { getPaddleClient, getWebhookSecret, tierForPriceId } from '../services/paddle';

const router = Router();

/**
 * POST /api/payments/webhook
 * Paddle Billing server-to-server notification endpoint. Verifies the
 * Paddle-Signature header, then on a subscription becoming active/resumed
 * unlocks the paying family's tier, and on cancellation/pause reverts it to
 * FREE.
 *
 * IMPORTANT: this route supplies its own express.raw() body parser and MUST
 * be mounted in index.ts before the app-wide express.json() middleware.
 * Paddle's signature is an HMAC over the exact raw request bytes — once
 * express.json() has parsed (and thereby consumed and reserialized) the body,
 * the byte-for-byte original is gone and every signature check fails.
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const paddle = getPaddleClient();
  const webhookSecret = getWebhookSecret();

  if (!paddle || !webhookSecret) {
    // Expected while running on placeholder credentials — not an error state,
    // just "billing isn't wired up yet". 503 (not 200) so a real Paddle
    // notification would be retried once the real env vars land.
    console.warn('[payments/webhook] received a notification but Paddle is not configured yet');
    res.status(503).json({ error: 'Billing is not configured yet' });
    return;
  }

  const signature = req.header('paddle-signature');
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : null;

  if (!signature || !rawBody) {
    res.status(400).json({ error: 'Missing signature or body' });
    return;
  }

  let event;
  try {
    // unmarshal both verifies the HMAC signature and parses the payload into
    // a typed event in one step — a bad/forged signature throws here.
    event = await paddle.webhooks.unmarshal(rawBody, webhookSecret, signature);
  } catch (err) {
    console.error('[payments/webhook] signature verification failed:', err);
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  if (!event) {
    res.status(400).json({ error: 'Unrecognized event payload' });
    return;
  }

  try {
    switch (event.eventType) {
      case EventName.SubscriptionActivated:
      case EventName.SubscriptionCreated:
      case EventName.SubscriptionResumed: {
        await grantTier(event.data.customData, event.data.items[0]?.price?.id);
        break;
      }
      case EventName.SubscriptionCanceled:
      case EventName.SubscriptionPaused: {
        await revokeTier(event.data.customData);
        break;
      }
      default:
        // Every other Paddle event (customer.*, transaction.*, etc.) is
        // acknowledged but intentionally ignored — this app only cares about
        // subscription state.
        break;
    }
  } catch (err) {
    // A DB hiccup here is worth a Paddle retry (it resends on non-2xx), unlike
    // a signature failure or unresolvable payload above.
    console.error('[payments/webhook] failed to apply event:', event.eventType, err);
    res.status(500).json({ error: 'Failed to process event' });
    return;
  }

  res.status(200).json({ received: true });
});

/** Reads familyId out of the checkout's custom_data and upgrades that family to the tier matching the purchased price. */
async function grantTier(customData: Record<string, unknown> | null, priceId: string | undefined): Promise<void> {
  const familyId = typeof customData?.familyId === 'string' ? customData.familyId : null;
  if (!familyId) {
    console.warn('[payments/webhook] subscription event had no familyId in custom_data — skipping');
    return;
  }

  const tier = priceId ? tierForPriceId(priceId) : null;
  if (!tier) {
    console.warn(`[payments/webhook] price ${priceId ?? '(none)'} does not match a known tier — skipping`);
    return;
  }

  await AppDataSource.getRepository(Family).update({ id: familyId }, { tier });
  console.log(`[payments/webhook] family ${familyId} upgraded to ${tier}`);
}

/** Reads familyId out of the subscription's custom_data and reverts that family to FREE. */
async function revokeTier(customData: Record<string, unknown> | null): Promise<void> {
  const familyId = typeof customData?.familyId === 'string' ? customData.familyId : null;
  if (!familyId) {
    console.warn('[payments/webhook] cancellation event had no familyId in custom_data — skipping');
    return;
  }

  await AppDataSource.getRepository(Family).update({ id: familyId }, { tier: SubscriptionTier.FREE });
  console.log(`[payments/webhook] family ${familyId} reverted to free`);
}

export default router;
