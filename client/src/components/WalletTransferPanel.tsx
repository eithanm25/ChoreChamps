import React, { useState } from 'react';
import type { SyntheticEvent } from 'react';
import axios from 'axios';
import api from '../services/api';

export interface WalletCandidate {
  id: string;
  name: string;
  balance?: number;
}

interface WalletTransferPanelProps {
  /** The logged-in child sending coins — always the implicit source, never a picker. */
  currentUserId: string;
  /** Every sibling eligible as a transfer target (the sender is filtered out by the caller or here). */
  children: WalletCandidate[];
  /** Called after a confirmed, successful transfer — patch local balances optimistically. */
  onTransferComplete?: (patch: { childId: string; newBalance: number }[]) => void;
}

type Step = 'select' | 'details' | 'password' | 'success';

/** One circular avatar-style selector button — the "Bit" pick-a-contact look. */
function ContactCircle({
  name,
  balance,
  selected,
  onClick,
}: {
  name: string;
  balance?: number;
  selected: boolean;
  onClick: () => void;
}): React.ReactNode {
  const initial = name.trim().charAt(0) || '?';
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5 shrink-0 group">
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-black shadow-lg transition-all ${
          selected
            ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white ring-4 ring-indigo-400/40 scale-105'
            : 'bg-slate-800 text-slate-300 ring-2 ring-slate-700 group-hover:ring-indigo-500/50'
        }`}
      >
        {initial}
      </div>
      <span className={`text-[11px] font-bold ${selected ? 'text-indigo-300' : 'text-slate-400'}`}>{name}</span>
      {typeof balance === 'number' && <span className="text-[9px] text-slate-500">{balance} 🪙</span>}
    </button>
  );
}

/**
 * "Bit"-style peer-to-peer wallet transfer wizard — Academy tier only, child
 * side. Step 1: pick a sibling. Step 2: amount + mandatory reason. Step 3:
 * re-enter password as a security gate (POST /api/auth/verify-password)
 * before the real transfer (POST /api/wallet/transfer-sibling) fires.
 */
export default function WalletTransferPanel({ currentUserId, children, onTransferComplete }: WalletTransferPanelProps): React.ReactNode {
  const [step, setStep] = useState<Step>('select');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const targetCandidates = children.filter((c) => c.id !== currentUserId);
  const targetChild = children.find((c) => c.id === targetId) ?? null;

  const reset = () => {
    setStep('select');
    setTargetId(null);
    setAmount('');
    setReason('');
    setPassword('');
    setError(null);
  };

  const handleDetailsSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError('סכום ההעברה חייב להיות מספר חיובי');
      return;
    }
    if (!reason.trim()) {
      setError('חובה לציין סיבה להעברה');
      return;
    }
    setError(null);
    setStep('password');
  };

  const handleConfirmTransfer = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!targetId) return;

    setSubmitting(true);
    setError(null);
    try {
      // Step 3 security gate: re-verify the caller's own password before the
      // real money movement fires — a wrong password never reaches the
      // transfer endpoint at all.
      await api.post('/api/auth/verify-password', { password });

      const response = await api.post('/api/wallet/transfer-sibling', {
        sourceChildId: currentUserId,
        targetChildId: targetId,
        amount: Number(amount),
        reason: reason.trim(),
      });

      onTransferComplete?.([
        { childId: currentUserId, newBalance: Number(response.data.newSourceBalance) },
        { childId: targetId, newBalance: Number(response.data.newTargetBalance) },
      ]);

      setStep('success');
    } catch (err: unknown) {
      let message = 'שגיאה בביצוע ההעברה';
      if (axios.isAxiosError(err)) {
        message = err.response?.data?.error || err.message;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-gradient-to-b from-indigo-950/30 to-slate-900/60 border border-indigo-500/20 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      <h3 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 flex items-center gap-2">
        <span>💸</span> העברת מטבעות לאח/אחות
      </h3>

      {error && step !== 'password' && step !== 'details' && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold px-3 py-2 rounded-xl">{error}</div>
      )}

      {/* שלב 1: בחירת יעד */}
      {step === 'select' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-slate-400 text-xs font-bold">למי מעבירים?</span>
            <div className="flex gap-3 overflow-x-auto py-1">
              {targetCandidates.map((c) => (
                <ContactCircle key={c.id} name={c.name} balance={c.balance} selected={targetId === c.id} onClick={() => setTargetId(c.id)} />
              ))}
            </div>
            {targetCandidates.length === 0 && (
              <p className="text-slate-500 text-xs text-center py-4">אין עדיין אח/אחות אחר/ת במשפחה להעביר אליו/ה מטבעות.</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setStep('details')}
            disabled={!targetId}
            className="w-full py-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-bold shadow-lg hover:from-indigo-600 hover:to-violet-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            המשך ➜
          </button>
        </div>
      )}

      {/* שלב 2: סכום וסיבה */}
      {step === 'details' && (
        <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-3">
          <div className="flex items-center justify-center py-2">
            <ContactCircle name={targetChild?.name ?? '?'} selected={false} onClick={() => {}} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-slate-200 text-sm font-medium">💰 סכום המטבעות</label>
            <input
              type="number"
              min={1}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="לדוגמה: 50"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-2xl font-black text-center"
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-slate-200 text-sm font-medium">✍️ סיבת ההעברה (חובה)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder='לדוגמה: "הלוואה לקניית לגו", "בונוס יום הולדת"'
              className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
              required
            />
          </div>

          {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold px-3 py-2 rounded-xl">{error}</div>}

          <div className="flex gap-2 mt-1">
            <button type="button" onClick={() => setStep('select')} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-full font-bold text-xs">
              חזרה
            </button>
            <button type="submit" className="flex-1 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-bold shadow-lg hover:from-indigo-600 transition-all">
              המשך לאבטחה 🔒
            </button>
          </div>
        </form>
      )}

      {/* שלב 3: שער אבטחה — אימות סיסמה */}
      {step === 'password' && (
        <form onSubmit={handleConfirmTransfer} className="flex flex-col gap-3">
          <div className="bg-slate-900/60 border border-indigo-500/20 rounded-xl p-3 text-center flex flex-col gap-1">
            <span className="text-slate-400 text-[11px]">מעבירים</span>
            <span className="text-xl font-black text-indigo-300">{amount} מטבעות</span>
            <span className="text-slate-400 text-[11px]">אל {targetChild?.name}</span>
            <span className="text-slate-500 text-[10px] italic">"{reason.trim()}"</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-slate-200 text-sm font-medium">🔒 אבטחה מוגברת: אנא הקלד את הסיסמה האישית שלך כדי לאשר את ההעברה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="הסיסמה שלך"
              className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm text-left"
              required
              autoFocus
            />
          </div>

          {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold px-3 py-2 rounded-xl">{error}</div>}

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => {
                setStep('details');
                setError(null);
              }}
              disabled={submitting}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-full font-bold text-xs disabled:opacity-40"
            >
              חזרה
            </button>
            <button
              type="submit"
              disabled={submitting || !password}
              className="flex-1 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold shadow-lg hover:from-emerald-600 transition-all disabled:opacity-40"
            >
              {submitting ? 'מאשר...' : 'אשר/י והעבר/י 💸'}
            </button>
          </div>
        </form>
      )}

      {/* שלב 4: הצלחה */}
      {step === 'success' && (
        <div className="flex flex-col items-center gap-3 py-4 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-3xl animate-bounce">
            ✅
          </div>
          <p className="text-emerald-400 font-black text-sm">ההעברה בוצעה בהצלחה!</p>
          <p className="text-slate-400 text-xs text-center">
            {amount} מטבעות עברו אל {targetChild?.name} 🎉
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-1 px-5 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
          >
            העברה נוספת
          </button>
        </div>
      )}
    </div>
  );
}
