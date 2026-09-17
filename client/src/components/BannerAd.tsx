import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined;
const SLOT_ID = import.meta.env.VITE_ADSENSE_BANNER_SLOT_ID as string | undefined;

/**
 * One responsive Google AdSense display-ad unit ("banner") — a plain,
 * reusable card, always assumed to be mounted inside <AdsManager>. This
 * component does not itself check subscription tier; AdsManager is the only
 * thing deciding whether it (or the loader script it depends on) ever
 * mounts, so there is exactly one place in the codebase that gates ads.
 *
 * Ships disabled (renders nothing) until VITE_ADSENSE_BANNER_SLOT_ID is set
 * — create the ad unit in the AdSense dashboard first to get one.
 */
export default function BannerAd(): React.ReactNode {
  const requested = useRef(false);

  useEffect(() => {
    if (!CLIENT_ID || !SLOT_ID || requested.current) {
      return;
    }
    requested.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch (err) {
      console.error('[adsense] failed to request banner ad:', err);
    }
  }, []);

  if (!CLIENT_ID || !SLOT_ID) {
    return null;
  }

  return (
    <div className="w-full flex flex-col items-center gap-1.5 py-2">
      <span className="text-slate-500 text-[10px] font-bold tracking-wider">פרסומת</span>
      <ins
        className="adsbygoogle block w-full"
        style={{ display: 'block' }}
        data-ad-client={CLIENT_ID}
        data-ad-slot={SLOT_ID}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
