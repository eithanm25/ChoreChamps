import React, { useState } from 'react';
import type { SyntheticEvent } from 'react';
import axios from 'axios';
import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import api from '../services/api';

export interface ChildCandidate {
  id: string;
  name: string;
  balance?: number;
}

interface ParentCoinAdjustPanelProps {
  children: ChildCandidate[];
  /**
   * A parent who signed in with Google has no password they actually know —
   * signup gives Google accounts a random, unrecoverable placeholder password
   * specifically so password login is disabled on them (see the server's
   * AuthProvider docstring). For those parents the security gate has to
   * re-verify via Google instead of asking for a password they can never
   * provide.
   */
  authProvider?: 'password' | 'google';
  /** Called after a confirmed, successful give/take — patch the local balance optimistically. */
  onAdjustComplete?: (childId: string, newBalance: number) => void;
}

type Step = 'select' | 'details' | 'password' | 'success';
type Action = 'give' | 'take';

function ChildCircle({
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
            ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white ring-4 ring-amber-400/40 scale-105'
            : 'bg-slate-800 text-slate-300 ring-2 ring-slate-700 group-hover:ring-amber-500/50'
        }`}
      >
        {initial}
      </div>
      <span className={`text-[11px] font-bold ${selected ? 'text-amber-300' : 'text-slate-400'}`}>{name}</span>
      {typeof balance === 'number' && <span className="text-[9px] text-slate-500">{balance} 🪙</span>}
    </button>
  );
}

/**
 * Parent's direct wallet control — Academy tier only. Unlike
 * WalletTransferPanel (a sibling-to-sibling transfer), this never debits a
 * "parent balance" (parents have no ChildProfile/wallet at all): 'give'
 * credits the chosen child from nowhere in particular (an allowance top-up or
 * reward), 'take' debits them (a behavioral fine), same password-gated flow.
 */
export default function ParentCoinAdjustPanel({ children, authProvider, onAdjustComplete }: ParentCoinAdjustPanelProps): React.ReactNode {
  const [step, setStep] = useState<Step>('select');
  const [childId, setChildId] = useState<string | null>(null);
  const [action, setAction] = useState<Action>('give');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const child = children.find((c) => c.id === childId) ?? null;

  const reset = () => {
    setStep('select');
    setChildId(null);
    setAction('give');
    setAmount('');
    setReason('');
    setPassword('');
    setError(null);
  };

  const handleDetailsSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError('הסכום חייב להיות מספר חיובי');
      return;
    }
    if (!reason.trim()) {
      setError('חובה לציין סיבה');
      return;
    }
    setError(null);
    setStep('password');
  };

  /** Runs the shared verify-then-adjust flow once the caller has proven who they are, one way or another. */
  const runAdjust = async (verify: () => Promise<void>) => {
    if (!childId) return;

    setSubmitting(true);
    setError(null);
    try {
      await verify();

      const response = await api.post('/api/wallet/parent-adjust', {
        childId,
        action,
        amount: Number(amount),
        reason: reason.trim(),
      });

      onAdjustComplete?.(childId, Number(response.data.newBalance));
      setStep('success');
    } catch (err: unknown) {
      let message = 'שגיאה בביצוע הפעולה';
      if (axios.isAxiosError(err)) {
        message = err.response?.data?.error || err.message;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmWithPassword = (e: SyntheticEvent) => {
    e.preventDefault();
    runAdjust(() => api.post('/api/auth/verify-password', { password }).then(() => undefined));
  };

  const handleConfirmWithGoogle = (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setError('לא התקבל אישור מ-Google, נסו שוב');
      return;
    }
    runAdjust(() =>
      api.post('/api/auth/verify-google', { credentialToken: credentialResponse.credential }).then(() => undefined),
    );
  };

  return (
    <div className="bg-gradient-to-b from-amber-950/20 to-slate-900/60 border border-amber-500/20 rounded-2xl p-5 shadow-xl flex flex-col gap-4 max-w-xl">
      <h3 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400 flex items-center gap-2">
        <span>💸</span> העברת כספים לילד/ה
      </h3>
      <p className="text-slate-500 text-[11px] leading-relaxed -mt-2">
        זכו את הילד/ה במטבעות כבונוס או דמי כיס, או נכו מטבעות כקנס על התנהגות — הכל בלחיצה אחת ובאישור סיסמה.
      </p>

      {error && step !== 'password' && step !== 'details' && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold px-3 py-2 rounded-xl">{error}</div>
      )}

      {/* שלב 1: בחירת ילד/ה */}
      {step === 'select' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-slate-400 text-xs font-bold">בחרו ילד/ה:</span>
            <div className="flex gap-3 overflow-x-auto py-1">
              {children.map((c) => (
                <ChildCircle key={c.id} name={c.name} balance={c.balance} selected={childId === c.id} onClick={() => setChildId(c.id)} />
              ))}
            </div>
            {children.length === 0 && <p className="text-slate-500 text-xs text-center py-4">אין עדיין ילדים רשומים במשפחה.</p>}
          </div>

          <button
            type="button"
            onClick={() => setStep('details')}
            disabled={!childId}
            className="w-full py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold shadow-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            המשך ➜
          </button>
        </div>
      )}

      {/* שלב 2: פעולה, סכום וסיבה */}
      {step === 'details' && (
        <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-3">
          <div className="flex items-center justify-center py-2">
            <ChildCircle name={child?.name ?? '?'} selected={false} onClick={() => {}} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAction('give')}
              className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                action === 'give' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              🎁 תן מטבעות
            </button>
            <button
              type="button"
              onClick={() => setAction('take')}
              className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                action === 'take' ? 'bg-rose-500 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              ⚠️ קנס / הפחתה
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-slate-200 text-sm font-medium">💰 סכום המטבעות</label>
            <input
              type="number"
              min={1}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="לדוגמה: 20"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 text-2xl font-black text-center"
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-slate-200 text-sm font-medium">✍️ סיבה (חובה)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder='לדוגמה: "בונוס יום הולדת", "קנס על התנהגות"'
              className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
              required
            />
          </div>

          {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold px-3 py-2 rounded-xl">{error}</div>}

          <div className="flex gap-2 mt-1">
            <button type="button" onClick={() => setStep('select')} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-full font-bold text-xs">
              חזרה
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold shadow-lg hover:from-amber-600 transition-all"
            >
              המשך לאבטחה 🔒
            </button>
          </div>
        </form>
      )}

      {/* שלב 3: שער אבטחה — אימות סיסמה, או Google עבור הורים שנרשמו עם Google */}
      {step === 'password' && (
        <div className="flex flex-col gap-3">
          <div className="bg-slate-900/60 border border-amber-500/20 rounded-xl p-3 text-center flex flex-col gap-1">
            <span className="text-slate-400 text-[11px]">{action === 'give' ? 'מזכים את' : 'מנכים מ'}</span>
            <span className="text-xl font-black text-amber-300">
              {child?.name} · {amount} מטבעות
            </span>
            <span className="text-slate-500 text-[10px] italic">"{reason.trim()}"</span>
          </div>

          {authProvider === 'google' ? (
            <div className="flex flex-col gap-2 items-center">
              <label className="text-slate-200 text-sm font-medium text-center">
                🔒 אבטחה מוגברת: אשרו את זהותכם דרך Google כדי לאשר את הפעולה
              </label>
              {submitting ? (
                <p className="text-slate-400 text-xs">מאשר...</p>
              ) : (
                <GoogleLogin
                  onSuccess={handleConfirmWithGoogle}
                  onError={() => setError('אימות Google נכשל, נסו שוב')}
                  theme="filled_black"
                  shape="pill"
                  text="continue_with"
                />
              )}
            </div>
          ) : (
            <form onSubmit={handleConfirmWithPassword} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-slate-200 text-sm font-medium">🔒 אבטחה מוגברת: אנא הקלד את הסיסמה האישית שלך כדי לאשר את הפעולה</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="הסיסמה שלך"
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm text-left"
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !password}
                className="w-full py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold shadow-lg hover:from-emerald-600 transition-all disabled:opacity-40"
              >
                {submitting ? 'מאשר...' : 'אשר/י פעולה 💸'}
              </button>
            </form>
          )}

          {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold px-3 py-2 rounded-xl">{error}</div>}

          <button
            type="button"
            onClick={() => {
              setStep('details');
              setError(null);
            }}
            disabled={submitting}
            className="px-4 py-2 bg-slate-800 text-slate-300 rounded-full font-bold text-xs disabled:opacity-40 self-start"
          >
            חזרה
          </button>
        </div>
      )}

      {/* שלב 4: הצלחה */}
      {step === 'success' && (
        <div className="flex flex-col items-center gap-3 py-4 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-3xl animate-bounce">
            ✅
          </div>
          <p className="text-emerald-400 font-black text-sm">הפעולה בוצעה בהצלחה!</p>
          <p className="text-slate-400 text-xs text-center">
            {action === 'give' ? `${amount} מטבעות נוספו ל${child?.name}` : `${amount} מטבעות הופחתו מ${child?.name}`} 🎉
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-1 px-5 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
          >
            פעולה נוספת
          </button>
        </div>
      )}
    </div>
  );
}
