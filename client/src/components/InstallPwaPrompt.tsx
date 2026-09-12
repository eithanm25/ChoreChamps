import React, { useEffect, useState } from 'react';

/**
 * Not (yet) part of TypeScript's DOM lib — Chrome/Edge/Android fire this
 * non-standard event on `window` when the current page qualifies as an
 * installable PWA and hasn't been installed yet.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

/** Silences the banner for the rest of this browser tab session — not permanent, so it's back next visit. */
const DISMISS_KEY = 'chorechamps:install-prompt-dismissed';

function isRunningStandalone(): boolean {
  const iosHomeScreen = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia('(display-mode: standalone)').matches || iosHomeScreen;
}

/**
 * Floating "install as app" badge, mounted once and globally (see App.tsx) so
 * it appears in the same fixed spot across every screen. Renders nothing —
 * not even an empty wrapper — the moment the app is already running as an
 * installed PWA shell, and nothing until the browser actually hands over a
 * native install prompt to trigger.
 */
export default function InstallPwaPrompt(): React.ReactNode {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(isRunningStandalone);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1');

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      // מונע את מיני-הבאנר המובנה של הדפדפן — אנחנו מציגים כפתור משלנו, יפה יותר
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // רשת ביטחון נוספת: בדפדפנים מסוימים display-mode מתחלף בלי שהאירוע
    // appinstalled בכלל יורה.
    const mql = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = () => setStandalone(isRunningStandalone());
    mql.addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mql.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  // 🛡️ מותקן כבר כאפליקציה עצמאית — הבאנר הזה אסור שיופיע שוב, אף פעם
  if (standalone) {
    return null;
  }

  if (!deferredPrompt || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // כל אירוע beforeinstallprompt ניתן למימוש פעם אחת בלבד — גם אם בוטל,
    // חובה לנקות אותו ולחכות לאירוע טרי מהדפדפן לפני שאפשר להציע שוב
    setDeferredPrompt(null);
    if (outcome === 'accepted') {
      setStandalone(true);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2 animate-fade-in" dir="rtl">
      <button
        type="button"
        onClick={handleInstallClick}
        className="flex items-center gap-2 pl-4 pr-3 py-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold shadow-xl shadow-indigo-500/30 hover:from-indigo-600 hover:to-violet-600 transition-all"
      >
        <span className="text-base">📲</span>
        רוצים להתקין כאפליקציה? לחצו כאן!
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        title="סגירה"
        className="w-7 h-7 shrink-0 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-black shadow-lg transition-all"
      >
        ✕
      </button>
    </div>
  );
}
