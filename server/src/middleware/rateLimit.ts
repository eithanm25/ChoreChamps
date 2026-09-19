import rateLimit from 'express-rate-limit';
import type { AuthenticatedRequest } from './auth';

/**
 * In-memory rate limiters. The default MemoryStore is per-process, which is
 * correct for the current single-instance deployment. If the API is ever scaled
 * to more than one instance, swap in a shared store (e.g. rate-limit-redis) so
 * the counts are global — the limiter definitions here would not otherwise change.
 *
 * NOTE: index.ts must set `app.set('trust proxy', 1)` so these key on the real
 * client IP rather than the Render/Railway load-balancer's.
 */

/**
 * Auth endpoints (`/api/auth/*`): credential-stuffing and brute-force guard for
 * password login, family-code + PIN login, and Google sign-in.
 *
 * `skipSuccessfulRequests` means only failed attempts count toward the limit —
 * a household or classroom behind a single NAT IP can log in normally all day,
 * while a script hammering wrong passwords / family codes / PINs is cut off
 * after 50 failures in 15 minutes.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'יותר מדי ניסיונות התחברות. נסו שוב בעוד כמה דקות.' },
});

/**
 * `POST /api/auth/signup`: caps how many NEW accounts one IP can
 * successfully create — this, not family-per-account (already hard-capped
 * to exactly one, see family.routes.ts's POST /create), is the real abuse
 * lever. Nothing today verifies the email or requires solving a CAPTCHA on
 * this path, so a script minting fresh throwaway emails could otherwise
 * spin up unlimited families, each with its own fresh FREE_TIER_AI_LIMIT of
 * real, paid Anthropic vision calls.
 *
 * Opposite of authLimiter on purpose: `skipFailedRequests: true` means only
 * SUCCESSFUL (2xx) signups count. On this specific route, success cleanly
 * means "a new account was created" (an existing email returns 409), so a
 * real family occasionally mistyping their email and retrying never gets
 * penalized — only an actual run of successful account creation does.
 */
export const signupLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 10,
  skipFailedRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'הגעתם למגבלת יצירת החשבונות היומית מכתובת ה-IP הזו. נסו שוב מחר, או פנו לתמיכה.' },
});

/**
 * `POST /api/tasks/:taskId/submit`: hard ceiling on proof submissions so a
 * stolen or abused token cannot run up the Anthropic bill — every submission
 * can trigger a paid vision call.
 *
 * Keyed by user id, not IP: the route is always authenticated (requireAuth runs
 * first), and siblings sharing one home network must not share a budget. A real
 * child cannot legitimately approach 15/hour anyway — the "one pending task per
 * child" guardrail caps the honest rate far below that.
 */
export const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthenticatedRequest).user?.id ?? 'unauthenticated',
  message: { error: 'הגעתם למגבלת ההגשות לשעה. נסו שוב מאוחר יותר.' },
});
