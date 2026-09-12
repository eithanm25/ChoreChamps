import React, { useEffect, useRef, useState } from 'react';
import { useInterval } from '../hooks/useInterval';

/** Total visible duration of the fake loading sequence. */
const PROGRESS_DURATION_MS = 2700;
/** How often the progress bar re-samples elapsed time — smooth without being wasteful. */
const TICK_MS = 30;
/** Matches the CSS opacity transition duration below — keep the two in sync. */
const FADE_OUT_MS = 500;
/**
 * Hard cap on how much longer the splash waits for `ready` once the fake
 * progress already hit 100% — protects against a slow/cold backend (Render's
 * free tier can take tens of seconds to wake) ever stalling the whole app on
 * a splash screen. A stale session that slips through here still self-heals
 * reactively via api.ts's 401 interceptor once a real request hits it.
 */
const READY_GRACE_MS = 2000;

interface SplashScreenProps {
  /** True once the background session check (see App.tsx) has resolved. */
  ready: boolean;
  /** Fires after the exit fade-out has fully finished — parent should unmount this component then. */
  onFinished: () => void;
}

/**
 * Full-screen gaming-style loading sequence shown on every fresh app load,
 * regardless of auth state. Purely presentational: App.tsx decides *when*
 * it's safe to leave (the `ready` prop) and *what happens after* leaving
 * (routing is already rendered underneath by the time this fades away).
 */
export default function SplashScreen({ ready, onFinished }: SplashScreenProps): React.ReactNode {
  // Date.now() is impure, so it's read inside an effect (below) rather than
  // directly in this initializer — render must stay a pure function of props/state.
  const startRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    startRef.current = Date.now();
  }, []);

  useInterval(
    () => {
      const elapsed = Date.now() - startRef.current;
      setProgress(Math.min(100, (elapsed / PROGRESS_DURATION_MS) * 100));
    },
    progress < 100 ? TICK_MS : null,
  );

  // ברגע שהמד החזותי הגיע ל-100% מחכים גם לבדיקת ההתחברות האמיתית — אבל לא
  // יותר מזמן חסד קצוב, כדי שבדיקה איטית (או שרת שמתעורר מהמצב חינמי) לעולם
  // לא תתקע את המסך הזה לנצח.
  useEffect(() => {
    if (progress < 100 || fading) {
      return;
    }
    // ready כבר עכשיו -> ממתינים רק tick אחד (0ms) כדי לצאת דרך אותה נתיב
    // אסינכרוני; לא-ready עדיין -> נותנים זמן חסד קצוב לפני שממשיכים בכל מקרה.
    const timer = setTimeout(() => setFading(true), ready ? 0 : READY_GRACE_MS);
    return () => clearTimeout(timer);
  }, [progress, ready, fading]);

  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    if (!fading) {
      return;
    }
    const timeout = setTimeout(() => onFinishedRef.current(), FADE_OUT_MS);
    return () => clearTimeout(timeout);
  }, [fading]);

  const displayedProgress = Math.floor(progress);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center gap-8 px-6 transition-opacity ease-out ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ transitionDuration: `${FADE_OUT_MS}ms` }}
      dir="rtl"
    >
      {/* זוהר עדין ברקע — לא צבע שטוח אחד, כדי לשמור על התחושה הפרימיום */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-indigo-950/30 via-slate-950 to-slate-950" />

      <div className="relative flex flex-col items-center gap-6">
        <img
          src="/icons/icon-192.png"
          alt="ChoreChamps"
          className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl shadow-2xl shadow-indigo-500/30 animate-pulse"
        />

        <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400 tracking-wide">
          ChoreChamps
        </h1>

        <div className="w-64 sm:w-80 flex flex-col gap-2">
          <div className="h-3 w-full rounded-full bg-slate-800/80 overflow-hidden ring-1 ring-slate-700/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-amber-400 transition-[width] duration-100 ease-linear"
              style={{ width: `${displayedProgress}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[11px] font-mono">
            <span className="text-slate-400">טוען את האפליקציה...</span>
            <span className="text-indigo-300 font-bold tabular-nums">{displayedProgress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
