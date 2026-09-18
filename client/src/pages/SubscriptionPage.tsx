import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { SubscriptionTier } from '../types/family';
import { openCheckout, priceIdForBilling } from '../services/paddle';
import MessageBanner from '../components/MessageBanner';
import PricingComparisonMatrix from '../components/PricingComparisonMatrix';
import {
  PLANS,
  PREMIUM_ANNUAL_SAVINGS_COPY,
  PREMIUM_ANNUAL_SAVINGS_PERCENT,
  PREMIUM_BILLING_OPTIONS,
  type BillingInterval,
} from '../data/subscriptionPlans';

interface SubscriptionPageProps {
  currentTier: SubscriptionTier;
  onClose: () => void;
  /** Round-trips through Paddle as custom_data so the webhook knows which family to upgrade. Purchase is disabled without it. */
  familyId: string | null;
  /** Pre-fills the Paddle checkout's customer email, when known. */
  email?: string;
}

/**
 * Full-screen comparative pricing overlay — reached only from a parent's
 * profile settings, and only while the family is still on FREE (see
 * ProfileSettingsPanel). One paid tier (Premium), sold at two billing
 * frequencies via the toggle below; purchase opens the real Paddle Checkout
 * overlay for whichever frequency is selected. Until the account's live
 * price IDs/client token are set in the environment (still placeholders —
 * see client/.env.example) it shows a friendly Hebrew message instead of a
 * broken checkout.
 */
export default function SubscriptionPage({ currentTier, onClose, familyId, email }: SubscriptionPageProps): React.ReactNode {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month');
  const [purchasing, setPurchasing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const freePlan = PLANS.find((plan) => plan.tier === 'free');
  const premiumPlan = PLANS.find((plan) => plan.tier === 'premium');
  const isPremiumActive = currentTier === 'premium';
  const selectedBilling = PREMIUM_BILLING_OPTIONS[billingInterval];

  const handlePurchase = async () => {
    setCheckoutError(null);

    if (!familyId) {
      setCheckoutError('לא נמצאה משפחה מחוברת — התחברו מחדש ונסו שוב');
      return;
    }

    const priceId = priceIdForBilling(billingInterval);
    if (!priceId) {
      setCheckoutError('התשלומים עדיין לא הוגדרו במערכת — נסו שוב בקרוב');
      return;
    }

    setPurchasing(true);
    try {
      await openCheckout({ priceId, familyId, email });
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'שגיאה בפתיחת מסך התשלום');
    } finally {
      setPurchasing(false);
    }
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

        {checkoutError && (
          <MessageBanner type="error" text={checkoutError} onDismiss={() => setCheckoutError(null)} />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* מסלול חינמי — סטטי, בלי כפתור רכישה */}
          {freePlan && (
            <div className="relative rounded-3xl p-6 flex flex-col gap-4 border bg-slate-900/60 border-slate-800">
              <div>
                <h3 className="text-white font-black text-xl">{freePlan.name}</h3>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black text-white">{freePlan.price}</span>
                  <span className="text-slate-400 text-xs">{freePlan.priceNote}</span>
                </div>
              </div>

              <ul className="flex flex-col gap-2 flex-1">
                {freePlan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-slate-300 text-xs leading-relaxed">
                    <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {currentTier === 'free' ? (
                <span className="w-full py-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black text-center">
                  ✨ המסלול הפעיל שלכם כרגע
                </span>
              ) : (
                <span className="w-full py-2.5 rounded-full bg-slate-800/60 border border-slate-700/50 text-slate-400 text-xs font-black text-center">
                  מסלול חינמי — זמין תמיד
                </span>
              )}
            </div>
          )}

          {/* מסלול פרימיום — כרטיס אחד, עם בורר תדירות חיוב חודשי/שנתי */}
          {premiumPlan && (
            <div className="relative rounded-3xl p-6 flex flex-col gap-4 border bg-gradient-to-b from-indigo-950/60 to-slate-900 border-indigo-500/40 shadow-2xl shadow-indigo-500/10">
              <span className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-[10px] font-black shadow-lg">
                🔥 הכי פופולרי
              </span>

              <div>
                <h3 className="text-white font-black text-xl">{premiumPlan.name}</h3>

                {/* בורר חודשי / שנתי */}
                <div className="flex gap-2 mt-3">
                  {(['month', 'year'] as const).map((interval) => {
                    const option = PREMIUM_BILLING_OPTIONS[interval];
                    const selected = billingInterval === interval;
                    return (
                      <button
                        key={interval}
                        type="button"
                        onClick={() => setBillingInterval(interval)}
                        className={`relative flex-1 py-2 rounded-full text-xs font-black transition-all ${
                          selected
                            ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg'
                            : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {option.label}
                        {interval === 'year' && (
                          <span className="absolute -top-2 -left-2 px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black shadow">
                            חיסכון {PREMIUM_ANNUAL_SAVINGS_PERCENT}%
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-3xl font-black text-white">{selectedBilling.priceLabel}</span>
                  <span className="text-slate-400 text-xs">{selectedBilling.intervalLabel}</span>
                </div>
                {billingInterval === 'year' && (
                  <p className="text-emerald-400 text-[11px] font-bold mt-1">{PREMIUM_ANNUAL_SAVINGS_COPY}</p>
                )}
              </div>

              <ul className="flex flex-col gap-2 flex-1">
                {premiumPlan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-slate-300 text-xs leading-relaxed">
                    <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {isPremiumActive ? (
                <span className="w-full py-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black text-center">
                  ✨ המסלול הפעיל שלכם כרגע
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className="w-full py-2.5 rounded-full text-sm font-black shadow-lg transition-all disabled:opacity-50 bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-600 hover:to-violet-600"
                >
                  {purchasing ? 'פותח מסך תשלום...' : 'קנה עכשיו 🚀'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-center text-white font-black text-lg sm:text-xl">למה שווה לשדרג? השוואה מלאה 👇</h2>
          <PricingComparisonMatrix />
        </div>

        <p className="text-center text-slate-500 text-[11px]">
          בהצטרפות למסלול בתשלום אתם מאשרים שקראתם ומסכימים ל
          <Link to="/terms" className="text-indigo-400 font-bold hover:text-indigo-300 mx-1">
            תנאי השימוש
          </Link>
          ,
          <Link to="/privacy" className="text-indigo-400 font-bold hover:text-indigo-300 mx-1">
            מדיניות הפרטיות
          </Link>
          ול
          <Link to="/refund-policy" className="text-indigo-400 font-bold hover:text-indigo-300 mx-1">
            מדיניות הביטול וההחזרים
          </Link>
          שלנו. התשלום מעובד ומאובטח על ידי Paddle.com.
        </p>
      </div>
    </div>
  );
}
