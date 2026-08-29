import React from 'react';

interface ConfirmDialogProps {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button — for destructive actions (delete, archive, remove). Defaults to true. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * In-app replacement for window.confirm — a native browser alert looks
 * broken next to the rest of this UI and can't be styled/localized properly.
 * Same dark-overlay pattern as MediaLightbox/CameraCapture/ProfileSettingsPanel.
 */
export default function ConfirmDialog({
  message,
  confirmLabel = 'כן, בטוח/ה',
  cancelLabel = 'ביטול',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.ReactNode {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onCancel}
      role="alertdialog"
      aria-modal="true"
      dir="rtl"
    >
      <div
        className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-3xl">{danger ? '⚠️' : '❓'}</span>
          <p className="text-slate-200 text-sm font-bold leading-relaxed">{message}</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold transition-all"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-full text-white text-sm font-bold shadow-lg transition-all ${
              danger ? 'bg-rose-500 hover:bg-rose-600' : 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
