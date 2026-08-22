import React, { useState } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';
import type { SafeUser } from '../App';
import api from '../services/api';
import axios from 'axios';
import MessageBanner from '../components/MessageBanner';


interface AuthPageProps {
  onAuth: (token: string, user: SafeUser) => void;
  prefilledId?: string | null;
}

// מעכשיו יש רק 2 מצבים בלבד במסך: רישום הורה ראשוני, או התחברות מאוחדת
type AuthView = 'signup' | 'login';

export default function AuthPage({ onAuth, prefilledId = null }: AuthPageProps): React.ReactNode {

  const lastLoginId = localStorage.getItem('lastLoginId');
  
  const finalLoginId = prefilledId || lastLoginId || '';

  const [view, setView] = useState<AuthView>(finalLoginId ? 'login' : 'signup');

  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [loginForm, setLoginForm] = useState({ loginId: finalLoginId, password: '' });

  const handleSignupChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSignupForm(prev => ({ ...prev, [name]: value }));
  };

  const handleLoginChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginForm(prev => ({ ...prev, [name]: value }));
  };

  // שליחת טופס הרשמה (הורים בלבד)
  async function handleSignupSubmit(e: SyntheticEvent) {
    e.preventDefault();
    try {
      const response = await api.post('/api/auth/signup', signupForm);
      const { token, user } = response.data;
      setMessage({ type: 'success', text: 'החשבון נוצר בהצלחה! מתחברים עכשיו...' });
      onAuth(token, user);
    } catch (err: unknown) {
      let errorMessage = 'שגיאה בתקשורת עם השרת';
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setMessage({ type: 'error', text: errorMessage });
    }
  }

  // שליחת טופס התחברות מאוחד (מזהה אוטומטית אם זה הורה או ילד)
  async function handleLoginSubmit(e: SyntheticEvent) {
    e.preventDefault();
    try {
      // בדיקה חכמה: אם המזהה מכיל את הסימן '@', זה כנראה אימייל של הורה
      const isEmail = loginForm.loginId.includes('@');
      
      let response;
      if (isEmail) {
        // התחברות הורה
        response = await api.post('/api/auth/login', {
          email: loginForm.loginId,
          password: loginForm.password
        });
      } else {
        // התחברות ילד (משתמש במזהה הפרופיל וה-PIN שקבעו לו)
        response = await api.post('/api/auth/profile-login', {
          userId: loginForm.loginId,
          password: loginForm.password
        });
      }

      const { token, user } = response.data;
      localStorage.setItem('lastLoginId', loginForm.loginId);
      setMessage({ type: 'success', text: 'התחברות בוצעה בהצלחה' });
      onAuth(token, user);
    } catch (err: unknown) {
      let errorMessage = 'פרטי התחברות, מזהה או קוד PIN שגויים. אנא נסו שוב.';
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setMessage({ type: 'error', text: errorMessage });
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-right" dir="rtl">
      <div className="w-full max-w-md bg-gradient-to-b from-slate-800/80 to-slate-900/80 rounded-2xl shadow-2xl ring-1 ring-slate-700 p-6">
        
        {/* לוגו כותרת */}
        <header className="text-center mb-6">
          <div className="mx-auto w-20 h-20 bg-gradient-to-tr from-amber-400 via-yellow-400 to-amber-500 rounded-2xl flex items-center justify-center shadow-xl shadow-amber-500/10 ring-4 ring-slate-800">
            <span className="text-4xl">🏆</span>
          </div>
          <h1 className="mt-4 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-indigo-400 text-3xl font-black tracking-tight">
            ChoreChamps
          </h1>
          <p className="mt-1 text-slate-400 text-sm font-medium">
            הופכים מטלות לפרסים משפחתיים
          </p>
        </header>

        {/* בורר מצבים אחיד וברור - כמו אפליקציה אמיתית */}
        <nav className="mb-4 bg-slate-800/60 p-1 rounded-full ring-1 ring-slate-700/60">
          <div className="flex gap-1 justify-center">
            <button
              onClick={() => setView('signup')}
              className={`flex-1 py-2 rounded-full text-sm font-bold transition-all duration-150 ${
                view === 'signup'
                  ? 'bg-indigo-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              משתמש חדש? פתח משפחה
            </button>
            <button
              onClick={() => setView('login')}
              className={`flex-1 py-2 rounded-full text-sm font-bold transition-all duration-150 ${
                view === 'login'
                  ? 'bg-indigo-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              כבר חבר? כנס לחשבון
            </button>
          </div>
        </nav>

        {/* הוראות דינמיות ומפורטות למשתמש לפי המצב הנבחר */}
        <div className="mb-6 p-3 bg-slate-800/40 rounded-xl ring-1 ring-slate-700/30 text-xs text-slate-300 leading-relaxed">
          {view === 'signup' ? (
            <p>💡 <strong>הוראות להורים:</strong> אם זו הפעם הראשונה שלכם באפליקציה, מלאו את פרטיכם כאן כדי ליצור את חשבון המנהל. במסך הבא תוכלו להקים את הקבוצה המשפחתיות שלכם ולייצר קישורי כניסה קלים לילדים.</p>
          ) : (
            <p>💡 <strong>הוראות כניסה לכולם:</strong> הורים – התחברו באמצעות כתובת האימייל והסיסמה שלכם. ילדים – הדביקו בשדה הראשון את מזהה הפרופיל הארוך שקיבלתם מאבא או אמא, והקישו את קוד ה-PIN שלכם.</p>
          )}
        </div>

        <main>
          {message && (
            <div className="mb-4">
              <MessageBanner type={message.type} text={message.text} onDismiss={() => setMessage(null)} />
            </div>
          )}

          {/* טופס הרשמה הורה */}
          {view === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="flex flex-col gap-4 w-full">
              <div className="flex flex-col gap-1 w-full">
                <label className="text-slate-200 text-sm font-medium">שם מלא</label>
                <input
                  name="name"
                  value={signupForm.name}
                  onChange={handleSignupChange}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="הקלד את שמך (למשל: אבא יוסי)"
                  required
                />
              </div>

              <div className="flex flex-col gap-1 w-full">
                <label className="text-slate-200 text-sm font-medium">כתובת אימייל</label>
                <input
                  name="email"
                  type="email"
                  value={signupForm.email}
                  onChange={handleSignupChange}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-left"
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div className="flex flex-col gap-1 w-full">
                <label className="text-slate-200 text-sm font-medium">סיסמה לחשבון</label>
                <input
                  name="password"
                  type="password"
                  value={signupForm.password}
                  onChange={handleSignupChange}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-left"
                  placeholder="בחר סיסמה מאובטחת"
                  required
                />
              </div>

              <button type="submit" className="w-full py-2.5 mt-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold shadow-lg hover:from-indigo-600 hover:to-violet-600 transition-all">
                צור חשבון הורה והקם משפחה
              </button>
            </form>
          )}

          {/* טופס התחברות מאוחד (הורים וילדים ביחד) */}
          {view === 'login' && (
            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4 w-full">
              <div className="flex flex-col gap-1 w-full">
                <label className="text-slate-200 text-sm font-medium">אימייל (להורים) או מזהה משתמש (לילדים)</label>
                <input
                  name="loginId"
                  value={loginForm.loginId}
                  onChange={handleLoginChange}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-left"
                  placeholder="הזן אימייל או מזהה פרופיל"
                  required
                />
              </div>

              <div className="flex flex-col gap-1 w-full">
                <label className="text-slate-200 text-sm font-medium">סיסמה או PIN סודי</label>
                <input
                  name="password"
                  type="password"
                  value={loginForm.password}
                  onChange={handleLoginChange}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-left"
                  placeholder="הכנס סיסמה או קוד"
                  required
                />
              </div>

              <button type="submit" className="w-full py-2.5 mt-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold shadow-lg hover:from-emerald-600 hover:to-teal-600 transition-all">
                התחבר לאפליקציה
              </button>
            </form>
          )}
        </main>

      </div>
    </div>
  );
}
