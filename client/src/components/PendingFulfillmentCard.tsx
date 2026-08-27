import React, { useState } from 'react';
import type { RewardDto } from '../types/reward';

interface PendingFulfillmentCardProps {
  reward: RewardDto;
  /** Omit to render the read-only "already fulfilled" variant (history view). */
  onFulfill?: () => Promise<void>;
  busy?: boolean;
}

/**
 * A single purchased-but-not-yet-delivered reward, shown in the parent
 * dashboard's "⏳ פרסים ממתינים למימוש" queue. Also doubles as the read-only
 * card for "✅ היסטוריית פרסים שסופקו" when onFulfill is omitted.
 */
export default function PendingFulfillmentCard({ reward, onFulfill, busy }: PendingFulfillmentCardProps): React.ReactNode {
  const [actionLoading, setActionLoading] = useState(false);
  const disabled = busy || actionLoading;
  const isFulfilled = !onFulfill;

  const handleClick = async () => {
    if (!onFulfill || disabled) return;
    setActionLoading(true);
    try {
      await onFulfill();
    } finally {
      setActionLoading(false);
    }
  };

  const recipientLabel = reward.type === 'individual' ? reward.targetChild?.name : 'כל הילדים 👥';

  return (
    <div
      className={`flex gap-3 rounded-2xl border p-3 shadow-lg transition-all ${
        isFulfilled ? 'bg-slate-800/20 border-slate-800' : 'bg-gradient-to-br from-amber-950/30 to-slate-900/60 border-amber-500/20'
      }`}
    >
      {reward.imageUrl ? (
        <img
          src={reward.imageUrl}
          alt={reward.title}
          className="w-16 h-16 shrink-0 rounded-xl object-cover ring-1 ring-slate-700/60"
        />
      ) : (
        <div className="w-16 h-16 shrink-0 rounded-xl bg-slate-800 flex items-center justify-center text-2xl ring-1 ring-slate-700/60">
          🎁
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <h4 className="font-black text-white text-sm leading-tight truncate">{reward.title}</h4>
        <p className="text-slate-400 text-[11px]">
          {recipientLabel ? `עבור ${recipientLabel}` : ''} · {Number(reward.targetAmount)} מטבעות
        </p>

        {isFulfilled ? (
          <p className="text-[10px] text-emerald-400 font-bold mt-1">
            ✅ סופק{reward.fulfilledBy ? ` על ידי ${reward.fulfilledBy.name}` : ''}
            {reward.fulfilledAt ? ` · ${new Date(reward.fulfilledAt).toLocaleDateString('he-IL')}` : ''}
          </p>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            disabled={disabled}
            className="mt-1 w-fit px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-[11px] shadow-lg shadow-amber-500/20 hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {actionLoading ? 'מעדכן...' : '👑 סיפקתי את הפרס לילד!'}
          </button>
        )}
      </div>
    </div>
  );
}
