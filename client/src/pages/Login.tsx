import React, { useState } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import api from '../services/api';
import type { SafeUser } from '../App';
import MessageBanner from '../components/MessageBanner';
import GoogleAuthButton from '../components/GoogleAuthButton';

interface LoginProps {
  onAuth: (token: string, user: SafeUser) => void;
}

type LoginMode = 'family' | 'parent-email';

/**
 * Device-agnostic household login — two tabs:
 *   - 'family': children only, via familyCode + name + PIN.
 *   - 'parent-email': every parent, primary or co-, via email/password or Google
 *     (identical for both — a co-parent has no separate login path once their
 *     account exists; only /signup?inviteCode=... distinguishes how they joined).
 *
 * Reads ?family=CODE&username=NAME from the URL (the shape a child's invite
 * link uses) and pre-fills the family-code form — but both fields stay fully
 * editable, so a child on a friend's phone/school computer/new tablet can
 * clear them and log into a different account instead of being stuck with
 * whatever the link was for. Nothing here is a UUID or a saved per-device
 * token: family code + name + PIN is the whole identity, memorizable and
 * portable across any device.
 */
export default function Login({ onAuth }: LoginProps): React.ReactNode {
  const queryParams = new URLSearchParams(window.location.search);
  const prefilledFamilyCode = queryParams.get('family') ?? '';
  const prefilledUsername = queryParams.get('username') ?? '';

  const rememberedFamilyCode = localStorage.getItem('lastFamilyCode') ?? '';
  const rememberedUsername = localStorage.getItem('lastUsername') ?? '';

  const [mode, setMode] = useState<LoginMode>('family');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const [familyForm, setFamilyForm] = useState({
    familyCode: prefilledFamilyCode || rememberedFamilyCode,
    username: prefilledUsername || rememberedUsername,
    password: '',
  });
  const [parentForm, setParentForm] = useState({ email: '', password: '' });

  const handleFamilyChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFamilyForm(prev => ({ ...prev, [name]: value }));
  };

  const handleParentChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setParentForm(prev => ({ ...prev, [name]: value }));
  };

  // התחברות עם קוד משפחה + שם — ילדים והורים נוספים, מכל מכשיר
  async function handleFamilyLoginSubmit(e: SyntheticEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      const response = await api.post('/api/auth/profile-login', {
        familyCode: familyForm.familyCode.trim(),
        username: familyForm.username.trim(),
        password: familyForm.password,
      });

      const { token, user } = response.data;
      localStorage.setItem('lastFamilyCode', familyForm.familyCode.trim());
      localStorage.setItem('lastUsername', familyForm.username.trim());
      setMessage({ type: 'success', text: 'התחברות בוצעה בהצלחה 🎉' });
      onAuth(token, user);
    } catch (err: unknown) {
      let errorMessage = 'קוד המשפחה, השם או ה-PIN שגויים. נסו שוב.';
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  }

  // התחברות הורה ראשי עם אימייל וסיסמה
  async function handleParentLoginSubmit(e: SyntheticEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', {
        email: parentForm.email.trim(),
        password: parentForm.password,
      });

      const { token, user } = response.data;
      setMessage({ type: 'success', text: 'התחברות בוצעה בהצלחה 🎉' });
      onAuth(token, user);
    } catch (err: unknown) {
      let errorMessage = 'אימייל או סיסמה שגויים. נסו שוב.';
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-right" dir="rtl">
      <div className="w-full max-w-md bg-gradient-to-b from-slate-800/80 to-slate-900/80 rounded-2xl shadow-2xl ring-1 ring-slate-700 p-6">

        {/* לוגו כותרת */}
        <header className="text-center mb-6">
          <div className="mx-auto w-20 h-20 bg-gradient-to-tr from-emerald-400 via-teal-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/10 ring-4 ring-slate-800">
            <span className="text-4xl">🏆</span>
          </div>
          <h1 className="mt-4 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 text-3xl font-black tracking-tight">
            ChoreChamps
          </h1>
          <p className="mt-1 text-slate-400 text-sm font-medium">
            כניסה לקבוצה המשפחתית שלכם
          </p>
        </header>

        {/* בורר מצב התחברות */}
        <nav className="mb-5 bg-slate-800/60 p-1 rounded-full ring-1 ring-slate-700/60">
          <div className="flex gap-1 justify-center">
            <button
              type="button"
              onClick={() => setMode('family')}
              className={`flex-1 py-2 rounded-full text-sm font-bold transition-all duration-150 ${
                mode === 'family' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🏆 צ׳אמפ
            </button>
            <button
              type="button"
              onClick={() => setMode('parent-email')}
              className={`flex-1 py-2 rounded-full text-sm font-bold transition-all duration-150 ${
                mode === 'parent-email' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              👑 הורים
            </button>
          </div>
        </nav>

        <div className="mb-6 p-3 bg-slate-800/40 rounded-xl ring-1 ring-slate-700/30 text-xs text-slate-300 leading-relaxed">
          {mode === 'family' ? (
            <p>💡 <strong>כניסה מכל מכשיר:</strong> הקלידו את קוד המשפחה בן 4 הספרות ואת השם הפרטי שלכם, בדיוק כפי שאבא/אמא הגדירו — ורק את ה-PIN הסודי צריך לזכור בעל פה. עובד גם על טלפון של חבר, מחשב בבית ספר, או כל מכשיר אחר.</p>
          ) : (
            <p>💡 <strong>הורים:</strong> נרשמתם עם Google? השתמשו תמיד בכפתור ה-Google למטה — לחשבון כזה אין סיסמה שאפשר להקליד, גם לא הסיסמה של חשבון ה-Gmail עצמו. נרשמתם עם אימייל וסיסמה? השתמשו באותם פרטים כאן.</p>
          )}
        </div>

        <main>
          {message && (
            <div className="mb-4">
              <MessageBanner type={message.type} text={message.text} onDismiss={() => setMessage(null)} />
            </div>
          )}

          {/* טופס התחברות עם קוד משפחה — ילדים בלבד (הורים, גם נוספים, מתחברים בטאב "הורים") */}
          {mode === 'family' && (
            <form onSubmit={handleFamilyLoginSubmit} className="flex flex-col gap-4 w-full" autoComplete="off">
              <div className="flex flex-col gap-1 w-full">
                <label className="text-slate-200 text-sm font-medium">🏡 קוד משפחה</label>
                <input
                  name="familyCode"
                  autoComplete="off"
                  value={familyForm.familyCode}
                  onChange={handleFamilyChange}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-left font-mono tracking-widest text-lg"
                  placeholder="4092"
                  inputMode="numeric"
                  required
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col gap-1 w-full">
                <label className="text-slate-200 text-sm font-medium">👤 שם פרטי</label>
                <input
                  name="username"
                  autoComplete="off"
                  value={familyForm.username}
                  onChange={handleFamilyChange}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="לדוגמה: נועם"
                  required
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col gap-1 w-full">
                <label className="text-slate-200 text-sm font-medium">🔒 קוד PIN סודי</label>
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={familyForm.password}
                  onChange={handleFamilyChange}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-left font-mono"
                  placeholder="הקישו את ה-PIN שלכם"
                  required
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold shadow-lg hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50"
              >
                {loading ? 'מתחברים...' : 'כניסה לחשבון שלי 🚀'}
              </button>
            </form>
          )}

          {/* טופס התחברות הורה ראשי */}
          {mode === 'parent-email' && (
            <>
              <div className="mb-5 flex flex-col gap-3">
                <GoogleAuthButton onAuth={onAuth} onError={(text) => setMessage({ type: 'error', text })} mode="login" />
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-700/60" />
                  <span className="text-[11px] text-slate-500 font-medium">או עם אימייל וסיסמה</span>
                  <div className="h-px flex-1 bg-slate-700/60" />
                </div>
              </div>

            <form onSubmit={handleParentLoginSubmit} className="flex flex-col gap-4 w-full" autoComplete="off">
              <div className="flex flex-col gap-1 w-full">
                <label className="text-slate-200 text-sm font-medium">כתובת אימייל</label>
                <input
                  name="email"
                  type="email"
                  autoComplete="off"
                  value={parentForm.email}
                  onChange={handleParentChange}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-left"
                  placeholder="name@example.com"
                  required
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col gap-1 w-full">
                <label className="text-slate-200 text-sm font-medium">סיסמה</label>
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={parentForm.password}
                  onChange={handleParentChange}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-left"
                  placeholder="הכנס סיסמה"
                  required
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold shadow-lg hover:from-indigo-600 hover:to-violet-600 transition-all disabled:opacity-50"
              >
                {loading ? 'מתחברים...' : 'התחבר לאפליקציה'}
              </button>
            </form>
            </>
          )}

          <p className="mt-5 text-center text-xs text-slate-400">
            עוד לא פתחתם משפחה?{' '}
            <Link to="/" className="text-indigo-400 font-bold hover:text-indigo-300">
              הרשמה כהורה ראשי
            </Link>
          </p>
        </main>

      </div>
    </div>
  );
}
