import React, { useState, useEffect } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';
import axios from 'axios';
import api from '../services/api';
import type { SafeUser } from '../App';

interface DashboardProps {
  user: SafeUser; // נשתמש בו כעת בתוך הכותרת כדי לפתור את שגיאת ה-ESLint!
  onLogout: () => void;
}

interface FamilyMember {
  id: string;
  name: string;
  role: 'parent' | 'child';
  email?: string;
  familyName: string;
  totalTasksUploaded?: number;
  lifetimeTasksCount?: number;
  lifetimeEarnings?: number;
}

export default function ParentDashboard({ user, onLogout }: DashboardProps): React.ReactNode {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  // מצב עבור טופס הוספת בן משפחה
  const [form, setForm] = useState({ name: '', password: '', role: 'child' as 'parent' | 'child' });
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', basePrice: '', maxBonusPrice: '' , assignedToId: ''});
  const [taskLoading, setTaskLoading] = useState(false);

  // שליפת חברי המשפחה מהשרת
  useEffect(() => {
    const fetchFamilyMembers = async () => {
      try {
        const response = await api.get('/api/tasks/family-members');
        setMembers(response.data.members || []);
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          console.error(err.response?.data?.error || err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchFamilyMembers();
  }, []);

  const refreshMembers = async () => {
    try {
      const response = await api.get('/api/tasks/family-members');
      setMembers(response.data.members || []);
    } catch (err: unknown) {
      console.error(err);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // טופס המשימה כולל גם textarea לתיאור, ולכן הטיפוס רחב יותר מ-handleInputChange
  const handleTaskInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTaskForm(prev => ({ ...prev, [name]: value }));
  };

  // הוספת חבר משפחה חדש (אמא או ילד)
  async function handleAddMember(e: SyntheticEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.password) return;

    setFormLoading(true);
    setInviteLink(null);
    try {
      const endpoint = form.role === 'child' ? '/api/family/add-child' : '/api/family/add-co-parent';
      const response = await api.post(endpoint, {
        name: form.name.trim(),
        password: form.password,
      });

      if (response.data.uniqueLink) {
        setInviteLink(response.data.uniqueLink);
      }

      setForm({ name: '', password: '', role: 'child' });
      await refreshMembers();
    } catch (err: unknown) {
      let errorMessage = 'שגיאה בהוספת בן משפחה';
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || err.message;
      }
      alert(errorMessage);
    } finally {
      setFormLoading(false);
    }
  }

  async function handleCreateTask(e: SyntheticEvent) {
    e.preventDefault();
    const { title, description, basePrice, maxBonusPrice } = taskForm;
    if (!title.trim() || !basePrice || !maxBonusPrice) return;

    setTaskLoading(true);
    try {
      // שליחת המשימה החדשה לשרת
      await api.post('/api/tasks', {
        title: title.trim(),
        description: description.trim(),
        basePrice: Number(basePrice),
        maxBonusPrice: Number(maxBonusPrice),
        assignedToId: taskForm.assignedToId || null, // אם לא נבחר ילד ספציפי, נשלח null
      });

      setSuccessMessage(`המשימה: "${title.trim()}" פורסמה בהצלחה ללוח הביתי! 🎉`);
      
      // העלמה אוטומטית של ההודעה מהמסך אחרי 4 שניות
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
      
      // איפוס הטופס ורענון רשימת המשפחה (כדי לעדכן את כמות המשימות שההורה העלה)
      setTaskForm({ title: '', description: '', basePrice: '', maxBonusPrice: '', assignedToId: '' });
      setMembers(prevMembers => 
        prevMembers.map(member => 
          member.id === user.id 
            ? { ...member, totalTasksUploaded: (member.totalTasksUploaded || 0) + 1 } 
            : member
        )
      );
    } catch (err: unknown) {
      let errorMessage = 'שגיאה בפרסום המשימה';
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || err.message;
      }
      alert(errorMessage);
    } finally {
      setTaskLoading(false);
    }
  }

  // תיקון שגיאת ה-Cascading Renders: שליפת שם המשפחה בצורה בטוחה מתוך החבר הראשון במערך
  const familyName = members.length > 0 ? members[0].familyName : 'המשפחה שלי';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white" dir="rtl">
        <div className="text-xl font-medium animate-pulse">טוען את מרכז הבקרה המשפחתי...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 text-right font-sans" dir="rtl">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        
        {/* ראש הדף - כותרת עליונה */}
        <header className="bg-slate-800/60 backdrop-blur border border-slate-700/60 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">
          <div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
              משפחת {familyName} — מרכז בקרה להורים 🚀
            </h1>
            <p className="text-slate-400 text-xs mt-1">שלום {user.name}, כאן תוכל לנהל משימות, לעקוב אחר התקדמות הילדים ולחלק דמי כיס חכמים</p>
          </div>
          <button 
            onClick={onLogout} 
            className="px-5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full text-sm font-bold transition-all shadow-lg"
          >
            התנתק מהחשבון
          </button>
        </header>

        {/* פרסום משימה חדשה — הפעולה המרכזית של ההורה, ברוחב מלא מתחת לכותרת */}
        

        {/* חלוקה ל-2 עמודות עיקריות */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* עמודה 1+2: כרטיסי תעודות הזהות של חברי המשפחה */}
          <section className="lg:col-span-2 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-300 flex items-center gap-2">
              <span>👥</span> חברי הקבוצה המשפחתית ({members.length})
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {members.map((member) => (
                <div 
                  key={member.id} 
                  className={`p-5 rounded-2xl border ring-4 ring-transparent transition-all shadow-lg ${
                    member.role === 'parent' 
                      ? 'bg-slate-800/40 border-slate-700/50' 
                      : 'bg-indigo-950/20 border-indigo-500/20 shadow-indigo-500/5'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-white text-base">{member.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      member.role === 'parent' 
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {member.role === 'parent' ? 'הורה מנהל' : 'צ׳אמפ / ילד'}
                    </span>
                  </div>
                  
                  {/* פרטים וסטטיסטיקות קבועות מהדאטהבייס */}
                  <div className="text-xs text-slate-400 flex flex-col gap-1.5 pt-2 border-t border-slate-700/40">
                    {member.email && <p>📧 אימייל: <span className="text-slate-300">{member.email}</span></p>}
                    {member.role === 'parent' ? (
                      <p className="mt-1 text-purple-400 font-medium">📝 משימות שהעלה: {member.totalTasksUploaded || 0}</p>
                    ) : (
                      <div className="flex flex-col gap-1 mt-1 font-medium">
                        <p className="text-emerald-400">🏆 סך משימות שביצע אי פעם: {member.lifetimeTasksCount || 0}</p>
                        <p className="text-amber-400">💰 סך כל כסף שהרוויח מאז ומעולם: {member.lifetimeEarnings || 0} ₪</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
          

          {/* עמודה 3: טופס הוספת חבר משפחה קבוע + קישורי וואטסאפ */}
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-300 flex items-center gap-2">
              <span>➕</span> הוספת בן משפחה
            </h2>
            
            <div className="bg-slate-800/40 border border-slate-700/50 p-5 rounded-2xl shadow-xl">
              <form onSubmit={handleAddMember} className="flex flex-col gap-4">
                
                <div className="flex flex-col gap-1">
                  <label className="text-slate-300 text-xs font-medium">תפקיד במשפחה</label>
                  <select
                    name="role"
                    value={form.role}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm font-medium"
                  >
                    <option value="child">צ׳אמפ (ילד/ה) — מבצע משימות</option>
                    <option value="parent">הורה נוסף (אמא/אבא) — מנהל חשבון</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-slate-300 text-xs font-medium">שם פרטי</label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleInputChange}
                    placeholder="לדוגמה: נועם"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                    required
                    disabled={formLoading}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-slate-300 text-xs font-medium">סיסמה ראשונית או PIN קוד</label>
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleInputChange}
                    placeholder={form.role === 'child' ? 'קבע קוד PIN של 4 ספרות' : 'קבע סיסמה ראשונית'}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm text-left"
                    required
                    disabled={formLoading}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={formLoading || !form.name.trim() || !form.password}
                  className="w-full py-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-bold shadow-md hover:from-indigo-600 hover:to-violet-600 transition-all disabled:opacity-50"
                >
                  {formLoading ? 'מייצר פרופיל...' : `פתח פרופיל ${form.role === 'child' ? 'ילד/ה' : 'הורה'}`}
                </button>
              </form>

                            {/* קופסת קישור ההזמנה לוואטסאפ במידה ונוצר */}
              {inviteLink && (
                <div className="mt-5 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex flex-col gap-2 shadow-inner">
                  <p className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                    <span>✅</span> החשבון נוצר! העתק את הקישור:
                  </p>
                  <input 
                    type="text" 
                    readOnly 
                    value={inviteLink} 
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full p-2 bg-slate-900 rounded-lg text-[11px] font-mono text-emerald-300 border border-slate-700/60 text-left focus:outline-none select-all"
                  />
                  <p className="text-[10px] text-slate-400 leading-tight">
                    שלחו את הקישור וה-PIN לטלפון של {form.role === 'child' ? 'הילד/ה' : 'ההורה'} כדי שיוכלו להתחבר בשנייה מכל מכשיר!
                  </p>
                </div>
              )}

            </div>
          </section>

        </div>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-slate-300 flex items-center gap-2">
            <span>📌</span> פרסום משימה חדשה ללוח הבית
          </h2>

          <div className="bg-slate-800/40 border border-slate-700/50 p-5 rounded-2xl shadow-xl">
            <form onSubmit={handleCreateTask} className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* צד ימין של הטופס: מה צריך לעשות */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-200 text-sm font-medium">📝 שם המשימה</label>
                  <input
                    type="text"
                    name="title"
                    value={taskForm.title}
                    onChange={handleTaskInputChange}
                    placeholder="לדוגמה: לסדר את חדר הכביסה"
                    className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                    required
                    disabled={taskLoading}
                  />
                </div>

                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-slate-200 text-sm font-medium">🧾 תיאור המשימה</label>
                  <textarea
                    name="description"
                    value={taskForm.description}
                    onChange={handleTaskInputChange}
                    placeholder="לדוגמה: לאסוף את כל הכביסה מהרצפה, לקפל ולסדר בארון"
                    rows={4}
                    className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm resize-none flex-1"
                    disabled={taskLoading}
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">התיאור נשלח ל-AI יחד עם תמונת ההוכחה, אז ככל שיהיה מפורט יותר — ההמלצה על הניקוד תהיה מדויקת יותר</p>
                </div>
              </div>

              {/* צד שמאל של הטופס: הגדרות כספיות, הודעת הצלחה וכפתור פרסום */}
              <div className="flex flex-col gap-4 justify-between">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-200 text-sm font-medium">💰 מחיר בסיס (₪)</label>
                    <input
                      type="number"
                      name="basePrice"
                      step="0.01"
                      value={taskForm.basePrice}
                      onChange={handleTaskInputChange}
                      placeholder="לדוגמה: 10"
                      className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm text-left"
                      required
                      disabled={taskLoading}
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">הסכום המובטח על עצם ביצוע המשימה</p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-slate-200 text-sm font-medium">✨ בונוס מקסימלי (₪)</label>
                    <input
                      type="number"
                      name="maxBonusPrice"
                      step="0.01"
                      value={taskForm.maxBonusPrice}
                      onChange={handleTaskInputChange}
                      placeholder="לדוגמה: 5"
                      className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm text-left"
                      required
                      disabled={taskLoading}
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">תוספת כספית מקסימלית שה-AI יוכל להמליץ עליה</p>
                  </div>
                </div>

                                {/* 🔥 שדה חדש: שיוך לילד ספציפי (אופציונלי) */}
                <div className="flex flex-col gap-1">
                  <label className="text-slate-200 text-sm font-medium">🎯 שיוך לילד ספציפי (אופציונלי)</label>
                  <select
                    name="assignedToId"
                    value={taskForm.assignedToId}
                    onChange={handleTaskInputChange}
                    className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm font-medium"
                    disabled={taskLoading}
                  >
                    <option value="">🔓 פתוח לכולם — כל הקודם זוכה!</option>
                    {members
                      .filter(m => m.role === 'child')
                      .map(child => (
                        <option key={child.id} value={child.id}>
                          👦 {child.name}
                        </option>
                      ))
                    }
                  </select>
                  <p className="text-[10px] text-slate-400 mt-0.5">אם לא תבחר ילד, המשימה תעלה ללוח הציבורי וכל הילדים יוכלו לחטוף אותה</p>
                </div>


                {/* 🔥 כאן בדיוק מוזרק באנר ההצלחה הדינמי - ממש מעל כפתור הפרסום! */}
                {successMessage && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-2 animate-fade-in shadow-lg shadow-emerald-500/5">
                    <span className="text-base">🚀</span>
                    <p className="flex-1 leading-tight">{successMessage}</p>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={taskLoading || !taskForm.title.trim() || !taskForm.basePrice || !taskForm.maxBonusPrice}
                    className="w-full py-3 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-bold shadow-lg hover:from-violet-600 hover:to-indigo-600 transition-all disabled:opacity-50 shadow-indigo-500/10"
                  >
                    {taskLoading ? 'מפרסם משימה...' : 'פרסם משימה חדשה ללוח הבית 🚀'}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

