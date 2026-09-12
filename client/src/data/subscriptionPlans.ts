import type { SubscriptionTier } from '../types/family';

export interface PlanCard {
  tier: SubscriptionTier;
  name: string;
  price: string;
  priceNote: string;
  features: string[];
  highlight?: boolean;
}

/**
 * Single source of truth for what each subscription tier actually includes —
 * used by both SubscriptionPage (the real purchase flow) and LandingPage (the
 * marketing comparison), so the two can never drift into advertising
 * different features/limits than what the app actually enforces.
 */
export const PLANS: PlanCard[] = [
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
