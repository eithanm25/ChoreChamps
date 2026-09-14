import type { SubscriptionTier } from '../types/family';

export interface PlanCard {
  tier: SubscriptionTier;
  name: string;
  price: string;
  priceNote: string;
  features: string[];
  highlight?: boolean;
}

export type BillingInterval = 'month' | 'year';

export interface PremiumBillingOption {
  interval: BillingInterval;
  label: string;
  price: number;
  priceLabel: string;
  intervalLabel: string;
}

/** The one paid tier's two billing frequencies — everything else on this page is derived from these two numbers. */
export const PREMIUM_MONTHLY_PRICE = 29.9;
export const PREMIUM_ANNUAL_PRICE = 280;

const ANNUAL_MONTHLY_EQUIVALENT = PREMIUM_ANNUAL_PRICE / 12;

/** ~22% — calculated (not hardcoded) so it stays correct if either price above ever changes. */
export const PREMIUM_ANNUAL_SAVINGS_PERCENT = Math.round(
  (1 - ANNUAL_MONTHLY_EQUIVALENT / PREMIUM_MONTHLY_PRICE) * 100,
);

/** ~6.6 ₪ — how much cheaper the annual plan works out per month vs. paying monthly, rounded to the nearest 10 agorot for display. */
export const PREMIUM_ANNUAL_SAVINGS_PER_MONTH =
  Math.round((PREMIUM_MONTHLY_PRICE - ANNUAL_MONTHLY_EQUIVALENT) * 10) / 10;

export const PREMIUM_BILLING_OPTIONS: Record<BillingInterval, PremiumBillingOption> = {
  month: {
    interval: 'month',
    label: 'חודשי',
    price: PREMIUM_MONTHLY_PRICE,
    priceLabel: `${PREMIUM_MONTHLY_PRICE.toFixed(2)} ₪`,
    intervalLabel: 'לחודש',
  },
  year: {
    interval: 'year',
    label: 'שנתי',
    price: PREMIUM_ANNUAL_PRICE,
    priceLabel: `${PREMIUM_ANNUAL_PRICE} ₪`,
    intervalLabel: `לשנה (בערך ${ANNUAL_MONTHLY_EQUIVALENT.toFixed(2)} ₪ לחודש)`,
  },
};

/** One sentence of dynamic savings copy for wherever the annual option is rendered. */
export const PREMIUM_ANNUAL_SAVINGS_COPY = `המסלול השנתי חוסך כ-${PREMIUM_ANNUAL_SAVINGS_PERCENT}% בסך הכל — כ-${PREMIUM_ANNUAL_SAVINGS_PER_MONTH.toFixed(
  1,
)} ₪ פחות בכל חודש בהשוואה לתשלום החודשי`;

/**
 * Single source of truth for what each subscription tier actually includes —
 * used by both SubscriptionPage (the real purchase flow) and LandingPage (the
 * marketing comparison), so the two can never drift into advertising
 * different features/limits than what the app actually enforces.
 *
 * There is one paid tier (PREMIUM), sold at two billing frequencies — see
 * PREMIUM_BILLING_OPTIONS above for the actual prices; `price`/`priceNote`
 * here just summarize both for a plain feature-comparison card.
 */
export const PLANS: PlanCard[] = [
  {
    tier: 'free',
    name: 'FREE',
    price: '0₪',
    priceNote: 'לתמיד, עם פרסומות',
    features: [
      '5 בדיקות AI',
      'עד תמונת ייחוס אחת להורה למשימה',
      'עד 3 תמונות הוכחה לילד למשימה',
      'ניהול משימות ותגמולים בסיסי',
      'חנות פרסים ביתית (תגמולים שווים)',
      'ארנק משפחתי מלא — העברות מטבעות בין הורה לילד/ה ובין אחים 💸',
    ],
  },
  {
    tier: 'premium',
    name: 'CHAMP PREMIUM',
    price: `${PREMIUM_BILLING_OPTIONS.month.priceLabel} / ${PREMIUM_BILLING_OPTIONS.year.priceLabel}`,
    priceNote: `לחודש או לשנה — ${PREMIUM_ANNUAL_SAVINGS_COPY}`,
    features: [
      'חוויה נקייה לחלוטין — בלי פרסומות',
      'Unlimited Claude AI Assistant 🤖 — ניתוח כל תמונת הוכחה מול תמונת הייחוס, עם סיכום מפורט, אחוזי הצלחה וציון מומלץ',
      'אישור משימה בקליק אחד — ההורה שומר על שליטה מלאה בלי לבדוק פיזית',
      'העלאת קבצי PDF ענקיים — פירוק חוברות עבודה שלמות של בית הספר למטלות בשניות 📄',
      'נפח אחסון מורחב לתמונות ייחוס',
    ],
    highlight: true,
  },
];
