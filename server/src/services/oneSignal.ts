/**
 * OneSignal push notifications. Every device registered by the client (see
 * client/src/services/oneSignal.ts) carries three tags — userId, familyId,
 * and role ('parent' | 'child') — so every notification in this file targets
 * purely by tag filter, never by OneSignal's own internal user/player id.
 *
 * Ships with placeholder/empty env vars until the real OneSignal app exists
 * (see server/.env.example) — sendPush degrades to a warning instead of
 * throwing, exactly like the Paddle/R2/Anthropic pattern elsewhere in this
 * codebase. Every exported notify* function is fire-and-forget: callers never
 * await them, so a slow or failing OneSignal call can never delay an Express
 * response or take down a route on an unhandled rejection.
 *
 * BUG FIXED HERE: a multi-condition filter (family + role) was built as two
 * consecutive filter objects with no explicit operator between them. Every
 * single-condition push (a bare userId or familyId tag) was delivering fine;
 * every two-condition push (family AND role — task-open-for-claim,
 * task-submitted, reward-purchased, family-grew) was silently matching zero
 * devices: OneSignal's REST API does NOT default to AND between adjacent
 * filter entries the way a lot of similar-looking rule-engine arrays do — it
 * requires an explicit {"operator": "AND"} entry, or it does not evaluate the
 * combination the way you'd expect. See familyRoleTag below.
 */

const ONESIGNAL_NOTIFICATIONS_URL = 'https://onesignal.com/api/v1/notifications';

interface OneSignalTagFilter {
  field: 'tag';
  key: string;
  relation: '=' | '!=';
  value: string;
}

interface OneSignalOperator {
  operator: 'AND' | 'OR';
}

type OneSignalFilterEntry = OneSignalTagFilter | OneSignalOperator;

interface SendPushInput {
  /** Short label identifying the business event, purely for server logs (e.g. "task-assigned"). */
  context: string;
  title: string;
  body: string;
  filters: OneSignalFilterEntry[];
}

function getOneSignalConfig(): { appId: string; apiKey: string } | null {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;
  if (!appId || !apiKey) {
    return null;
  }
  return { appId, apiKey };
}

async function sendPush({ context, title, body, filters }: SendPushInput): Promise<void> {
  const config = getOneSignalConfig();
  if (!config) {
    console.warn(`[onesignal:${context}] ONESIGNAL_APP_ID/ONESIGNAL_API_KEY not set; push notification skipped`);
    return;
  }

  const res = await fetch(ONESIGNAL_NOTIFICATIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Key ${config.apiKey}`,
    },
    body: JSON.stringify({
      app_id: config.appId,
      headings: { en: title, he: title },
      contents: { en: body, he: body },
      filters,
    }),
  });

  const payload: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(`OneSignal responded ${res.status}: ${JSON.stringify(payload)}`);
  }

  // OneSignal returns 200 even when the filters matched nobody — that's a
  // silent delivery drop unless we surface it ourselves. This is exactly the
  // shape of failure the family+role filter bug above produced.
  const recipients = (payload as { recipients?: number } | null)?.recipients;
  if (recipients === 0) {
    console.warn(`[onesignal:${context}] push "${title}" matched 0 devices — check tag filters/registration`, filters);
  } else {
    console.log(`[onesignal:${context}] push "${title}" sent to ${recipients ?? '?'} device(s)`);
  }
}

/** Every notify* function below routes through this — never sendPush directly. */
function sendPushInBackground(input: SendPushInput): void {
  try {
    sendPush(input).catch((err: unknown) => {
      console.error(`[onesignal:${input.context}] push failed:`, err);
    });
  } catch (err) {
    // sendPush is async and shouldn't throw synchronously, but a notify*
    // call site must never be able to take down its route either way.
    console.error(`[onesignal:${input.context}] push failed synchronously:`, err);
  }
}

const userTag = (userId: string): OneSignalFilterEntry[] => [
  { field: 'tag', key: 'userId', relation: '=', value: userId },
];

/** family AND role — see the file-level docstring for why the explicit operator matters. */
const familyRoleTag = (familyId: string, role: 'parent' | 'child'): OneSignalFilterEntry[] => [
  { field: 'tag', key: 'familyId', relation: '=', value: familyId },
  { operator: 'AND' },
  { field: 'tag', key: 'role', relation: '=', value: role },
];

const familyTag = (familyId: string): OneSignalFilterEntry[] => [
  { field: 'tag', key: 'familyId', relation: '=', value: familyId },
];

// ── Parent → child ──────────────────────────────────────────────────────

/** A parent assigned a task directly to one child. */
export function notifyTaskAssigned(childUserId: string, taskTitle: string): void {
  sendPushInBackground({
    context: 'task-assigned',
    title: '🎯 משימה חדשה מחכה לך!',
    body: `המשימה '${taskTitle}' עלתה ללוח. צא לדרך והרווח ChoreCoins!`,
    filters: userTag(childUserId),
  });
}

/** A parent published an open task any child in the family may claim ("לחטיפה"). */
export function notifyTaskOpenForClaim(familyId: string, taskTitle: string): void {
  sendPushInBackground({
    context: 'task-open-for-claim',
    title: '🔥 משימה חמה בלוח!',
    body: `מי הראשון שיחטוף את המשימה '${taskTitle}' ויקח את הפרס?`,
    filters: familyRoleTag(familyId, 'child'),
  });
}

/** A parent marked a fully-funded individual reward as fulfilled. */
export function notifyRewardFulfilled(childUserId: string, rewardTitle: string): void {
  sendPushInBackground({
    context: 'reward-fulfilled',
    title: '🎁 הפרס שלך אושר!',
    body: `הפרס שרצית '${rewardTitle}' אושר על ידי ההורים וממתין לך בחנות!`,
    filters: userTag(childUserId),
  });
}

/** A parent approved a completed task, paying out ChoreCoins. */
export function notifyTaskApproved(childUserId: string, taskTitle: string, totalPayout: string): void {
  sendPushInBackground({
    context: 'task-approved',
    title: '✅ המשימה שלך אושרה!',
    body: `כל הכבוד! המשימה '${taskTitle}' אושרה וקיבלת ${totalPayout} ChoreCoins לארנק!`,
    filters: userTag(childUserId),
  });
}

// ── Child → parent ───────────────────────────────────────────────────────

/** A child submitted proof photos for a task. */
export function notifyTaskSubmitted(familyId: string, childName: string, taskTitle: string): void {
  sendPushInBackground({
    context: 'task-submitted',
    title: '📸 הוגשה הוכחה למשימה',
    body: `${childName} הגיש/ה הוכחה מצולמת עבור '${taskTitle}'. ה-AI כבר ניתח, כנסו לאשר!`,
    filters: familyRoleTag(familyId, 'parent'),
  });
}

/** A child fully funded (bought) an individual reward. */
export function notifyRewardPurchased(familyId: string, childName: string, rewardTitle: string): void {
  sendPushInBackground({
    context: 'reward-purchased',
    title: '🛍️ רכישת פרס חדש!',
    body: `בשעה טובה! ${childName} רכש/ה את הפרס '${rewardTitle}' תמורת ChoreCoins!`,
    filters: familyRoleTag(familyId, 'parent'),
  });
}

// ── Financial / coin ledger ──────────────────────────────────────────────

/** A parent credited a child's wallet directly. */
export function notifyWalletParentToChild(childUserId: string, amount: string): void {
  sendPushInBackground({
    context: 'wallet-parent-to-child',
    title: '💰 קיבלת ChoreCoins!',
    body: `איזה כיף! אבא/אמא העבירו לך ${amount} ChoreCoins ישירות לארנק!`,
    filters: userTag(childUserId),
  });
}

/** One child sent coins to a sibling. */
export function notifyWalletSiblingTransfer(recipientChildUserId: string, senderName: string, amount: string): void {
  sendPushInBackground({
    context: 'wallet-sibling-transfer',
    title: '💸 העברה מאח/אחות!',
    body: `${senderName} העביר/ה לך ${amount} ChoreCoins! איזה שיתוף פעולה משפחתי!`,
    filters: userTag(recipientChildUserId),
  });
}

// ── Group reward goals ───────────────────────────────────────────────────

/** A child contributed to a collaborative (family-wide) reward goal. */
export function notifySharedRewardContribution(
  familyId: string,
  childName: string,
  amount: string,
  rewardTitle: string,
): void {
  sendPushInBackground({
    context: 'shared-reward-contribution',
    title: '🚀 עוד צעד למטרה המשפחתית!',
    body: `${childName} תרם/ה ${amount} מטבעות עבור הפרס המשותף '${rewardTitle}'. ממשיכים יחד אל היעד!`,
    filters: familyTag(familyId),
  });
}

// ── Household management ─────────────────────────────────────────────────

/** A new co-parent joined the household. */
export function notifyFamilyGrew(familyId: string): void {
  sendPushInBackground({
    context: 'family-grew',
    title: '👨‍👩‍👧‍👦 המשפחה גדלה!',
    body: 'משתמש חדש הצטרף זה עתה למשפחת ChoreChamps שלכם!',
    filters: familyRoleTag(familyId, 'parent'),
  });
}
