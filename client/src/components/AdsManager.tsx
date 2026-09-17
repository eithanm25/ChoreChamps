import React, { useEffect } from 'react';

const ADSENSE_SCRIPT_ID = 'adsbygoogle-loader';
const CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined;

interface AdsManagerProps {
  /** Premium households see no ads at all — this component renders neither the AdSense script nor its own children for them, so no ad space exists in the DOM. */
  isPremium: boolean;
  children: React.ReactNode;
}

/**
 * Single gate for every ad surface in the app: renders its children (any
 * <BannerAd/> among them) only for a free-tier household, and lazily loads
 * the official Google AdSense loader script (once per page load, idempotent
 * across remounts) the first time it actually does. A premium household
 * never has the script injected and never has an ad slot in the DOM.
 *
 * Ships disabled — children never render, script never loads — until
 * VITE_ADSENSE_CLIENT_ID is set (see client/.env.example), same
 * placeholder-until-configured pattern as services/paddle.ts.
 */
export default function AdsManager({ isPremium, children }: AdsManagerProps): React.ReactNode {
  useEffect(() => {
    if (isPremium || !CLIENT_ID) {
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
  }, [isPremium]);

  if (isPremium || !CLIENT_ID) {
    return null;
  }

  return <>{children}</>;
}
