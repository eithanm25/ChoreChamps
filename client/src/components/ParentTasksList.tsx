import React, { useState, useEffect } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';
import axios from 'axios';
import api, { resolvePhotoUrl } from '../services/api';
import MessageBanner from './MessageBanner';

// הגדרת ה-Interfaces המבניים המסונכרנים עם השרת
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

export interface Task {
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
  submission?: Submission | null;
}

interface FamilyMember {
  id: string;
  name: string;
  role: 'parent' | 'child';
}

interface ParentTasksListProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}

type TaskTab = 'unassigned' | 'in-progress' | 'pending-approval' | 'needs-fixing' | 'approved';

/** Removed family members are never sent to the client, so a null assignedTo on an
 * already-worked task means the child who did it was deleted — never a crash. */
function getAssigneeLabel(task: Task): string {
  if (task.assignedTo) {
    return task.assignedTo.name;
  }
  if (task.status === 'approved' || task.status === 'completed' || task.status === 'rejected') {
    return 'צ׳אמפ (הוסר מהמערכת)';
  }
  return 'צ׳אמפ';
}

export default function ParentTasksList({ tasks, setTasks }: ParentTasksListProps): React.ReactNode {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TaskTab>('unassigned');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // רשימת הילדים לצורך תיבת הבחירה בעריכה
  const [children, setChildren] = useState<FamilyMember[]>([]);

  // מצב עבור עריכת משימה (Inline Editing)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    basePrice: '',
    maxBonusPrice: '',
    assignedToId: ''
  });
  const [editLoading, setEditLoading] = useState(false);

  // מצב עבור בדיקת משימה (מתן ציון לאישור, או כתיבת הערת תיקון לדחייה)
  const [reviewingTaskId, setReviewingTaskId] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<'approve' | 'reject'>('approve');
  const [scoreInput, setScoreInput] = useState('100');
  const [rejectionNoteInput, setRejectionNoteInput] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  // 1. שליפת המשימות וחברי המשפחה (בשביל הילדים ב-Select) כשהדף עולה מראש
  useEffect(() => {
    const initComponent = async () => {
      try {
        // משיכת משימות
        const tasksRes = await api.get('/api/tasks/family-tasks');
        setTasks(tasksRes.data.tasks || []);

        // משיכת חברי משפחה כדי לסנן ילדים לעריכה
        const membersRes = await api.get('/api/tasks/family-members');
        const allMembers: FamilyMember[] = membersRes.data.members || [];
        setChildren(allMembers.filter((m: FamilyMember) => m.role === 'child'));
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          console.error(err.response?.data?.error || err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    initComponent();
  }, [setTasks]);

  // 2. פונקציית מחיקת משימה חכמה (🗑️) עם עדכון ויזואלי מיידי
  const handleDelete = async (taskId: string, taskTitle: string) => {
    const confirmDelete = window.confirm(`האם אתם בטוחים שברצונכם לבטל ולמחוק את המשימה "${taskTitle}"?`);
    if (!confirmDelete) return;

    try {
      await api.delete(`/api/tasks/${taskId}`);

      // עדכון מקומי מהיר (Optimistic UI Update) - המשימה נעלמת בשבריר שנייה
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err: unknown) {
      let errorMessage = 'שגיאה במחיקת המשימה';
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || err.message;
      }
      setMessage({ type: 'error', text: errorMessage });
    }
  };



  // 3. פתיחת מצב עריכה והזנת הנתונים הקיימים לטופס
  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditForm({
      title: task.title,
      description: task.description,
      basePrice: String(task.basePrice),
      maxBonusPrice: String(task.maxBonusPrice),
      assignedToId: task.assignedTo ? task.assignedTo.id : ''
    });
  };

  const handleEditInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  // 4. שמירת המשימה הערוכה ושליחה לשרת (PUT)
  const handleEditSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!editingTaskId || !editForm.title.trim() || !editForm.basePrice || !editForm.maxBonusPrice) return;

    setEditLoading(true);
    try {
      const response = await api.put(`/api/tasks/${editingTaskId}`, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        basePrice: Number(editForm.basePrice),
        maxBonusPrice: Number(editForm.maxBonusPrice),
        assignedToId: editForm.assignedToId || null
      });

      const updatedTask = response.data.task;

      // עדכון ויזואלי מהיר של המשימה הספציפית בתוך ה-State של האב
      setTasks(prev => prev.map(t => t.id === editingTaskId ? { ...t, ...updatedTask } : t));

      setMessage({ type: 'success', text: 'המשימה עודכנה בהצלחה' });
      // סגירת מצב עריכה
      setEditingTaskId(null);
    } catch (err: unknown) {
      let errorMessage = 'שגיאה בעדכון המשימה';
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || err.message;
      }
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setEditLoading(false);
    }
  };

  // 5. פתיחת פאנל הבדיקה (אישור עם ציון, או דחייה עם הערה)
  const startReview = (task: Task, mode: 'approve' | 'reject') => {
    setReviewingTaskId(task.id);
    setReviewMode(mode);
    setScoreInput('100');
    setRejectionNoteInput('');
  };

  const cancelReview = () => {
    setReviewingTaskId(null);
    setRejectionNoteInput('');
  };

  // 6. שליחת הבדיקה לשרת (POST /:id/review) — גם עבור אישור וגם עבור דחייה
  const handleReviewSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!reviewingTaskId) return;

    if (reviewMode === 'reject' && !rejectionNoteInput.trim()) {
      setMessage({ type: 'error', text: 'חובה לכתוב לילד מה צריך לתקן' });
      return;
    }

    setReviewLoading(true);
    try {
      const body =
        reviewMode === 'approve'
          ? { action: 'approve', finalScore: Number(scoreInput) }
          : { action: 'reject', note: rejectionNoteInput.trim() };

      const response = await api.post(`/api/tasks/${reviewingTaskId}/review`, body);
      const updatedTask = response.data.task;

      setTasks(prev => prev.map(t => (t.id === reviewingTaskId ? { ...t, ...updatedTask } : t)));
      setMessage({
        type: 'success',
        text: reviewMode === 'approve' ? 'המשימה אושרה והתשלום זוכה לילד! 🎉' : 'המשימה נשלחה חזרה לילד לתיקון',
      });
      setReviewingTaskId(null);
      setRejectionNoteInput('');
    } catch (err: unknown) {
      let errorMessage = 'שגיאה בבדיקת המשימה';
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || err.message;
      }
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setReviewLoading(false);
    }
  };

  // חלוקה לוגית לפי הסטטוסים באותיות קטנות (תואם לאנום שמוגדר בשרת)
  const unassignedTasks = tasks.filter(t => t.status === 'open' && !t.assignedTo);
  const inProgressTasks = tasks.filter(t => t.status === 'pending');
  const pendingApprovalTasks = tasks.filter(t => t.status === 'completed');
  const needsFixingTasks = tasks.filter(t => t.status === 'rejected');
  const approvedTasks = tasks.filter(t => t.status === 'approved');

  const tabs = [
    { key: 'unassigned' as TaskTab, label: '🔓 משימות פתוחות', count: unassignedTasks.length },
    { key: 'in-progress' as TaskTab, label: '⏳ משימות בתהליך', count: inProgressTasks.length },
    { key: 'pending-approval' as TaskTab, label: '🔔 מחכות לאישור', count: pendingApprovalTasks.length },
    { key: 'needs-fixing' as TaskTab, label: '🔧 חזרו לתיקון', count: needsFixingTasks.length },
    { key: 'approved' as TaskTab, label: '✅ משימות שאושרו', count: approvedTasks.length },
  ];

  if (loading) {
    return (
      <div className="p-6 text-center text-slate-400 text-sm animate-pulse">
        טוען את לוח המשימות המשפחתי...
      </div>
    );
  }

  const currentTasks =
  activeTab === 'unassigned' ? unassignedTasks :
  activeTab === 'in-progress' ? inProgressTasks :
  activeTab === 'pending-approval' ? pendingApprovalTasks :
  activeTab === 'needs-fixing' ? needsFixingTasks : approvedTasks;

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 p-6 rounded-2xl shadow-xl w-full" dir="rtl">

      {message && (
        <div className="mb-4">
          <MessageBanner type={message.type} text={message.text} onDismiss={() => setMessage(null)} />
        </div>
      )}

      {/* תפריט הטאבים */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-700/50 pb-4 mb-6">
        <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <span>📋</span> מעקב משימות ביתיות
        </h2>

        <nav className="bg-slate-900/60 p-1 rounded-full ring-1 ring-slate-700/60 flex gap-1 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setActiveTab(tab.key); setEditingTaskId(null); setReviewingTaskId(null); }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === tab.key ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </nav>
      </header>

      {/* רשימת הכרטיסים */}
      {currentTasks.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-xs">
          אין כרגע משימות בקטגוריה זו.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start" >
          {currentTasks.map((task) => {
            const isEditing = editingTaskId === task.id;
            const isReviewing = reviewingTaskId === task.id;

            return (
              <div
                key={task.id}
                className="p-5 rounded-2xl bg-slate-900/40 border border-slate-700/40 flex flex-col gap-3 shadow-lg justify-between"
              >
                {/* מצב א': כרטיס המשימה נמצא כרגע בעריכה פעילה (מציג טופס אינליין) */}
                {isEditing ? (
                  <form onSubmit={handleEditSubmit} className="flex flex-col gap-3 w-full text-xs">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="font-bold text-indigo-400">✏️ עריכת משימה</span>
                      <button
                        type="button"
                        onClick={() => setEditingTaskId(null)}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        ביטול X
                      </button>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-slate-300 font-medium">שם המשימה</label>
                      <input
                        type="text"
                        name="title"
                        value={editForm.title}
                        onChange={handleEditInputChange}
                        className="p-2 bg-slate-800 rounded-lg text-white ring-1 ring-slate-700 focus:outline-none"
                        required
                        disabled={editLoading}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-slate-300 font-medium">תיאור</label>
                      <textarea
                        name="description"
                        value={editForm.description}
                        onChange={handleEditInputChange}
                        className="p-2 bg-slate-800 rounded-lg text-white ring-1 ring-slate-700 h-16 resize-none focus:outline-none"
                        disabled={editLoading}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-slate-300 font-medium">💰 מחיר בסיס</label>
                        <input
                          type="number"
                          name="basePrice"
                          step="0.1"
                          value={editForm.basePrice}
                          onChange={handleEditInputChange}
                          className="p-2 bg-slate-800 rounded-lg text-white ring-1 ring-slate-700 focus:outline-none text-left"
                          required
                          disabled={editLoading}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-slate-300 font-medium">✨ בונוס גג</label>
                        <input
                          type="number"
                          name="maxBonusPrice"
                          step="0.1"
                          value={editForm.maxBonusPrice}
                          onChange={handleEditInputChange}
                          className="p-2 bg-slate-800 rounded-lg text-white ring-1 ring-slate-700 text-left focus:outline-none"
                          required
                          disabled={editLoading}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-slate-300 font-medium">🎯 שיוך לילד</label>
                      <select
                        name="assignedToId"
                        value={editForm.assignedToId}
                        onChange={handleEditInputChange}
                        className="p-2 bg-slate-800 rounded-lg text-white ring-1 ring-slate-700 focus:outline-none font-medium"
                        disabled={editLoading}
                      >
                        <option value="">🔓 פתוח לכולם — כל הקודם זוכה!</option>
                        {children.map(c => (
                          <option key={c.id} value={c.id}>👦 {c.name}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={editLoading}
                      className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl font-bold text-white shadow-md hover:from-emerald-600 transition-all mt-2"
                    >
                      {editLoading ? 'שומר שינויים...' : 'שמור עדכון משימה'}
                    </button>
                  </form>
                ) : (

                  // מצב ב': כרטיס המשימה הסטטי הרגיל (כולל שני הלחצנים החדשים)
                  <>

                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex flex-col gap-0.5">
                          <h3 className="font-bold text-white text-base airy-headline leading-tight">{task.title}</h3>
                          {task.createdBy && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              👑 פורסם על ידי: <span className="text-slate-300 font-semibold">{task.createdBy.name}</span>
                            </span>
                          )}
                        </div>

                        {/* 🛠️ אזור הלחצנים החדש: עיפרון ופח אשפה בחלק השמאלי עליון */}
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                            task.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            task.status === 'completed' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            task.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            task.assignedTo ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                          }`}>
                            {task.status === 'approved' ? `✅ אושר ע"י ${task.createdBy?.name || 'הורה'} (בוצע ע"י ${getAssigneeLabel(task)})` :
                            task.status === 'completed' ? `📩 הושלם ע"י ${getAssigneeLabel(task)}` :
                            task.status === 'rejected' ? `🔧 חזר לתיקון אצל ${getAssigneeLabel(task)}` :
                            task.assignedTo ? `⏳ בתהליך עבודה: ${task.assignedTo.name}` : '🔓 פתוח לכולם'}
                          </span>

                          {/* מותר למחוק ולערוך רק אם המשימה לא אושרה סופית */}
                          {task.status !== 'approved' && (
                            <div className="flex gap-2 border-r border-slate-700/60 pr-2 mr-1">
                              <button
                                type="button"
                                onClick={() => startEditing(task)}
                                title="ערוך משימה"
                                className="text-xs opacity-60 hover:opacity-100 hover:scale-110 transition-all"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(task.id, task.title)}
                                title="מחק משימה"
                                className="text-xs opacity-60 hover:opacity-100 hover:scale-110 transition-all text-red-400"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {task.description && (
                        <p className="text-slate-400 text-xs leading-relaxed mt-1">{task.description}</p>
                      )}
                    </div>

                    <div className="flex gap-4 text-xs font-semibold py-2 border-t border-b border-slate-800/80 my-1">
                      <span className="text-emerald-400">💰 בסיס: {Number(task.basePrice)} ₪</span>
                      <span className="text-purple-400">✨ בונוס גג: {Number(task.maxBonusPrice)} ₪</span>
                    </div>

                    {/* === טאב מחכות לאישור === */}
                    {activeTab === 'pending-approval' && task.submission && (
                      <div className="flex flex-col gap-3 pt-2 bg-slate-900/40 p-3 rounded-xl ring-1 ring-slate-700/30">
                        {task.submission.photoUrls && task.submission.photoUrls.length > 0 && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] text-slate-400 font-medium">📸 הוכחות ויזואליות מהילד:</span>
                            <div className="flex gap-2 overflow-x-auto py-1">
                              {task.submission.photoUrls.map((url, idx) => (
                                <img key={idx} src={resolvePhotoUrl(url)} alt="הוכחה" className="w-20 h-20 object-cover rounded-lg border border-slate-700" />
                              ))}
                            </div>
                          </div>
                        )}
                        {task.submission.aiSummary && (
                          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800 text-right">
                            <span className="text-indigo-400 font-bold flex items-center gap-1 text-[11px]">🤖 המלצת ה-AI:</span>
                            <div className="bg-slate-950/50 border border-slate-800 p-3 rounded-xl flex flex-col gap-2">
                              <div className="text-[11px] font-bold text-indigo-300 bg-indigo-500/5 border border-indigo-500/10 px-2 py-1 rounded-md w-fit">
                                🎯 ציון מומלץ: {task.submission.aiSummary.recommendedScore}/100
                              </div>
                              <p className="text-slate-300 text-[11px] leading-relaxed"><strong className="text-slate-400 block mb-0.5">🧐 נימוק:</strong>{task.submission.aiSummary.reasoning}</p>
                              <p className="text-slate-400 text-[10px] italic border-t border-slate-800/60 pt-1.5 mt-0.5">"משוב: {task.submission.aiSummary.summary}"</p>
                            </div>
                          </div>
                        )}

                        {isReviewing ? (
                          <form onSubmit={handleReviewSubmit} className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                            {reviewMode === 'approve' ? (
                              <div className="flex flex-col gap-1">
                                <label className="text-[11px] text-slate-300 font-medium">🎯 ציון איכות (0–100)</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={scoreInput}
                                  onChange={(e) => setScoreInput(e.target.value)}
                                  className="p-2 bg-slate-800 rounded-lg text-white ring-1 ring-slate-700 focus:outline-none text-left"
                                  required
                                  disabled={reviewLoading}
                                />
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <label className="text-[11px] text-slate-300 font-medium">💬 מה צריך לתקן?</label>
                                <textarea
                                  value={rejectionNoteInput}
                                  onChange={(e) => setRejectionNoteInput(e.target.value)}
                                  placeholder="לדוגמה: לא ניקית מתחת למיטה, אפשר לצלם שוב אחרי שמסדרים גם שם"
                                  className="p-2 bg-slate-800 rounded-lg text-white ring-1 ring-slate-700 h-16 resize-none focus:outline-none"
                                  required
                                  disabled={reviewLoading}
                                />
                              </div>
                            )}
                            <div className="flex gap-2 justify-end">
                              <button type="button" onClick={cancelReview} disabled={reviewLoading} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg font-bold text-[11px]">ביטול</button>
                              <button
                                type="submit"
                                disabled={reviewLoading}
                                className={`px-4 py-1.5 rounded-lg font-black text-[11px] text-white shadow-md transition-all disabled:opacity-40 ${
                                  reviewMode === 'approve' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'
                                }`}
                              >
                                {reviewLoading ? 'שולח...' : reviewMode === 'approve' ? 'אשר ושלם 🎉' : 'שלח לתיקון 🔧'}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startReview(task, 'approve')}
                              className="flex-1 py-1.5 mt-1 rounded-lg bg-emerald-500 text-white font-bold text-xs shadow-md hover:bg-emerald-600 transition-all"
                            >
                              ✅ אשר ותן ציון
                            </button>
                            <button
                              type="button"
                              onClick={() => startReview(task, 'reject')}
                              className="flex-1 py-1.5 mt-1 rounded-lg bg-rose-500/90 text-white font-bold text-xs shadow-md hover:bg-rose-600 transition-all"
                            >
                              🔧 שלח לתיקון
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* === טאב חזרו לתיקון === */}
                    {activeTab === 'needs-fixing' && (
                      <div className="flex flex-col gap-2 pt-2 bg-rose-950/10 p-3 rounded-xl ring-1 ring-rose-800/30">
                        <span className="text-[11px] text-rose-300 font-bold">💬 ההערה שנשלחה לילד:</span>
                        <p className="text-slate-300 text-[11px] leading-relaxed">{task.rejectionNote || '—'}</p>
                        {task.rejectionCount > 1 && (
                          <span className="text-[10px] text-slate-500">נשלח לתיקון {task.rejectionCount} פעמים</span>
                        )}
                      </div>
                    )}

                    {/* === טאב משימות שאושרו === */}
                    {activeTab === 'approved' && (
                      <div className="flex flex-col gap-2 pt-2 bg-slate-900/20 p-3 rounded-xl ring-1 ring-slate-800">
                        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-center">
                          <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 p-2 rounded-lg">🎯 ציון איכות: {task.finalScore}/100</div>
                          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-2 rounded-lg">🎁 בונוס שניתן: {Number(task.awardedBonus || 0).toFixed(2)} ₪</div>
                        </div>
                        {task.submission?.aiSummary && (
                          <div className="flex flex-col gap-1 text-[11px] leading-normal pt-2 border-t border-slate-800 text-slate-400">
                            <span className="font-semibold text-slate-500">🤖 משוב ה-AI שנשמר:</span>
                            <p className="italic text-slate-400 font-medium">"{task.submission.aiSummary.summary}"</p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
