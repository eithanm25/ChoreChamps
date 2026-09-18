import React from 'react';

/**
 * Suspense fallback for the lazy-loaded authenticated routes (see App.tsx).
 * Deliberately inert: no artificial minimum duration, no animation timer —
 * it shows for exactly as long as the real chunk fetch takes and not one ms
 * longer, unlike SplashScreen's own manufactured delay. Only ever rendered
 * behind a login wall, so there is no crawler-visibility concern here the
 * way there was for the public routes.
 */
export default function RouteLoadingFallback(): React.ReactNode {
  return <div className="min-h-screen bg-slate-900" />;
}
