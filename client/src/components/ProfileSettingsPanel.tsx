import React, { useState } from 'react';
import type { SyntheticEvent } from 'react';
import axios from 'axios';
import api from '../services/api';
import AvatarBadge from './AvatarBadge';
import { AVAILABLE_AVATARS } from '../data/avatars';
import type { SafeUser } from '../App';
import type { SubscriptionTier } from '../types/family';

interface ProfileSettingsPanelProps {
  user: SafeUser;
  familyCode: string | null;
  /** Parent only — omit for a child, which hides the upgrade CTA entirely regardless of anything else. */
  familyTier?: SubscriptionTier;
  onClose: () => void;
  /** Called once the avatar is already saved server-side — just patch local/App state. */
  onAvatarChange: (avatarUrl: string) => void;
  /** Parent only. */
  onOpenSubscription?: () => void;
}

/**
 * Universal profile settings — same component for parent and child, opened
 * from the avatar+name+gear anchor in both dashboards' headers. Password/PIN
 * change and the avatar picker apply to everyone; the subscription upgrade
 * CTA only ever renders when both `familyTier` and `onOpenSubscription` are
 * supplied, which the parent dashboard alone does — a child instance of this
 * panel structurally cannot show it.
 */
export default function ProfileSettingsPanel({
  user,
  familyCode,
  familyTier,
  onClose,
  onAvatarChange,
  onOpenSubscription,
}: ProfileSettingsPanelProps): React.ReactNode {
  const [savingAvatar, setSavingAvatar] = useState<string | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const isChild = user.role === 'child';
  const credentialLabel = isChild ? 'PIN' : 'סיסמה';
  const canChangeCredential = user.authProvider !== 'google';

  const handleAvatarPick = async (emoji: string) => {
    if (savingAvatar || emoji === user.avatarUrl) return;
    setSavingAvatar(emoji);
    try {
      await api.patch('/api/auth/avatar', { avatarUrl: emoji });
      onAvatarChange(emoji);
    } catch {
      // Best-effort — the picker just doesn't visually update if it failed; no need to block the rest of the panel over it.
    } finally {
      setSavingAvatar(null);
    }
  };

  const handlePasswordSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (passwordLoading) return;

    setPasswordLoading(true);
    setPasswordMessage(null);
    try {
      await api.post('/api/auth/change-password', { currentPassword, newPassword });
      setPasswordMessage({ type: 'success', text: isChild ? 'ה-PIN עודכן בהצלחה! 🎉' : 'הסיסמה עודכנה בהצלחה! 🎉' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: unknown) {
      let text = isChild ? 'שגיאה בעדכון ה-PIN' : 'שגיאה בעדכון הסיסמה';
      if (axios.isAxiosError(err)) {
        text = err.response?.data?.error || err.message;
      }
      setPasswordMessage({ type: 'error', text });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      dir="rtl"
    >
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          title="סגירה"
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-sm font-black transition-all"
        >
          ✕
        </button>

        <div className="flex flex-col items-center gap-2 pt-2">
          <AvatarBadge name={user.name} avatarUrl={user.avatarUrl} size="lg" />
          <h2 className="text-white font-black text-lg">{user.name}</h2>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {isChild ? '🏆 צ׳אמפ' : '👑 הורה מנהל'}
          </span>
        </div>

        {familyCode && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-emerald-300 text-xs font-bold">🆔 קוד המשפחה</span>
            <span className="font-mono tracking-widest text-emerald-200 text-sm">{familyCode}</span>
          </div>
        )}

        {/* 🛡️ בורר אווטאר */}
        <div className="flex flex-col gap-2">
          <span className="text-slate-300 text-sm font-bold">🛡️ בחרו אווטאר</span>
          <div className="grid grid-cols-6 gap-2">
            {AVAILABLE_AVATARS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleAvatarPick(emoji)}
                disabled={!!savingAvatar}
                title="בחרו אווטאר זה"
                className={`aspect-square rounded-xl flex items-center justify-center text-2xl transition-all ${
                  user.avatarUrl === emoji
                    ? 'bg-indigo-500/30 ring-2 ring-indigo-400 scale-105'
                    : 'bg-slate-800 hover:bg-slate-700 ring-1 ring-slate-700'
                } ${savingAvatar === emoji ? 'opacity-50' : ''} disabled:cursor-not-allowed`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* 🔒 עדכון סיסמה / PIN */}
        <div className="flex flex-col gap-2">
          {!canChangeCredential ? (
            <>
              <span className="text-slate-300 text-sm font-bold">🔒 עדכון {credentialLabel}</span>
              <p className="text-slate-500 text-xs bg-slate-800/50 rounded-lg px-3 py-2 leading-relaxed">
                מחוברים עם Google — אין סיסמה לניהול כאן, ההתחברות תמיד דרך כפתור ה-Google.
              </p>
            </>
          ) : !showPasswordForm ? (
            <div className="bg-slate-800/50 rounded-xl px-4 py-3 flex flex-col gap-2 items-center text-center">
              <p className="text-slate-300 text-sm font-bold leading-relaxed">
                {isChild
                  ? 'רוצה לשנות את הסיסמא שההורים נתנו לך לסיסמא משלך?'
                  : 'רוצה לשנות את הסיסמה שלך?'}
              </p>
              <button
                type="button"
                onClick={() => setShowPasswordForm(true)}
                className="px-5 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold shadow-lg hover:from-indigo-600 transition-all"
              >
                {isChild ? 'כן, שנה/י את ה-PIN' : 'כן, שנה/י סיסמה'}
              </button>
            </div>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-2">
              <span className="text-slate-300 text-sm font-bold">🔒 עדכון {credentialLabel}</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={`${credentialLabel} נוכחי/ת`}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm text-left"
                required
                autoFocus
                disabled={passwordLoading}
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={`${credentialLabel} חדש/ה`}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm text-left"
                required
                disabled={passwordLoading}
              />
              {passwordMessage && (
                <p className={`text-xs font-bold ${passwordMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {passwordMessage.text}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setPasswordMessage(null);
                  }}
                  disabled={passwordLoading}
                  className="px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all disabled:opacity-50"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex-1 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold shadow-lg hover:from-indigo-600 transition-all disabled:opacity-50"
                >
                  {passwordLoading ? 'מעדכן...' : `עדכון ${credentialLabel}`}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 👑 שדרוג מסלול — הורים בלבד, ורק כשעדיין ב-Free. ילדים לא רואים את זה בשום מקרה. */}
        {!isChild && familyTier === 'free' && onOpenSubscription && (
          <button
            type="button"
            onClick={onOpenSubscription}
            className="w-full py-3 rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-900 text-sm font-black shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition-all"
          >
            👑 שדרג מסלול משפחתי
          </button>
        )}
      </div>
    </div>
  );
}
