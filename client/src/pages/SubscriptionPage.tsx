import React from 'react';
import type { SubscriptionTier } from '../types/family';

interface SubscriptionPageProps {
  currentTier: SubscriptionTier;
  onClose: () => void;
}

interface PlanCard {
  tier: SubscriptionTier;
  name: string;
  price: string;
  priceNote: string;
  features: string[];
  highlight?: boolean;
}

const PLANS: PlanCard[] = [
  {
    tier: 'free',
    name: 'FREE',
    price: '0₪',
    priceNote: 'לתמיד',
    features: [
      '5 בדיקות AI',
      'עד תמונת ייחוס אחת להורה למשימה',
      'עד 3 תמונות הוכחה לילד למשימה',
      'ניהול משימות ותגמולים בסיסי',
      'חנות פרסים ביתית (תגמולים שווים)',
    ],
  },
  {
    tier: 'premium',
    name: 'CHAMP PREMIUM',
    price: '19₪',
    priceNote: 'לחודש',
    features: [
      'בדיקות AI ללא הגבלה 🤖',
      'עד 3 תמונות ייחוס להורה למשימה',
      'עד 5 תמונות הוכחה לילד למשימה',
      'כל התכונות של המסלול החינמי',
    ],
    highlight: true,
  },
  {
    tier: 'academy',
    name: 'CHAMP ACADEMY',
    price: '39₪',
    priceNote: 'לחודש',
    features: [
      'כל התכונות של Premium',
      'העלאת קבצי PDF ודפי עבודה מרובי-עמודים 📄',
      'ארנק משפחתי — העברות מטבעות בין אחים 💸',
      'זיכוי וחיוב ישיר של הורה לילד (בונוסים/קנסות)',
    ],
  },
];

/**
 * Full-screen comparative pricing overlay — reached only from a parent's
 * profile settings, and only while the family is still on FREE (see
 * ProfileSettingsPanel). Purchase buttons are placeholders: real checkout
 * wires into Paddle's overlay once this deploys to production.
 */
export default function SubscriptionPage({ currentTier, onClose }: SubscriptionPageProps): React.ReactNode {
  const handlePurchase = (tier: SubscriptionTier) => {
    // TODO: hook up to the Paddle SDK checkout overlay once deployed to production.
    console.log('[checkout] placeholder purchase click for tier:', tier);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto" dir="rtl">
      <div className="max-w-5xl mx-auto p-6 flex flex-col gap-8">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-indigo-400">
              שדרגו את המשפחה שלכם 🚀
            </h1>
            <p className="text-slate-400 text-sm mt-1">בחרו את המסלול שמתאים לכם — אפשר לשדרג בכל רגע</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="סגירה"
            className="shrink-0 w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-lg font-black transition-all"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((plan) => {
            const isActive = plan.tier === currentTier;
            return (
              <div
                key={plan.tier}
                className={`relative rounded-3xl p-6 flex flex-col gap-4 border transition-all ${
                  plan.highlight
                    ? 'bg-gradient-to-b from-indigo-950/60 to-slate-900 border-indigo-500/40 shadow-2xl shadow-indigo-500/10 md:scale-105'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-[10px] font-black shadow-lg">
                    🔥 הכי פופולרי
                  </span>
                )}

                <div>
                  <h3 className="text-white font-black text-xl">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-black text-white">{plan.price}</span>
                    <span className="text-slate-400 text-xs">{plan.priceNote}</span>
                  </div>
                </div>

                <ul className="flex flex-col gap-2 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-slate-300 text-xs leading-relaxed">
                      <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {isActive ? (
                  <span className="w-full py-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black text-center">
                    ✨ המסלול הפעיל שלכם כרגע
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePurchase(plan.tier)}
                    className={`w-full py-2.5 rounded-full text-sm font-black shadow-lg transition-all ${
                      plan.highlight
                        ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-600 hover:to-violet-600'
                        : 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 hover:brightness-105'
                    }`}
                  >
                    קנה עכשיו 🚀
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
