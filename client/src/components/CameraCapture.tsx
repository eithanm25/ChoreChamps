import React, { useEffect, useRef, useState } from 'react';

interface CameraCaptureProps {
  /** Called once per photo taken — the caller adds it to its own selected-files state. */
  onCapture: (file: File) => void;
  onClose: () => void;
  /** How many more photos are allowed right now — the shutter disables at 0. */
  remainingSlots: number;
}

/**
 * Live camera capture — the actual enforcement mechanism behind "children can
 * only submit a freshly-taken photo, not an existing one".
 *
 * A plain `<input type="file" capture="environment">` looked like it did
 * this, but `capture` is only honored by mobile browsers with a camera
 * attached; on desktop (or a phone with no camera app configured for it) the
 * browser silently falls back to its normal file picker, which defeats the
 * whole point. This component instead opens the camera directly via
 * getUserMedia and captures a frame to a canvas — there is no file picker
 * anywhere in this flow, on any platform, so there is nothing for a child to
 * "browse" to an old photo with.
 */
export default function CameraCapture({ onCapture, onClose, remainingSlots }: CameraCaptureProps): React.ReactNode {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedCount, setCapturedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('הדפדפן הזה לא תומך בגישה למצלמה. נסו דפדפן אחר או מכשיר אחר.');
        return;
      }
      try {
        // 'ideal' (not 'exact') so a device with only a front camera — most
        // laptops/desktops — still gets a stream instead of failing outright.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch (err) {
        console.error('[CameraCapture] getUserMedia failed:', err);
        setError('לא הצלחנו לגשת למצלמה. ודאו שאישרתם הרשאת מצלמה לדפדפן, ושיש מצלמה זמינה במכשיר.');
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const handleShutter = () => {
    const video = videoRef.current;
    if (!video || remainingSlots <= 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
        setCapturedCount((c) => c + 1);
      },
      'image/jpeg',
      0.9,
    );
  };

  const handleClose = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-lg bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <span className="text-white font-bold text-sm flex items-center gap-1.5">
            <span>📷</span> צילום הוכחה חי
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-sm font-black transition-all"
            title="סגירה"
          >
            ✕
          </button>
        </div>

        {error ? (
          <div className="p-6 text-center flex flex-col items-center gap-3">
            <span className="text-3xl">🚫</span>
            <p className="text-rose-400 text-sm font-bold leading-relaxed">{error}</p>
            <button type="button" onClick={handleClose} className="mt-1 px-5 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all">
              סגירה
            </button>
          </div>
        ) : (
          <>
            <div className="relative bg-black aspect-[3/4] sm:aspect-video">
           
              <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-medium">מפעיל מצלמה...</div>
              )}
            </div>

            <div className="flex flex-col items-center gap-2 p-4">
              <button
                type="button"
                onClick={handleShutter}
                disabled={!ready || remainingSlots <= 0}
                className="w-16 h-16 rounded-full bg-white ring-4 ring-emerald-500/50 hover:ring-emerald-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-2xl shadow-lg"
                title="צלם תמונה"
              >
                📸
              </button>
              <p className="text-slate-400 text-[11px]">
                {remainingSlots > 0 ? `אפשר עוד לצלם ${remainingSlots}` : 'הגעתם למקסימום התמונות למשימה זו'}
              </p>
              {capturedCount > 0 && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-1 px-5 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold shadow-lg hover:from-emerald-600 transition-all"
                >
                  סיימתי לצלם ({capturedCount}) ✓
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
