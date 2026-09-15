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
 */

const ONESIGNAL_NOTIFICATIONS_URL = 'https://onesignal.com/api/v1/notifications';

interface OneSignalTagFilter {
  field: 'tag';
  key: string;
  relation: '=' | '!=';
  value: string;
}

interface SendPushInput {
  title: string;
  body: string;
  /** ANDed together — every filter must match a device for it to receive this push. */
  filters: OneSignalTagFilter[];
}

function getOneSignalConfig(): { appId: string; apiKey: string } | null {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;
  if (!appId || !apiKey) {
    return null;
  }
  return { appId, apiKey };
}

async function sendPush({ title, body, filters }: SendPushInput): Promise<void> {
  const config = getOneSignalConfig();
  if (!config) {
    console.warn('[onesignal] ONESIGNAL_APP_ID/ONESIGNAL_API_KEY not set; push notification skipped');
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

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OneSignal responded ${res.status}: ${text}`);
  }
}

/** Every notify* function below routes through this — never sendPush directly. */
function sendPushInBackground(input: SendPushInput): void {
  sendPush(input).catch((err: unknown) => {
    console.error('[onesignal] push failed:', err);
  });
}

const userTag = (userId: string): OneSignalTagFilter[] => [{ field: 'tag', key: 'userId', relation: '=', value: userId }];

const familyRoleTag = (familyId: string, role: 'parent' | 'child'): OneSignalTagFilter[] => [
  { field: 'tag', key: 'familyId', relation: '=', value: familyId },
  { field: 'tag', key: 'role', relation: '=', value: role },
];

const familyTag = (familyId: string): OneSignalTagFilter[] => [
  { field: 'tag', key: 'familyId', relation: '=', value: familyId },
];

// ── Parent → child ──────────────────────────────────────────────────────

/** A parent assigned a task directly to one child. */
export function notifyTaskAssigned(childUserId: string, taskTitle: string): void {
  sendPushInBackground({
    title: '🎯 משימה חדשה מחכה לך!',
    body: `המשימה '${taskTitle}' עלתה ללוח. צא לדרך והרווח ChoreCoins!`,
    filters: userTag(childUserId),
  });
}

/** A parent published an open task any child in the family may claim ("לחטיפה"). */
export function notifyTaskOpenForClaim(familyId: string, taskTitle: string): void {
  sendPushInBackground({
    title: '🔥 משימה חמה בלוח!',
    body: `מי הראשון שיחטוף את המשימה '${taskTitle}' ויקח את הפרס?`,
    filters: familyRoleTag(familyId, 'child'),
  });
}

/** A parent marked a fully-funded individual reward as fulfilled. */
export function notifyRewardFulfilled(childUserId: string, rewardTitle: string): void {
  sendPushInBackground({
    title: '🎁 הפרס שלך אושר!',
    body: `הפרס שרצית '${rewardTitle}' אושר על ידי ההורים וממתין לך בחנות!`,
    filters: userTag(childUserId),
  });
}

// ── Child → parent ───────────────────────────────────────────────────────

/** A child submitted proof photos for a task. */
export function notifyTaskSubmitted(familyId: string, childName: string, taskTitle: string): void {
  sendPushInBackground({
    title: '📸 הוגשה הוכחה למשימה',
    body: `${childName} הגיש/ה הוכחה מצולמת עבור '${taskTitle}'. ה-AI כבר ניתח, כנסו לאשר!`,
    filters: familyRoleTag(familyId, 'parent'),
  });
}

/** A child fully funded (bought) an individual reward. */
export function notifyRewardPurchased(familyId: string, childName: string, rewardTitle: string): void {
  sendPushInBackground({
    title: '🛍️ רכישת פרס חדש!',
    body: `בשעה טובה! ${childName} רכש/ה את הפרס '${rewardTitle}' תמורת ChoreCoins!`,
    filters: familyRoleTag(familyId, 'parent'),
  });
}

// ── Financial / coin ledger ──────────────────────────────────────────────

/** A parent credited a child's wallet directly. */
export function notifyWalletParentToChild(childUserId: string, amount: string): void {
  sendPushInBackground({
    title: '💰 קיבלת ChoreCoins!',
    body: `איזה כיף! אבא/אמא העבירו לך ${amount} ChoreCoins ישירות לארנק!`,
    filters: userTag(childUserId),
  });
}

/** One child sent coins to a sibling. */
export function notifyWalletSiblingTransfer(recipientChildUserId: string, senderName: string, amount: string): void {
  sendPushInBackground({
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
    title: '🚀 עוד צעד למטרה המשפחתית!',
    body: `${childName} תרם/ה ${amount} מטבעות עבור הפרס המשותף '${rewardTitle}'. ממשיכים יחד אל היעד!`,
    filters: familyTag(familyId),
  });
}

// ── Household management ─────────────────────────────────────────────────

/** A new co-parent joined the household. */
export function notifyFamilyGrew(familyId: string): void {
  sendPushInBackground({
    title: '👨‍👩‍👧‍👦 המשפחה גדלה!',
    body: 'משתמש חדש הצטרף זה עתה למשפחת ChoreChamps שלכם!',
    filters: familyRoleTag(familyId, 'parent'),
  });
}
