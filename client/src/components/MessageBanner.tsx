import React from 'react';

export type MessageType = 'success' | 'error';

interface MessageBannerProps {
  type: MessageType;
  text: string;
  onDismiss?: () => void;
}

export default function MessageBanner({ type, text, onDismiss }: MessageBannerProps): React.ReactNode {
  const isSuccess = type === 'success';

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'w-full rounded-2xl border p-4 shadow-lg backdrop-blur-sm',
        isSuccess
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 shadow-emerald-500/10'
          : 'border-rose-500/30 bg-rose-500/10 text-rose-200 shadow-rose-500/10',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            'flex h-9 w-9 items-center justify-center rounded-full text-base font-black',
            isSuccess ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300',
          ].join(' ')}
        >
          {isSuccess ? '✓' : '!'}
        </div>

        <div className="flex-1 text-sm leading-relaxed font-medium">
          {text}
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full px-2 py-1 text-xs font-bold opacity-70 transition hover:opacity-100"
            aria-label="Close notification"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
