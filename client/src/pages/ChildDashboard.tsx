import React, { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';
import axios from 'axios';
import api, { resolvePhotoUrl } from '../services/api';
import type { SafeUser } from '../App';
import MessageBanner from '../components/MessageBanner';
import { usePolling } from '../hooks/usePolling';
import ChildRewardsStore from '../components/ChildRewardsStore';

/** Matches the server's aiVision MAX_EXECUTION_PHOTOS — kept in sync manually since it can't be imported cross-project. */
const MAX_EXECUTION_PHOTOS = 3;

interface ChildDashboardProps {
  user: SafeUser;
  onLogout: () => void;
}

interface AiSummaryJson {
  summary: string;
  recommendedScore: number;
  reasoning: string;
}

interface Submission {
  id: string;
  photoUrls: string[];
  aiSummary: AiSummaryJson | null;
}

interface Task {
  id: string;
  title: string;
  description: string;
  basePrice: string | number;
  maxBonusPrice: string | number;
  awardedBonus: string | number | null;
  finalScore: number | null;
  rejectionNote: string | null;
  rejectionCount: number;
  status: 'open' | 'pending' | 'completed' | 'rejected' | 'approved';
  assignedTo: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  /** Blank worksheet/test to answer, or "golden standard" chore example, if the parent attached one. */
  referencePhotoUrl: string | null;
  submission?: Submission | null;
}

interface FamilyMember {
  id: string;
  name: string;
  role: 'parent' | 'child';
  lifetimeTasksCount?: number;
  lifetimeEarnings?: number;
  /** Spendable ChoreCoins right now — distinct from lifetimeEarnings above (a cumulative-forever stat). */
  balance?: number;
}

type ChildTab = 'tasks-hub' | 'rewards-store' | 'family-leaderboard';

export default function ChildDashboard({ user, onLogout }: ChildDashboardProps): React.ReactNode {
  const [activeMainTab, setActiveMainTab] = useState<ChildTab>('tasks-hub');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // סטייט להגשת מטלה
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [proofDescription, setProofDescription] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // סטייט לצפייה באחים
  const [selectedSibling, setSelectedSibling] = useState<FamilyMember | null>(null);

  // מעקב אחר כל ה-blob URLs שנוצרו כדי לנקות אותם גם אם הרכיב יורד מהמסך באמצע הגשה
  const previewUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    previewUrlsRef.current = previewUrls;
  }, [previewUrls]);
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const tasksRes = await api.get('/api/tasks/family-tasks');
      setTasks(tasksRes.data.tasks || []);

      const membersRes = await api.get('/api/tasks/family-members');
      setMembers(membersRes.data.members || []);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      await fetchDashboardData();
    };
    loadInitialData();
  }, []);

  // מרעננים ברקע כל כמה שניות + מיד כשחוזרים לטאב, כדי שמשימות/חברים שהוריד
  // שינה בן משפחה אחר (למשל: משימה חדשה, מחיקת פרופיל) יופיעו בלי רענון ידני
  usePolling(fetchDashboardData);

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const remainingSlots = MAX_EXECUTION_PHOTOS - selectedPhotos.length;
      const filesArray = Array.from(e.target.files).slice(0, Math.max(0, remainingSlots));

      if (filesArray.length === 0) {
        setMessage({ type: 'error', text: `אפשר לצרף עד ${MAX_EXECUTION_PHOTOS} תמונות למשימה` });
        e.target.value = '';
        return;
      }

      // שומרים את הקבצים האמיתיים בסטייט
      setSelectedPhotos(prev => [...prev, ...filesArray]);

      // מייצרים כתובות אינטרנט זמניות בדפדפן רק בשביל ה-Preview הויזואלי
      const newPreviews = filesArray.map(file => URL.createObjectURL(file));
      setPreviewUrls(prev => [...prev, ...newPreviews]);
      e.target.value = '';
    }
  };

  const removePhoto = (indexToRemove: number) => {
    setSelectedPhotos(prev => prev.filter((_, idx) => idx !== indexToRemove));
    // מנקים גם את ה-Preview הזמני מהזיכרון של הדפדפן כדי למנוע זליגת זיכרון
    URL.revokeObjectURL(previewUrls[indexToRemove]);
    setPreviewUrls(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const closeSubmitForm = () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setSubmittingTaskId(null);
    setSelectedPhotos([]);
    setPreviewUrls([]);
    setProofDescription('');
  };

  // חטיפת משימה פתוחה (⚡)
  const handleAcceptTask = async (taskId: string) => {
    setActionLoading(true);
    try {
      await api.post(`/api/tasks/${taskId}/accept`);
      setMessage({ type: 'success', text: 'המשימה נלקחה בהצלחה! 🎯' });
      await fetchDashboardData();
    } catch (err: unknown) {
      let msg = 'שגיאה בחטיפת המשימה';
      if (axios.isAxiosError(err)) msg = err.response?.data?.error || err.message;
      setMessage({ type: 'error', text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  // שליחת המשימה להורים עם הוכחה (📸) — גם להגשה ראשונה וגם לתיקון אחרי דחייה
  const handleSendToParents = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (actionLoading || !submittingTaskId || selectedPhotos.length === 0) return;

    const taskTitle = tasks.find((task) => task.id === submittingTaskId)?.title || 'המשימה';

    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('childNotes', proofDescription.trim());
      selectedPhotos.forEach((file) => {
        formData.append('photos', file);
      });

      const response = await api.post(`/api/tasks/${submittingTaskId}/submit`, formData);

      const taskResponse = response.data?.task;

      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === submittingTaskId
            ? {
                ...task,
                status: taskResponse?.status ?? 'completed',
                rejectionNote: null,
                submission: response.data?.submission ?? task.submission,
              }
            : task,
        ),
      );

      // מנקים את ה-blob URLs שנוצרו לפני איפוס הטופס, כדי לא לזלוג זיכרון
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      setSubmittingTaskId(null);
      setProofDescription('');
      setSelectedPhotos([]);
      setPreviewUrls([]);
      await fetchDashboardData();

      setMessage({
        type: 'success',
        text: `🎉 כל הכבוד! "${taskTitle}" נשלחה להורים ומחכה לאישור שלהם`,
      });
    } catch (err: unknown) {
      let errorText = 'שגיאה בשליחת המשימה להורים';
      if (axios.isAxiosError(err)) {
        errorText = err.response?.data?.error || err.message;
      }
      setMessage({ type: 'error', text: errorText });
    } finally {
      setActionLoading(false);
    }
  };

  const currentChildProfile = members.find(m => m.id === user.id);
  const currentBalance = currentChildProfile?.lifetimeEarnings || 0;

  const openAvailableTasks = tasks.filter(t => t.status === 'open' && !t.assignedTo);

  // המשימה היחידה שהילד יכול לעבוד עליה כרגע (המגבלה של מקסימום 'pending' אחד נאכפת בשרת)
  const myPendingTask = tasks.find(t => t.assignedTo?.id === user.id && t.status === 'pending');
  // משימות שכבר נשלחו וממתינות לבדיקת הורה — יכול להיות יותר מאחת בו-זמנית
  const myCompletedTasks = tasks.filter(t => t.assignedTo?.id === user.id && t.status === 'completed');
  // משימות שההורה החזיר לתיקון — "כמוסת התיקונים"
  const myRejectedTasks = tasks.filter(t => t.assignedTo?.id === user.id && t.status === 'rejected');

  // המגבלה בפועל על "חטיפת" משימה חדשה: רק 'pending' חוסם, לא 'completed' ולא 'rejected' —
  // כך שהילד חופשי להמשיך לעבוד בזמן שמשימה קודמת ממתינה לאישור או לתיקון.
  const hasBlockingPendingTask = !!myPendingTask;

  const renderSubmitForm = (submitLabel: string) => (
    <form onSubmit={handleSendToParents} className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl flex flex-col gap-4 text-xs animate-fade-in text-right">
      <span className="font-bold text-emerald-400 flex items-center gap-1">
        <span>📸</span> צילום הוכחה לביצוע המשימה
      </span>

      {/* כפתור המצלמה/העלאה המעוצב לנייד */}
      <div className="flex flex-col gap-2">
        <label className={`w-full py-3 bg-slate-800 border border-dashed border-slate-600 rounded-xl flex items-center justify-center gap-2 transition-colors text-slate-300 font-bold ${selectedPhotos.length >= MAX_EXECUTION_PHOTOS ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-700 cursor-pointer'}`}>
          <span>📷</span> {selectedPhotos.length >= MAX_EXECUTION_PHOTOS ? `הגעתם למקסימום ${MAX_EXECUTION_PHOTOS} תמונות` : selectedPhotos.length > 0 ? `צלם/הוסף עוד תמונה (${selectedPhotos.length}/${MAX_EXECUTION_PHOTOS})` : 'לחץ כאן כדי לצלם את העבודה'}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoChange}
            className="hidden"
            disabled={actionLoading || selectedPhotos.length >= MAX_EXECUTION_PHOTOS}
          />
        </label>
      </div>

      {/* 🖼️ תצוגה מקדימה (Preview) של התמונות שהילד צילם כולל כפתור מחיקה קטן */}
      {previewUrls.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-slate-400 text-[10px]">התמונות שנבחרו לשליחה:</span>
          <div className="flex gap-2 overflow-x-auto py-1">
            {previewUrls.map((base64Str, idx) => (
              <div key={idx} className="relative w-16 h-16 flex-shrink-0 group">
                <img src={base64Str} alt="תצוגה מקדימה" className="w-full h-full object-cover rounded-lg border border-slate-700 ring-2 ring-slate-800 shadow-md" />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center text-[9px] font-black shadow-md cursor-pointer select-none"
                  title="מחק תמונה"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-slate-400 font-medium">הערות להורים (אופציונלי):</label>
        <textarea
          value={proofDescription}
          onChange={(e) => setProofDescription(e.target.value)}
          placeholder="רוצים לספר להורים משהו על המשימה? (לדוגמה: ניקיתי ממש טוב וגם ריססתי מטהר אוויר!)"
          className="w-full h-16 p-2 bg-slate-800 rounded-lg text-white resize-none border border-slate-700 focus:outline-none focus:border-indigo-500"
          disabled={actionLoading}
        />
      </div>

      <div className="flex gap-2 justify-end mt-1 border-t border-slate-800/80 pt-3">
        <button type="button" onClick={closeSubmitForm} className="px-4 py-1.5 bg-slate-800 text-slate-300 rounded-lg font-bold">ביטול</button>
        <button
          type="submit"
          disabled={actionLoading || selectedPhotos.length === 0}
          className="px-5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 font-black text-white rounded-lg shadow-md hover:from-emerald-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {actionLoading ? 'מעלה משימה...' : submitLabel}
        </button>
      </div>
    </form>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white" dir="rtl">
        <div className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400 animate-pulse">טוען את עולם הצ׳אמפס... 🪙</div>
      </div>
    );
  }
    return (
    <div className="min-h-screen bg-slate-900 text-white p-5 text-right font-sans flex flex-col gap-6" dir="rtl">
      <div className="max-w-4xl w-full mx-auto flex flex-col gap-5">
        {message && (
          <MessageBanner type={message.type} text={message.text} onDismiss={() => setMessage(null)} />
        )}

        {/* ראש דף משחקי */}
        <header className="bg-slate-800/50 border border-slate-700/50 p-5 rounded-2xl flex justify-between items-center shadow-xl">
          <div>
            <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">שלום הצ'מפיון {user.name}! 💪</h1>
            <p className="text-slate-400 text-xs mt-0.5">כל משימה שתבצע מקדמת אותך לפרסים הגדולים</p>
          </div>
          <button onClick={onLogout} className="px-4 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-xs font-bold hover:bg-rose-500/20 transition-all">התנתק</button>
        </header>

        {/* 🪙 כרטיס קופת זהב נוצצת */}
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 p-5 rounded-2xl shadow-xl flex items-center gap-4 relative overflow-hidden">
          <div className="text-3xl animate-bounce">🪙</div>
          <div>
            <span className="text-slate-400 text-xs font-bold block">כמות המטבעות בחשבון שלי</span>
            <span className="text-2xl font-black text-amber-400 drop-shadow-md">{currentBalance}</span>
          </div>
        </div>

        {/* בורר טאבים אפליקטיבי */}
        <nav className="bg-slate-800/40 p-1 rounded-full ring-1 ring-slate-700/40 flex max-w-lg text-[11px] sm:text-xs font-bold overflow-x-auto">
          <button onClick={() => { setActiveMainTab('tasks-hub'); setSelectedSibling(null); }} className={`flex-1 py-2 px-2 rounded-full transition-all whitespace-nowrap ${activeMainTab === 'tasks-hub' ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}>🎯 משימות וחטיפה</button>
          <button onClick={() => setActiveMainTab('rewards-store')} className={`flex-1 py-2 px-2 rounded-full transition-all whitespace-nowrap ${activeMainTab === 'rewards-store' ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}>🎁 חנות הפרסים שלי</button>
          <button onClick={() => setActiveMainTab('family-leaderboard')} className={`flex-1 py-2 px-2 rounded-full transition-all whitespace-nowrap ${activeMainTab === 'family-leaderboard' ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}>👥 חברי המשפחה</button>
        </nav>

        {/* === טאב 1: לוח משימות פתוחות + המשימה הפעילה שלי === */}
        {activeMainTab === 'tasks-hub' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <section className="flex flex-col gap-3">
              <h2 className="text-base font-bold text-slate-300">🎯 משימות פנויות בלוח (כל הקודם זוכה!)</h2>
              {openAvailableTasks.length === 0 ? (
                <div className="text-center py-6 bg-slate-800/10 border border-slate-800 rounded-xl text-slate-500 text-xs">אין כרגע משימות פתוחות באוויר. אבא ואמא עוד לא העלו משהו חדש.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {openAvailableTasks.map(task => (
                    <div key={task.id} className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/40 flex flex-col justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-white text-sm">{task.title}</h3>
                        {task.description && <p className="text-slate-400 text-xs leading-relaxed mt-1">{task.description}</p>}
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-800 pt-2.5">
                        <div className="flex gap-3 text-[11px] font-bold">
                          <span className="text-emerald-400">💰 בסיס: {Number(task.basePrice)} ₪</span>
                          <span className="text-purple-400">✨ בונוס: {Number(task.maxBonusPrice)} ₪</span>
                        </div>
                        <button onClick={() => handleAcceptTask(task.id)} disabled={actionLoading || hasBlockingPendingTask} className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 rounded-lg text-xs font-black transition-all disabled:opacity-30">חטוף! ⚡</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ⏳ המשימה שלי */}
            <section className="flex flex-col gap-3 mt-2">
              <h2 className="text-base font-bold text-slate-300">⏳ המשימה הנוכחית שלי</h2>
              {!myPendingTask ? (
                <div className="text-center py-6 bg-slate-800/10 border border-slate-800 rounded-xl text-slate-500 text-xs">אינך מבצע שום משימה כרגע. חטוף משימה מהלוח שלמעלה כדי להתחיל להרוויח! 💰</div>
              ) : (
                <div className="p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 shadow-xl flex flex-col gap-4">
                  <div className="flex justify-between items-start border-b border-indigo-500/10 pb-3">
                    <div>
                      <span className="text-[10px] text-indigo-400 font-bold tracking-wider uppercase">משימה נעולה עליך</span>
                      <h3 className="font-black text-white text-base mt-0.5">{myPendingTask.title}</h3>
                      {myPendingTask.description && <p className="text-slate-400 text-xs leading-relaxed mt-1">{myPendingTask.description}</p>}
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400">
                      🏃 בתהליך ביצוע
                    </span>
                  </div>

                  {myPendingTask.referencePhotoUrl && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-slate-400 text-[10px] font-bold">📎 דף העבודה / התקן שצריך להשלים:</span>
                      <img src={resolvePhotoUrl(myPendingTask.referencePhotoUrl)} alt="תמונת ייחוס למשימה" className="w-28 h-28 object-cover rounded-lg border border-indigo-500/40 shadow-md" />
                    </div>
                  )}

                  {submittingTaskId !== myPendingTask.id ? (
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                      <div className="flex gap-4 text-xs font-bold text-slate-300">
                        <span className="text-emerald-400">💰 שכר בסיס: {Number(myPendingTask.basePrice)} ₪</span>
                        <span className="text-purple-400">✨ בונוס גג: {Number(myPendingTask.maxBonusPrice)} ₪</span>
                      </div>
                      <button type="button" onClick={() => setSubmittingTaskId(myPendingTask.id)} className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 font-black text-xs rounded-full shadow-lg hover:from-emerald-600 transition-all">סיימתי! הפעל מצלמה 📸</button>
                    </div>
                  ) : (
                    renderSubmitForm('שלח להורים! 🚀')
                  )}
                </div>
              )}
            </section>

            {/* 📩 משימות שממתינות לאישור ההורים — יכולות להיות כמה בו-זמנית */}
            {myCompletedTasks.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-base font-bold text-slate-300">📩 ממתין לאישור ההורים ({myCompletedTasks.length})</h2>
                <div className="flex flex-col gap-3">
                  {myCompletedTasks.map((task) => (
                    <div key={task.id} className="relative overflow-hidden bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-emerald-500/5 border border-emerald-500/30 rounded-2xl p-5 flex flex-col gap-4 shadow-lg shadow-emerald-500/10">
                      <div className="flex items-start gap-3">
                        <span className="text-3xl animate-bounce">🎉</span>
                        <div className="flex flex-col">
                          <span className="text-emerald-300 font-black text-sm">{task.title}</span>
                          <span className="text-slate-400 text-[11px] mt-1 leading-relaxed">
                            ההוכחה שצילמת נשמרה והועברה לאישור. ברגע שההורים יאשרו — הכסף ייכנס ישר לקופה שלך 🪙
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 border-t border-emerald-500/10 pt-3 text-center">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] text-slate-500 font-bold">תמונות שנשלחו</span>
                          <span className="text-sm font-black text-white">{task.submission?.photoUrls?.length || 0} 📸</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] text-slate-500 font-bold">שכר בסיס מובטח</span>
                          <span className="text-sm font-black text-emerald-400">{Number(task.basePrice)} ₪</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] text-slate-500 font-bold">בונוס אפשרי</span>
                          <span className="text-sm font-black text-purple-400">עד {Number(task.maxBonusPrice)} ₪</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-slate-900/40 rounded-xl px-3 py-2">
                        <span className="text-base animate-pulse">⏳</span>
                        <span className="text-[11px] text-slate-300 font-medium">
                          ממתין לאישור של {task.createdBy?.name || 'ההורים'} — נעדכן אותך ברגע שיאשרו
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 🔧 כמוסת "משימות לתיקון" — משימות שההורה החזיר עם הערה */}
            {myRejectedTasks.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-base font-bold text-slate-300">🔧 משימות לתיקון ({myRejectedTasks.length})</h2>
                <div className="flex flex-col gap-3">
                  {myRejectedTasks.map((task) => (
                    <div key={task.id} className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/30 shadow-xl flex flex-col gap-4">
                      <div className="flex justify-between items-start border-b border-rose-500/10 pb-3">
                        <div>
                          <span className="text-[10px] text-rose-400 font-bold tracking-wider uppercase">חזר לתיקון{task.rejectionCount > 1 ? ` (ניסיון ${task.rejectionCount + 1})` : ''}</span>
                          <h3 className="font-black text-white text-base mt-0.5">{task.title}</h3>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400">
                          🔧 נדרש תיקון
                        </span>
                      </div>

                      {task.rejectionNote && (
                        <div className="bg-slate-900/50 border border-rose-500/10 rounded-xl p-3 flex flex-col gap-1">
                          <span className="text-[10px] text-rose-300 font-bold">💬 מה {task.createdBy?.name || 'ההורים'} ביקשו לתקן:</span>
                          <p className="text-slate-300 text-xs leading-relaxed">{task.rejectionNote}</p>
                        </div>
                      )}

                      {task.referencePhotoUrl && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-slate-400 text-[10px] font-bold">📎 דף העבודה / התקן להשוואה:</span>
                          <img src={resolvePhotoUrl(task.referencePhotoUrl)} alt="תמונת ייחוס למשימה" className="w-28 h-28 object-cover rounded-lg border border-rose-500/40 shadow-md" />
                        </div>
                      )}

                      {submittingTaskId !== task.id ? (
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                          <div className="flex gap-4 text-xs font-bold text-slate-300">
                            <span className="text-emerald-400">💰 שכר בסיס: {Number(task.basePrice)} ₪</span>
                            <span className="text-purple-400">✨ בונוס גג: {Number(task.maxBonusPrice)} ₪</span>
                          </div>
                          <button type="button" onClick={() => setSubmittingTaskId(task.id)} className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-rose-500 to-orange-500 font-black text-xs rounded-full shadow-lg hover:from-rose-600 transition-all">תקן ושלח שוב 📸</button>
                        </div>
                      ) : (
                        renderSubmitForm('שלח תיקון להורים! 🚀')
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* === טאב 2: חנות הפרסים — פרסים אישיים ויעד משפחתי משותף === */}
        {activeMainTab === 'rewards-store' && (
          <ChildRewardsStore user={user} balance={currentChildProfile?.balance ?? 0} />
        )}

        {/* === טאב 3: רשימת בני משפחה וצפייה בפרופיל של אחים ואחיות === */}
        {activeMainTab === 'family-leaderboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
            <section className="md:col-span-1 flex flex-col gap-2">
              <h2 className="text-base font-bold text-slate-300">👥 בני המשפחה שלי</h2>
              <div className="flex flex-col gap-2">
                {members.map(member => (
                  <div
                    key={member.id}
                    onClick={() => member.role === 'child' && setSelectedSibling(member)}
                    className={`p-3 rounded-xl border text-right transition-all shadow-md ${member.role === 'child' ? 'cursor-pointer hover:border-indigo-500/60' : ''} ${selectedSibling?.id === member.id ? 'bg-indigo-950/20 border-indigo-500 ring-2 ring-indigo-500/20' : 'bg-slate-800/40 border-slate-700/50'}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white text-xs">{member.name} {member.id === user.id ? '(אני)' : ''}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${member.role === 'parent' ? 'bg-purple-500/10 text-purple-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{member.role === 'parent' ? 'הורה' : 'צ׳אמפ'}</span>
                    </div>
                    {member.role === 'child' && (
                      <p className="text-[10px] text-slate-400 mt-1 font-medium">🏆 ביצע {member.lifetimeTasksCount || 0} משימות • 💰 צבר {member.lifetimeEarnings || 0} ₪</p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* 🔥 לוח צפייה מתקדם במשימות של האחים עם הכיתובים הדינמיים שלך! */}
            <section className="md:col-span-2 flex flex-col gap-3">
              <h2 className="text-base font-bold text-slate-300">📋 לוח המשימות של האחים</h2>
              {!selectedSibling ? (                 <div className="text-center py-10 bg-slate-800/10 border border-slate-800 rounded-2xl text-slate-500 text-xs">
                  לחצו על אחד מהאחים ברשימה מימין כדי לראות את ההיסטוריה והמשימות הפעילות שלו! 👦👧
                </div>
              ) : (
                <div className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-2xl shadow-xl flex flex-col gap-3">
                  <header className="border-b border-slate-800 pb-2 flex justify-between items-center">
                    <h3 className="font-black text-indigo-400 text-sm">פרופיל המשימות של {selectedSibling.name}</h3>
                    <button type="button" onClick={() => setSelectedSibling(null)} className="text-[10px] text-slate-500 hover:text-slate-300">סגור X</button>
                  </header>

                  {tasks.filter(t => t.assignedTo?.id === selectedSibling.id).length === 0 ? (
                    <div className="text-center py-6 text-slate-600 text-xs">לאח/אחות זו אין עדיין היסטוריית משימות רשומה.</div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                      {tasks
                        .filter(t => t.assignedTo?.id === selectedSibling.id)
                        .map(task => (
                          <div key={task.id} className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl flex flex-col gap-1.5 text-xs">
                            <div className="flex justify-between items-start gap-2">
                              <span className="font-bold text-white leading-tight">{task.title}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap ${
                                task.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                task.status === 'completed' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                task.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              }`}>
                                {task.status === 'approved' ? `✅ אושר ע"י ${task.createdBy?.name || 'הורה'} לאחר ביצועו של ${selectedSibling.name}` :
                                 task.status === 'completed' ? `📩 הושלם ע"י ${selectedSibling.name}` :
                                 task.status === 'rejected' ? `🔧 חזר לתיקון` : '⏳ בתהליך עבודה'}
                              </span>
                            </div>
                            <div className="flex gap-4 text-[10px] text-slate-400 font-semibold border-t border-slate-800/60 pt-1.5">
                              <span>💰 בסיס: {Number(task.basePrice)} ₪</span>
                              {task.status === 'approved' ? (
                                <span className="text-amber-400">🎁 בונוס שניתן: {Number(task.awardedBonus || 0).toFixed(2)} ₪</span>
                              ) : (
                                <span>✨ בונוס גג: {Number(task.maxBonusPrice)} ₪</span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

      </div>
    </div>
  );
}
