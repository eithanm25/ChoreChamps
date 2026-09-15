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
    return;
  }

  try {
    await initOneSignal();
    await OneSignal.User.addTags({
      userId: user.id,
      familyId: user.familyId,
      role: user.role,
    });
    await OneSignal.Notifications.requestPermission();
  } catch (err) {
    console.error('[onesignal] failed to register device for push:', err);
  }
}
