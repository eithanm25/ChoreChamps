import React, { useEffect } from 'react';

const ADSENSE_SCRIPT_ID = 'adsbygoogle-loader';
const CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined;

interface AdsManagerProps {
  /**
   * Strict `=== true` check on purpose: `undefined` (not logged in yet, or
   * logged in but tier not fetched yet) and `false` both fall through to
   * "inject the script." Google's own AdSense site-verification crawler
   * hits "/" logged out and requires the loader script present on that
   * very first anonymous load — defaulting to blocked-until-proven-free
   * would fail verification for every anonymous/guest visitor, which is
   * everyone the crawler ever sees. Only a positively confirmed premium
   * family (known after login + their own family info loads) suppresses it.
   */
  isPremium?: boolean;
  children: React.ReactNode;
}

/**
 * Mounted once, globally, at the App root (see App.tsx) — NOT inside an
 * authenticated dashboard — so the AdSense loader script is present on
 * initial mount for every route and every visitor, logged in or not.
 * Idempotent across remounts (checks for the script tag by id first).
 *
 * IMPORTANT: this always renders `children` unconditionally — it wraps the
 * *entire app* now, so it must never be able to blank the whole page just
 * because ad config is missing or a family turns out to be premium. It
 * only ever gates the script-injection side effect, never rendering.
 *
 * Actually suppressing visible ads for a confirmed-premium household
 * happens by simply never rendering <BannerAd/> for them (see
 * ParentDashboard) — the script being present in the background is
 * harmless with no ad slot ever requesting a fill.
 *
 * Ships disabled — script never loads for anyone — until
 * VITE_ADSENSE_CLIENT_ID is set (see client/.env.example), same
 * placeholder-until-configured pattern as services/paddle.ts.
 */
export default function AdsManager({ isPremium, children }: AdsManagerProps): React.ReactNode {
  const blocked = isPremium === true;

  useEffect(() => {
    if (blocked || !CLIENT_ID) {
      return;
    }
    if (document.getElementById(ADSENSE_SCRIPT_ID)) {
      return;
    }

    const script = document.createElement('script');
    script.id = ADSENSE_SCRIPT_ID;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT_ID}`;
    document.head.appendChild(script);
  }, [blocked]);

  return <>{children}</>;
}
