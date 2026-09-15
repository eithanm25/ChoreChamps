import OneSignal from 'react-onesignal';

/**
 * OneSignal Web SDK (background + in-app push). Ships disabled — the SDK is
 * never even initialized — until VITE_ONESIGNAL_APP_ID is set, same
 * placeholder-until-configured pattern as services/paddle.ts. Requires
 * public/OneSignalSDKWorker.js to exist (it does) for background delivery
 * once the tab/app is closed.
 */
const APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined;

let initPromise: Promise<void> | null = null;

/** Initializes the SDK exactly once per page load. */
function initOneSignal(): Promise<void> {
  if (!initPromise) {
    initPromise = OneSignal.init({ appId: APP_ID as string }).catch((err: unknown) => {
      console.error('[onesignal] failed to initialize:', err);
    });
  }
  return initPromise;
}

export interface PushRegistrationUser {
  id: string;
  role: 'parent' | 'child';
  familyId: string;
}

/**
 * Initializes OneSignal, tags this device with the signed-in user's
 * id/role/family (so the server can target it by tag filter — see
 * server/src/services/oneSignal.ts), and prompts for native push permission.
 * Called once a dashboard confirms both familyId and userId are known (see
 * ParentDashboard/ChildDashboard's mount effect) — never blocks rendering,
 * and never throws back into the caller.
 */
export async function registerForPushNotifications(user: PushRegistrationUser): Promise<void> {
  if (!APP_ID) {
    // Previously a silent no-op here — indistinguishable in the console from
    // a real init failure. Loud on purpose: this is the #1 cause of "no
    // errors, no prompt" reports — the env var simply isn't deployed yet.
    console.warn('[onesignal] VITE_ONESIGNAL_APP_ID is not set — push notifications are disabled on this build');
    return;
  }

  try {
    await initOneSignal();
    console.log('[onesignal] initialized with app id:', APP_ID);
    await OneSignal.User.addTags({
      userId: user.id,
      familyId: user.familyId,
      role: user.role,
    });
    // Native browser permission prompt — no-ops quietly if the user already
    // granted/denied it previously (that's a browser rule, not something
    // this SDK call can override).
    const granted = await OneSignal.Notifications.requestPermission();
    console.log('[onesignal] push permission granted:', granted);
  } catch (err) {
    console.error('[onesignal] failed to register device for push:', err);
  }
}
