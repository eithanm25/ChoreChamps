import React, { useState, useEffect } from 'react';
import type { SyntheticEvent } from 'react';
import axios from 'axios';
import api from '../services/api';
import type { SafeUser } from '../App';
import MessageBanner from '../components/MessageBanner';

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
  status: 'open' | 'pending' | 'completed' | 'approved';
  assignedTo: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  submission?: Submission | null;
}

interface FamilyMember {
  id: string;
  name: string;
  role: 'parent' | 'child';
  lifetimeTasksCount?: number;
  lifetimeEarnings?: number;
}

type ChildTab = 'tasks-hub' | 'family-leaderboard';

export default function ChildDashboard({ user, onLogout }: ChildDashboardProps): React.ReactNode {
  const [activeMainTab, setActiveMainTab] = useState<ChildTab>('tasks-hub');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // סטייט להגשת מטלה
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [proofDescription, setProofDescription] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // סטייט לצפייה באחים
  const [selectedSibling, setSelectedSibling] = useState<FamilyMember | null>(null);

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
    fetchDashboardData();
  }, []);

  // חטיפת משימה פתוחה (⚡)
  const handleAcceptTask = async (taskId: string) => {
    setActionLoading(true);
    try {
      await api.post(`/api/tasks/accept/${taskId}`);
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

  // שליחת המשימה להורים עם הוכחה (📸)
  const handleSendToParents = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!submittingTaskId) return;
    setActionLoading(true);
    try {
      const mockPhotoUrls = selectedPhotos.length > 0 ? selectedPhotos : ["https://unsplash.com"];
      
      await api.post(`/api/tasks/${submittingTaskId}/submit`, {
        photoUrls: mockPhotoUrls,
        childNotes: proofDescription.trim()
      });

      setSubmittingTaskId(null);
      setProofDescription('');
      setSelectedPhotos([]);
      await fetchDashboardData();
      setMessage({ type: 'success', text: 'המשימה נשלחה בהצלחה לאישור ההורים! ה-AI מנתח אותה כעת 🤖✨' });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: 'שגיאה בשליחת המשימה להורים' + (axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'שגיאה לא ידועה') });
    } finally {
      setActionLoading(false);
    }
  };

  const currentChildProfile = members.find(m => m.id === user.id);
  const currentBalance = currentChildProfile?.lifetimeEarnings || 0;

  const openAvailableTasks = tasks.filter(t => t.status === 'open' && !t.assignedTo);
  const myActiveTask = tasks.find(t => t.assignedTo?.id === user.id && (t.status === 'pending' || t.status === 'open'));

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
            <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">שלום השמפיון {user.name}! 💪</h1>
            <p className="text-slate-400 text-xs mt-0.5">כל משימה שתבצע מקדמת אותך לפרסים הגדולים</p>
          </div>
          <button onClick={onLogout} className="px-4 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-xs font-bold hover:bg-rose-500/20 transition-all">התנתק</button>
        </header>

        {/* 🪙 כרטיס קופת זהב נוצצת */}
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 p-5 rounded-2xl shadow-xl flex items-center gap-4 relative overflow-hidden">
          <div className="text-3xl animate-bounce">🪙</div>
          <div>
            <span className="text-slate-400 text-xs font-bold block">קופת החיסכון שלי מאז ומעולם:</span>
            <span className="text-2xl font-black text-amber-400 drop-shadow-md">{currentBalance} ₪</span>
          </div>
        </div>

        {/* בורר טאבים אפליקטיבי */}
        <nav className="bg-slate-800/40 p-1 rounded-full ring-1 ring-slate-700/40 flex max-w-xs text-xs font-bold">
          <button onClick={() => { setActiveMainTab('tasks-hub'); setSelectedSibling(null); }} className={`flex-1 py-2 rounded-full transition-all ${activeMainTab === 'tasks-hub' ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}>🎯 משימות וחטיפה</button>
          <button onClick={() => setActiveMainTab('family-leaderboard')} className={`flex-1 py-2 rounded-full transition-all ${activeMainTab === 'family-leaderboard' ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}>👥 חברי המשפחה</button>
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
                        <button onClick={() => handleAcceptTask(task.id)} disabled={actionLoading || !!myActiveTask} className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 rounded-lg text-xs font-black transition-all disabled:opacity-30">חטוף! ⚡</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ⏳ המשימה שלי */}
            <section className="flex flex-col gap-3 mt-2">
              <h2 className="text-base font-bold text-slate-300">⏳ המשימה הנוכחית שלי</h2>
              {!myActiveTask ? (
                <div className="text-center py-6 bg-slate-800/10 border border-slate-800 rounded-xl text-slate-500 text-xs">אינך מבצע שום משימה כרגע. חטוף משימה מהלוח שלמעלה כדי להתחיל להרוויח! 💰</div>
              ) : (
                <div className="p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 shadow-xl flex flex-col gap-4">
                  <div className="flex justify-between items-start border-b border-indigo-500/10 pb-3">
                    <div>
                      <span className="text-[10px] text-indigo-400 font-bold tracking-wider uppercase">משימה נעולה עליך</span>
                      <h3 className="font-black text-white text-base mt-0.5">{myActiveTask.title}</h3>
                      {myActiveTask.description && <p className="text-slate-400 text-xs leading-relaxed mt-1">{myActiveTask.description}</p>}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${myActiveTask.status === 'completed' ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                      {myActiveTask.status === 'completed' ? '📩 מחכה לאישור ההורים' : '🏃 בתהליך ביצוע'}
                    </span>
                  </div>

                  {myActiveTask.status !== 'completed' && submittingTaskId !== myActiveTask.id && (
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                      <div className="flex gap-4 text-xs font-bold text-slate-300">
                        <span className="text-emerald-400">💰 שכר בסיס: {Number(myActiveTask.basePrice)} ₪</span>
                        <span className="text-purple-400">✨ בונוס גג: {Number(myActiveTask.maxBonusPrice)} ₪</span>
                      </div>
                      <button type="button" onClick={() => setSubmittingTaskId(myActiveTask.id)} className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 font-black text-xs rounded-full shadow-lg hover:from-emerald-600 transition-all">סיימתי! הפעל מצלמה 📸</button>
                    </div>
                  )}

                  {submittingTaskId === myActiveTask.id && (
                    <form onSubmit={handleSendToParents} className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl flex flex-col gap-3 text-xs">
                      <span className="font-bold text-emerald-400">📸 צילום הוכחה וכתיבת משוב להורים</span>
                      <div className="flex flex-col gap-1">
                        <label className="text-slate-400 font-medium">הערות להורים (אופציונלי):</label>
                        <textarea value={proofDescription} onChange={(e) => setProofDescription(e.target.value)} placeholder="הסבר קצר לילדים..." className="w-full h-16 p-2 bg-slate-800 rounded-lg text-white resize-none" />
                      </div>
                      <div className="flex gap-2 justify-end mt-2">
                        <button type="button" onClick={() => setSubmittingTaskId(null)} className="px-4 py-1.5 bg-slate-800 text-slate-300 rounded-lg font-bold">ביטול</button>
                        <button type="submit" disabled={actionLoading} className="px-5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 font-black text-white rounded-lg shadow-md disabled:opacity-40">שלח להורים! 🚀</button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* === טאב 2: רשימת בני משפחה וצפייה בפרופיל של אחים ואחיות === */}
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
                                'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              }`}>
                                {task.status === 'approved' ? `✅ אושר ע"י ${task.createdBy?.name || 'הורה'} לאחר ביצועו של ${selectedSibling.name}` :
                                 task.status === 'completed' ? `📩 הושלם ע"י ${selectedSibling.name}` : '⏳ בתהליך עבודה'}
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

