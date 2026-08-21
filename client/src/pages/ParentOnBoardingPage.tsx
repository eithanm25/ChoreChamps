import React, { useState } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';
import axios from 'axios';
import api from '../services/api';
import type { SafeUser } from '../App';

interface OnboardingProps {
  onFamilyCreated: (user: SafeUser, token: string) => void;
  onLogout: () => void;
}

export default function ParentOnboardingPage({ onFamilyCreated, onLogout }: OnboardingProps): React.ReactNode {
  const [familyName, setFamilyName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFamilyName(e.target.value);
  };

  // פונקציית שליחת הנתונים לשרת - הקמת המשפחה
  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    if (!familyName.trim()) return;

    setLoading(true);
    try {
      // שליחת בקשת ה-POST לשרת. ה-api instance שלנו משרשר אוטומטית את ה-Token ב-Headers!
      const response = await api.post('/api/family/create', {
        familyName: familyName.trim(),
      });

      // השרת מחזיר את המידע על המשפחה וטוקן מעודכן שמכיל את ה-familyId החדש
      const { token, family } = response.data;

      // אנחנו צריכים לשלוף את ה-user הנוכחי מתוך ה-localStorage ולעדכן לו את ה-familyId
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const userObj = JSON.parse(savedUser) as SafeUser;
        userObj.familyId = family.id; // נועלים את ה-familyId החדש ביוזר

        // מעדכנים את ה-localStorage בטוקן החדש והיוזר המעודכן
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userObj));

        // מפעילים את הפונקציה שמעדכנת את הסטייט ב-App.tsx ומעבירה אותנו לדשבורד
        onFamilyCreated(userObj, token);
      }
    } catch (err: unknown) {
      let errorMessage = 'שגיאה בהקמת הקבוצה המשפחתית';
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-right" dir="rtl">
      <div className="w-full max-w-md bg-gradient-to-b from-slate-800/80 to-slate-900/80 rounded-2xl shadow-2xl ring-1 ring-slate-700 p-6">
        
        {/* כותרת הדף */}
        <header className="text-center mb-6">
          <div className="mx-auto w-20 h-20 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/10 ring-4 ring-slate-800">
            <span className="text-4xl">🏠</span>
          </div>
          <h1 className="mt-4 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 text-2xl font-black tracking-tight">
            הקמת קבוצה משפחתית
          </h1>
          <p className="mt-1 text-slate-400 text-sm font-medium">
            צעד אחד אחרון והאפליקציה מוכנה לפעולה!
          </p>
        </header>

        {/* הסבר קצר */}
        <div className="mb-6 p-4 bg-slate-800/40 rounded-xl ring-1 ring-slate-700/30 text-xs text-slate-300 leading-relaxed">
          <p>🌟 <strong>ברוכים הבאים ל-ChoreChamps!</strong> כדי שתוכלו לנהל משימות, להעניק דמי כיס ולצרף את הילדים, עליכם להגדיר תחילה את שם התא המשפחתי שלכם (לדוגמה: משפחת כהן, הבית של יוסי ומיכל).</p>
        </div>

        {/* הטופס המעוצב */}
        <main>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
            <div className="flex flex-col gap-1 w-full">
              <label className="text-slate-200 text-sm font-medium">שם המשפחה / שם הקבוצה</label>
              <input
                type="text"
                value={familyName}
                onChange={handleNameChange}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="לדוגמה: משפחת ישראלי"
                required
                disabled={loading}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading || !familyName.trim()}
              className="w-full py-2.5 mt-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold shadow-lg hover:from-indigo-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'מקים משפחה...' : 'אשר והקם משפחה חדשה'}
            </button>
          </form>
        </main>

        {/* כפתור התנתקות בתחתית */}
        <footer className="mt-6 pt-4 border-t border-slate-700/50 text-center">
          <button 
            onClick={onLogout} 
            className="text-xs text-slate-400 hover:text-red-400 transition-colors"
          >
            רוצה לצאת? התנתק מהחשבון
          </button>
        </footer>

      </div>
    </div>
  );
}
