import React, { useState, useEffect, useMemo } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';
import axios from 'axios';
import api from '../services/api';
import { usePolling } from '../hooks/usePolling';
import RewardCard from './RewardCard';
import PendingFulfillmentCard from './PendingFulfillmentCard';
import MessageBanner from './MessageBanner';
import { searchCatalogItems, type MarketplaceCatalogItem } from '../data/marketplaceCatalog';
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
  imageUrl: '',
  targetChildId: '',
};

/**
 * Parent's rewards workspace: a step-by-step publish form (marketplace items
 * chosen from a live-search catalog picker, never a pasted URL), the active
 * reward catalog, a dedicated fulfillment queue for purchases that still need
 * to be handed over, and a collapsible history of what's already been
 * delivered.
 */
export default function ParentRewardsPanel(): React.ReactNode {
  const [rewards, setRewards] = useState<RewardDto[]>([]);
  const [children, setChildren] = useState<FamilyChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // בורר החיפוש החי של קטלוג המוצרים (מוצג רק כשהקטגוריה היא "מוצר אמיתי מחנות")
  const [catalogQuery, setCatalogQuery] = useState('');
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<MarketplaceCatalogItem | null>(null);

  // ⏳ פרסים ממתינים למימוש: מזהי תגמולים שבתהליך סימון כ"סופק" ברגע זה
  const [fulfillingIds, setFulfillingIds] = useState<Set<string>>(new Set());
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const catalogResults = useMemo(() => searchCatalogItems(catalogQuery), [catalogQuery]);

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

    // מעבר קטגוריה מנקה את בחירת הקטלוג ואת השדות שנבעו ממנה
    if (name === 'category') {
      setSelectedCatalogItem(null);
      setCatalogQuery('');
      setForm((prev) => ({ ...prev, category: value as RewardCategory, title: '', description: '', imageUrl: '', affiliateUrl: '' }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectCatalogItem = (item: MarketplaceCatalogItem) => {
    setSelectedCatalogItem(item);
    setForm((prev) => ({
      ...prev,
      title: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      affiliateUrl: item.affiliateUrl,
    }));
  };

  const handleClearCatalogSelection = () => {
    setSelectedCatalogItem(null);
    setCatalogQuery('');
    setForm((prev) => ({ ...prev, title: '', description: '', imageUrl: '', affiliateUrl: '' }));
  };

  const handleCreate = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.targetAmount) return;
    if (form.category === 'marketplace' && !selectedCatalogItem) return;

    setFormLoading(true);
    try {
      await api.post('/api/rewards', {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        type: form.type,
        targetAmount: Number(form.targetAmount),
        affiliateUrl: form.category === 'marketplace' ? form.affiliateUrl.trim() : undefined,
        imageUrl: form.category === 'marketplace' ? form.imageUrl.trim() : undefined,
        targetChildId: form.type === 'individual' ? form.targetChildId || undefined : undefined,
      });

      setMessage({ type: 'success', text: `התגמול "${form.title.trim()}" פורסם בהצלחה לחנות! 🎉` });
      setForm(emptyForm);
      setSelectedCatalogItem(null);
      setCatalogQuery('');
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

  /**
   * סימון פרס כ"סופק" — עדכון אופטימי: הכרטיס נעלם מיד מתור ה"ממתין למימוש"
   * ועובר להיסטוריה, עוד לפני שהתשובה מהשרת חזרה. אם הבקשה נכשלת, המצב חוזר
   * לאחור ומוצגת שגיאה.
   */
  const handleFulfillPurchase = async (rewardId: string) => {
    if (fulfillingIds.has(rewardId)) return;

    const previousRewards = rewards;
    setFulfillingIds((prev) => new Set(prev).add(rewardId));
    setRewards((prev) =>
      prev.map((r) => (r.id === rewardId ? { ...r, status: 'fulfilled', fulfilledAt: new Date().toISOString() } : r)),
    );

    try {
      await api.post(`/api/rewards/${rewardId}/fulfill`);
      await fetchRewards();
    } catch (err: unknown) {
      setRewards(previousRewards);
      let errorMessage = 'שגיאה בסימון התגמול כמומש';
      if (axios.isAxiosError(err)) errorMessage = err.response?.data?.error || err.message;
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setFulfillingIds((prev) => {
        const next = new Set(prev);
        next.delete(rewardId);
        return next;
      });
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

  const activeRewards = rewards.filter((r) => r.status === 'active');
  const pendingFulfillment = rewards.filter((r) => r.status === 'completed');
  const fulfilledHistory = rewards.filter((r) => r.status === 'fulfilled');

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
              <label className="text-slate-200 text-sm font-medium">קטגוריה</label>
              <select
                name="category"
                value={form.category}
                onChange={handleInputChange}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm font-medium"
                disabled={formLoading}
              >
                <option value="household">🏠 תגמול שווה לילד</option>
                <option value="marketplace">🛒 מוצר אמיתי מחנות</option>
              </select>
            </div>

            {form.category === 'household' ? (
              <>
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
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="text-slate-200 text-sm font-medium">בחירת מוצר מהקטלוג</label>

                {selectedCatalogItem ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800 ring-1 ring-indigo-500/40">
                    <img
                      src={selectedCatalogItem.imageUrl}
                      alt={selectedCatalogItem.title}
                      className="w-12 h-12 rounded-lg object-cover ring-1 ring-slate-700"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-bold truncate">{selectedCatalogItem.title}</p>
                      <p className="text-slate-400 text-[11px] truncate">{selectedCatalogItem.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearCatalogSelection}
                      disabled={formLoading}
                      className="shrink-0 px-3 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-bold transition-all"
                    >
                      🔄 שנה מוצר
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={catalogQuery}
                      onChange={(e) => setCatalogQuery(e.target.value)}
                      placeholder="🔍 חפש צעצוע, משחק או שובר..."
                      className="w-full px-4 py-2.5 rounded-lg bg-slate-800 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                      disabled={formLoading}
                    />

                    {!catalogQuery.trim() && (
                      <p className="text-[10px] text-slate-500">✨ מוצרים מומלצים — או התחילו להקליד לחיפוש</p>
                    )}

                    {catalogResults.length === 0 ? (
                      <div className="text-center py-4 bg-slate-800/40 rounded-xl text-slate-500 text-xs">
                        לא נמצאו מוצרים תואמים לחיפוש 🔍
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                        {catalogResults.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectCatalogItem(item)}
                            disabled={formLoading}
                            className="flex flex-col items-start gap-1.5 p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 ring-1 ring-slate-700 hover:ring-indigo-400 transition-all text-right"
                          >
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="w-full h-16 rounded-lg object-cover ring-1 ring-slate-700/60"
                            />
                            <span className="text-white text-[11px] font-bold leading-tight">{item.title}</span>
                            <span className="text-slate-400 text-[10px] leading-snug line-clamp-2">{item.description}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
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
              disabled={
                formLoading ||
                !form.title.trim() ||
                !form.targetAmount ||
                (form.category === 'marketplace' && !selectedCatalogItem)
              }
              className="w-full py-3 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-bold shadow-lg hover:from-violet-600 hover:to-indigo-600 transition-all disabled:opacity-50"
            >
              {formLoading ? 'מפרסם תגמול...' : 'פרסם תגמול לחנות 🚀'}
            </button>
          </div>
        </form>
      </section>

      {/* ⏳ פרסים ממתינים למימוש */}
      {pendingFulfillment.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-amber-300 flex items-center gap-2">
            <span>⏳</span> פרסים ממתינים למימוש ({pendingFulfillment.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingFulfillment.map((reward) => (
              <PendingFulfillmentCard
                key={reward.id}
                reward={reward}
                onFulfill={() => handleFulfillPurchase(reward.id)}
                busy={fulfillingIds.has(reward.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* קטלוג התגמולים הפעילים */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-slate-300 flex items-center gap-2">
          <span>📋</span> קטלוג התגמולים הפעילים ({activeRewards.length})
        </h2>
        {activeRewards.length === 0 ? (
          <div className="text-center py-8 bg-slate-800/10 border border-slate-800 rounded-2xl text-slate-500 text-xs">
            עדיין לא פרסמתם תגמולים. השתמשו בטופס למעלה כדי להתחיל! 🎁
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeRewards.map((reward) => (
              <RewardCard key={reward.id} reward={reward} mode="parent" onArchive={() => handleArchive(reward.id)} />
            ))}
          </div>
        )}
      </section>

      {/* ✅ היסטוריית פרסים שסופקו — מוצג מכווץ כברירת מחדל, כדי לשמור על דשבורד נקי */}
      {fulfilledHistory.length > 0 && (
        <section className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setHistoryExpanded((prev) => !prev)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-slate-800/30 hover:bg-slate-800/50 border border-slate-800 transition-all"
          >
            <h2 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <span>✅</span> היסטוריית פרסים שסופקו ({fulfilledHistory.length})
            </h2>
            <span className={`text-slate-400 text-xs transition-transform ${historyExpanded ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {historyExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fulfilledHistory.map((reward) => (
                <PendingFulfillmentCard key={reward.id} reward={reward} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
