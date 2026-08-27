import React, { useState } from 'react';
import type { RewardDto } from '../types/reward';

interface RewardCardProps {
  reward: RewardDto;
  mode: 'child' | 'parent';
  /** Child mode only: the logged-in child's id, to tell "my individual reward" apart from a sibling's. */
  currentChildId?: string;
  /** Child mode only: spendable ChoreCoins right now. */
  currentBalance?: number;
  /** Child mode only: contribute (collaborative) or buy (individual, amount = full price). */
  onContribute?: (amount: number) => Promise<void>;
  /** Parent mode only. */
  onFulfill?: () => Promise<void>;
  /** Parent mode only. */
  onArchive?: () => Promise<void>;
  busy?: boolean;
}

const CATEGORY_BADGE: Record<RewardDto['category'], { label: string; className: string }> = {
  household: { label: '🏠 תגמול שווה מהבית', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  marketplace: { label: '🛒 חנות צעצועים וממתקים', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
};

export default function RewardCard({
  reward,
  mode,
  currentChildId,
  currentBalance,
  onContribute,
  onFulfill,
  onArchive,
  busy,
}: RewardCardProps): React.ReactNode {
  const [contributeAmount, setContributeAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const badge = CATEGORY_BADGE[reward.category];
  const isCollaborative = reward.type === 'collaborative';
  const isMine = reward.targetChild?.id === currentChildId;
  const targetAmountNum = Number(reward.targetAmount);
  const totalContributedNum = Number(reward.totalContributed);
  const remainingNum = Number(reward.remaining);

  const isActive = reward.status === 'active';
  const isCompleted = reward.status === 'completed';
  const isFulfilled = reward.status === 'fulfilled';

  const handleContribute = async (amount: number) => {
    if (!onContribute || actionLoading || amount <= 0) return;
    setActionLoading(true);
    try {
      await onContribute(amount);
      setContributeAmount('');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFulfill = async () => {
    if (!onFulfill || actionLoading) return;
    setActionLoading(true);
    try {
      await onFulfill();
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!onArchive || actionLoading) return;
    const confirmed = window.confirm(`לבטל את התגמול "${reward.title}"? כל התרומות שנצברו יוחזרו ליתרת הילדים.`);
    if (!confirmed) return;
    setActionLoading(true);
    try {
      await onArchive();
    } finally {
      setActionLoading(false);
    }
  };

  const disabled = busy || actionLoading;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 shadow-xl flex flex-col gap-3 transition-all ${
        isCollaborative
          ? 'bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-slate-900/60 border-indigo-500/30'
          : 'bg-slate-800/40 border-slate-700/50'
      }`}
    >
      {/* חגיגה: מומן במלואו, ממתין לאספקה */}
      {isCompleted && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm rounded-2xl">
          <div className="text-center px-4">
            <div className="text-3xl mb-1 animate-bounce">🎉</div>
            <p className="text-emerald-300 font-black text-sm">נרכש! ממתין לאספקת ההורים</p>
          </div>
        </div>
      )}
      {isFulfilled && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm rounded-2xl">
          <div className="text-center px-4">
            <div className="text-3xl mb-1">✅</div>
            <p className="text-slate-300 font-black text-sm">מומש בהצלחה!</p>
          </div>
        </div>
      )}

      <div className="flex justify-between items-start gap-2">
        <div className="flex gap-3 min-w-0">
          {reward.imageUrl && (
            <img
              src={reward.imageUrl}
              alt={reward.title}
              className="w-12 h-12 shrink-0 rounded-xl object-cover ring-1 ring-slate-700/60"
            />
          )}
          <div className="flex flex-col gap-1 min-w-0">
            <span className={`w-fit px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.className}`}>
              {badge.label}
            </span>
            <h3 className="font-black text-white text-sm leading-tight">{reward.title}</h3>
            {reward.description && <p className="text-slate-400 text-[11px] leading-relaxed">{reward.description}</p>}
          </div>
        </div>
        {isCollaborative && (
          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
            👥 יעד משותף
          </span>
        )}
      </div>

      {reward.category === 'marketplace' && reward.affiliateUrl && mode === 'parent' && (
        <a
          href={reward.affiliateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-indigo-400 hover:text-indigo-300 underline break-all"
        >
          🔗 קישור למוצר
        </a>
      )}

      {isCollaborative ? (
        <div className="flex flex-col gap-2">
          {/* פס התקדמות ניאון */}
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden ring-1 ring-slate-700/60">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-400 shadow-[0_0_10px_rgba(52,211,153,0.6)] transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, reward.progressPercent)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-300 font-semibold text-center">
            יעד: {targetAmountNum} מטבעות | הושקע עד כה: {totalContributedNum} מטבעות | נשארו עוד: {remainingNum} מטבעות
          </p>

          {reward.contributions.length > 0 && (
            <div className="flex flex-col gap-1 bg-slate-900/50 rounded-xl p-2.5 max-h-24 overflow-y-auto">
              {reward.contributions.map((c, idx) => (
                <p key={idx} className="text-[11px] text-slate-300">
                  <span className="font-bold text-emerald-400">{c.childName}</span> תרם/ה {Number(c.amount)} מטבעות! 🚀
                </p>
              ))}
            </div>
          )}

          {mode === 'child' && isActive && (
            <div className="flex gap-2 items-center mt-1">
              <input
                type="number"
                min={1}
                step="1"
                value={contributeAmount}
                onChange={(e) => setContributeAmount(e.target.value)}
                placeholder="כמה מטבעות?"
                disabled={disabled}
                className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-xs text-left font-mono"
              />
              <button
                type="button"
                onClick={() => handleContribute(Number(contributeAmount))}
                disabled={disabled || !contributeAmount || Number(contributeAmount) <= 0}
                className="shrink-0 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {actionLoading ? '...' : 'השקע במשפחה! 💰'}
              </button>
            </div>
          )}
          {mode === 'child' && typeof currentBalance === 'number' && isActive && (
            <p className="text-[10px] text-slate-500 text-center">💰 היתרה הפנויה שלך: {currentBalance} מטבעות</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-emerald-400">💰 עלות: {targetAmountNum} מטבעות</span>
            {mode === 'parent' && reward.targetChild && (
              <span className="text-slate-400 text-[11px]">👤 עבור {reward.targetChild.name}</span>
            )}
          </div>

          {mode === 'child' && isMine && isActive && (
            <>
              <button
                type="button"
                onClick={() => handleContribute(targetAmountNum)}
                disabled={disabled || (typeof currentBalance === 'number' && currentBalance < targetAmountNum)}
                className="w-full py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-xs shadow-lg shadow-amber-500/20 hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {actionLoading ? 'רוכש...' : 'רכוש פרס! 🎁'}
              </button>
              {typeof currentBalance === 'number' && currentBalance < targetAmountNum && (
                <p className="text-[10px] text-rose-400 text-center">חסרים לך {(targetAmountNum - currentBalance).toFixed(2)} מטבעות</p>
              )}
            </>
          )}
        </div>
      )}

      {mode === 'parent' && (isCompleted || isActive) && (
        <div className="flex gap-2 pt-2 border-t border-slate-700/40 mt-1">
          {isCompleted && (
            <button
              type="button"
              onClick={handleFulfill}
              disabled={disabled}
              className="flex-1 py-1.5 rounded-lg bg-emerald-500/90 hover:bg-emerald-600 text-white font-bold text-[11px] transition-all disabled:opacity-40"
            >
              ✅ סמן כמומש
            </button>
          )}
          <button
            type="button"
            onClick={handleArchive}
            disabled={disabled}
            className="flex-1 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold text-[11px] transition-all disabled:opacity-40"
          >
            🗑️ בטל תגמול
          </button>
        </div>
      )}
    </div>
  );
}
