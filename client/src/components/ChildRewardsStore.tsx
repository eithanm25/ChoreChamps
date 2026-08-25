import React, { useState, useEffect } from 'react';
import axios from 'axios';
import api from '../services/api';
import { usePolling } from '../hooks/usePolling';
import RewardCard from './RewardCard';
import MessageBanner from './MessageBanner';
import type { RewardDto, RewardCategory } from '../types/reward';
import type { SafeUser } from '../App';

interface ChildRewardsStoreProps {
  user: SafeUser;
  /** Spendable ChoreCoins right now (ChildProfile.lifetimeEarnings minus active reward contributions). */
  balance: number;
}

type RewardTypeTab = 'individual' | 'collaborative';
type CategoryFilter = 'all' | RewardCategory;

/**
 * The child's rewards store tab: a dual toggle between "my own rewards" and
 * "the family's shared crowdfunding goal", each further filterable by
 * category (free household perks vs real marketplace products). The server
 * already scopes individual rewards to this child only (never a sibling's) —
 * this component just splits what it receives by type/category for display.
 */
export default function ChildRewardsStore({ user, balance }: ChildRewardsStoreProps): React.ReactNode {
  const [rewards, setRewards] = useState<RewardDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeTab, setTypeTab] = useState<RewardTypeTab>('collaborative');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
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
    };
    loadInitial();
  }, []);

  // מתעדכן אוטומטית כשבן משפחה אחר תורם ליעד המשותף, בלי רענון ידני
  usePolling(fetchRewards);

  const handleContribute = async (rewardId: string, amount: number) => {
    try {
      const response = await api.post(`/api/rewards/${rewardId}/contribute`, { amount });
      setMessage({ type: 'success', text: response.data.message });
      await fetchRewards();
    } catch (err: unknown) {
      let errorText = 'שגיאה בשליחת התרומה';
      if (axios.isAxiosError(err)) {
        errorText = err.response?.data?.error || err.message;
      }
      setMessage({ type: 'error', text: errorText });
      throw err;
    }
  };

  const individualRewards = rewards.filter((r) => r.type === 'individual');
  const collaborativeRewards = rewards.filter((r) => r.type === 'collaborative');
  const activeList = typeTab === 'individual' ? individualRewards : collaborativeRewards;
  const filteredList = categoryFilter === 'all' ? activeList : activeList.filter((r) => r.category === categoryFilter);

  const categoryTabs: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: '✨ הכל' },
    { key: 'household', label: '🏠 תגמולים שווים מהבית' },
    { key: 'marketplace', label: '🛒 חנות צעצועים וממתקים' },
  ];

  if (loading) {
    return <div className="p-6 text-center text-slate-400 text-sm animate-pulse">טוען את חנות הפרסים...</div>;
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {message && <MessageBanner type={message.type} text={message.text} onDismiss={() => setMessage(null)} />}

      {/* קפסולה כפולה: אישי מול משותף */}
      <nav className="bg-slate-800/40 p-1 rounded-full ring-1 ring-slate-700/40 flex text-xs font-bold">
        <button
          type="button"
          onClick={() => setTypeTab('individual')}
          className={`flex-1 py-2 rounded-full transition-all ${typeTab === 'individual' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400'}`}
        >
          👦 פרסים אישיים בשבילי {individualRewards.length > 0 && `(${individualRewards.length})`}
        </button>
        <button
          type="button"
          onClick={() => setTypeTab('collaborative')}
          className={`flex-1 py-2 rounded-full transition-all ${typeTab === 'collaborative' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400'}`}
        >
          👥 יעד משפחתי משותף {collaborativeRewards.length > 0 && `(${collaborativeRewards.length})`}
        </button>
      </nav>

      {/* תגי סינון לפי קטגוריה */}
      <div className="flex gap-2 flex-wrap">
        {categoryTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setCategoryFilter(tab.key)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
              categoryFilter === tab.key
                ? 'bg-violet-500 text-white border-violet-400 shadow-md'
                : 'bg-slate-800/40 text-slate-400 border-slate-700/50 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredList.length === 0 ? (
        <div className="text-center py-10 bg-slate-800/10 border border-slate-800 rounded-2xl text-slate-500 text-xs">
          {typeTab === 'individual'
            ? 'עדיין אין לך פרסים אישיים בקטלוג. בקשו מההורים להוסיף אחד! 🎁'
            : 'עדיין אין יעד משפחתי משותף פעיל. בקשו מההורים ליצור אחד! 👨‍👩‍👧‍👦'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredList.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              mode="child"
              currentChildId={user.id}
              currentBalance={balance}
              onContribute={(amount) => handleContribute(reward.id, amount)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
