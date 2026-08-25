import React, { useState, useEffect } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';
import axios from 'axios';
import api from '../services/api';
import { usePolling } from '../hooks/usePolling';
import RewardCard from './RewardCard';
import MessageBanner from './MessageBanner';
import type { RewardDto, RewardCategory, RewardType } from '../types/reward';

interface FamilyChild {
  id: string;
  name: string;
  role: 'parent' | 'child';
}

const emptyForm = {
  title: '',
  description: '',
  category: 'household' as RewardCategory,
  type: 'collaborative' as RewardType,
  targetAmount: '',
  affiliateUrl: '',
  targetChildId: '',
};

/**
 * Parent's rewards workspace: a step-by-step publish form, plus the full
 * family catalog (every reward, not just this parent's own) with fulfill /
 * archive actions via the shared RewardCard.
 */
export default function ParentRewardsPanel(): React.ReactNode {
  const [rewards, setRewards] = useState<RewardDto[]>([]);
  const [children, setChildren] = useState<FamilyChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRewards = async () => {
    try {
      const response = await api.get('/api/rewards');
      setRewards(response.data.rewards || []);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadInitial = async () => {
      await fetchRewards();
      try {
        const membersRes = await api.get('/api/tasks/family-members');
        const allMembers: FamilyChild[] = membersRes.data.members || [];
        setChildren(allMembers.filter((m) => m.role === 'child'));
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) console.error(err.message);
      }
    };
    loadInitial();
  }, []);

  usePolling(fetchRewards);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreate = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.targetAmount) return;

    setFormLoading(true);
    try {
      await api.post('/api/rewards', {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        type: form.type,
        targetAmount: Number(form.targetAmount),
        affiliateUrl: form.category === 'marketplace' ? form.affiliateUrl.trim() : undefined,
        targetChildId: form.type === 'individual' ? form.targetChildId || undefined : undefined,
      });

      setMessage({ type: 'success', text: `התגמול "${form.title.trim()}" פורסם בהצלחה לחנות! 🎉` });
      setForm(emptyForm);
      await fetchRewards();
    } catch (err: unknown) {
      let errorMessage = 'שגיאה בפרסום התגמול';
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || err.message;
      }
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setFormLoading(false);
    }
  };

  const handleFulfill = async (rewardId: string) => {
    try {
      await api.post(`/api/rewards/${rewardId}/fulfill`);
      await fetchRewards();
    } catch (err: unknown) {
      let errorMessage = 'שגיאה בסימון התגמול כמומש';
      if (axios.isAxiosError(err)) errorMessage = err.response?.data?.error || err.message;
      setMessage({ type: 'error', text: errorMessage });
    }
  };

  const handleArchive = async (rewardId: string) => {
    try {
      const response = await api.post(`/api/rewards/${rewardId}/archive`);
      setMessage({ type: 'success', text: response.data.message });
      await fetchRewards();
    } catch (err: unknown) {
      let errorMessage = 'שגיאה בביטול התגמול';
      if (axios.isAxiosError(err)) errorMessage = err.response?.data?.error || err.message;
      setMessage({ type: 'error', text: errorMessage });
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-slate-400 text-sm animate-pulse">טוען את חנות הפרסים...</div>;
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {message && <MessageBanner type={message.type} text={message.text} onDismiss={() => setMessage(null)} />}

      {/* טופס פרסום תגמול חדש */}
      <section className="bg-gradient-to-b from-slate-800/60 to-slate-900/60 border border-slate-700/60 p-6 rounded-2xl shadow-xl flex flex-col gap-4">
        <h2 className="text-lg font-bold text-slate-300 flex items-center gap-2">
          <span>🎁</span> פרסום תגמול חדש לחנות
        </h2>

        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-slate-200 text-sm font-medium">שם התגמול</label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleInputChange}
                placeholder="לדוגמה: שעה נוספת פלייסטיישן"
                className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                required
                disabled={formLoading}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-200 text-sm font-medium">תיאור</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleInputChange}
                placeholder="פרטים נוספים על התגמול..."
                className="w-full h-20 px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm resize-none"
                disabled={formLoading}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-200 text-sm font-medium">קטגוריה</label>
              <select
                name="category"
                value={form.category}
                onChange={handleInputChange}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm font-medium"
                disabled={formLoading}
              >
                <option value="household">🏠 תגמול שווה מהבית (חינם)</option>
                <option value="marketplace">🛒 חנות צעצועים וממתקים (מוצר אמיתי)</option>
              </select>
            </div>

            {form.category === 'marketplace' && (
              <div className="flex flex-col gap-1">
                <label className="text-slate-200 text-sm font-medium">קישור למוצר (affiliate)</label>
                <input
                  type="url"
                  name="affiliateUrl"
                  value={form.affiliateUrl}
                  onChange={handleInputChange}
                  placeholder="https://..."
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm text-left"
                  required={form.category === 'marketplace'}
                  disabled={formLoading}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-slate-200 text-sm font-medium">💰 מחיר (מטבעות)</label>
                <input
                  type="number"
                  name="targetAmount"
                  step="0.01"
                  value={form.targetAmount}
                  onChange={handleInputChange}
                  placeholder="100"
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm text-left"
                  required
                  disabled={formLoading}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-slate-200 text-sm font-medium">סוג הפרס</label>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 ring-1 ring-slate-700 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="type"
                    value="collaborative"
                    checked={form.type === 'collaborative'}
                    onChange={handleInputChange}
                    disabled={formLoading}
                  />
                  👪 פרס משפחתי שיתופי (לכל הילדים)
                </label>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 ring-1 ring-slate-700 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="type"
                    value="individual"
                    checked={form.type === 'individual'}
                    onChange={handleInputChange}
                    disabled={formLoading}
                  />
                  👤 פרס אישי ליחיד
                </label>

                {form.type === 'individual' && (
                  <select
                    name="targetChildId"
                    value={form.targetChildId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm font-medium"
                    required={form.type === 'individual'}
                    disabled={formLoading}
                  >
                    <option value="">בחרו ילד/ה...</option>
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>👦 {c.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={formLoading || !form.title.trim() || !form.targetAmount}
              className="w-full py-3 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-bold shadow-lg hover:from-violet-600 hover:to-indigo-600 transition-all disabled:opacity-50"
            >
              {formLoading ? 'מפרסם תגמול...' : 'פרסם תגמול לחנות 🚀'}
            </button>
          </div>
        </form>
      </section>

      {/* קטלוג ניהול התגמולים */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-slate-300 flex items-center gap-2">
          <span>📋</span> קטלוג התגמולים ({rewards.length})
        </h2>
        {rewards.length === 0 ? (
          <div className="text-center py-8 bg-slate-800/10 border border-slate-800 rounded-2xl text-slate-500 text-xs">
            עדיין לא פרסמתם תגמולים. השתמשו בטופס למעלה כדי להתחיל! 🎁
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rewards.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                mode="parent"
                onFulfill={() => handleFulfill(reward.id)}
                onArchive={() => handleArchive(reward.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
