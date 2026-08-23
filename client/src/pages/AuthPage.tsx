import React, { useState } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';
import { Link } from 'react-router-dom';
import type { SafeUser } from '../App';
import api from '../services/api';
import axios from 'axios';
import MessageBanner from '../components/MessageBanner';


interface AuthPageProps {
  onAuth: (token: string, user: SafeUser) => void;
}

// עמוד זה מטפל אך ורק ברישום הורה ראשי חדש. התחברות (הורים וילדים כאחד)
// עברה למסך /login הייעודי — כדי שקישורי הזמנה (?family=&username=) תמיד
// ינחתו על מסך התחברות בלבד, ולא ייתקלו בטופס "פתיחת משפחה" בטעות.
export default function AuthPage({ onAuth }: AuthPageProps): React.ReactNode {
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSignupChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSignupForm(prev => ({ ...prev, [name]: value }));
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

        {/* הוראות למשתמש חדש */}
        <div className="mb-6 p-3 bg-slate-800/40 rounded-xl ring-1 ring-slate-700/30 text-xs text-slate-300 leading-relaxed">
          <p>💡 <strong>הוראות להורים:</strong> אם זו הפעם הראשונה שלכם באפליקציה, מלאו את פרטיכם כאן כדי ליצור את חשבון המנהל. במסך הבא תוכלו להקים את הקבוצה המשפחתית שלכם ולקבל קוד משפחה לשיתוף עם הילדים.</p>
        </div>

        <main>
          {message && (
            <div className="mb-4">
              <MessageBanner type={message.type} text={message.text} onDismiss={() => setMessage(null)} />
            </div>
          )}

          {/* טופס הרשמה הורה */}
          <form onSubmit={handleSignupSubmit} className="flex flex-col gap-4 w-full" autoComplete="off">
            <div className="flex flex-col gap-1 w-full">
              <label className="text-slate-200 text-sm font-medium">שם מלא</label>
              <input
                name="name"
                autoComplete="off"
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
                autoComplete="off"
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
                autoComplete="new-password"
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

          <p className="mt-5 text-center text-xs text-slate-400">
            כבר חברים במשפחה?{' '}
            <Link to="/login" className="text-indigo-400 font-bold hover:text-indigo-300">
              התחברו כאן עם קוד המשפחה
            </Link>
          </p>
        </main>

      </div>
    </div>
  );
}
