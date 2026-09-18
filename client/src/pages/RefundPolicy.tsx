import React from 'react';
import LegalDocumentLayout, { type LegalSection } from '../components/LegalDocumentLayout';

const CONTACT_EMAIL = 'chorechampssupport@gmail.com';

/**
 * Deliberately defers refund eligibility/decisions to Paddle rather than
 * stating an independent ChoreChamps-specific refund window: Paddle.com is
 * the Merchant of Record for every transaction (see Payments and Billing in
 * TermsOfService.tsx), so it is Paddle's own buyer refund policy that
 * actually governs what a customer is entitled to — a competing,
 * independently-stated window here could contradict it. What this page
 * commits to instead is only what ChoreChamps itself actually controls:
 * self-service cancellation (real, shipped — the Paddle Customer Portal and
 * the profile-settings account deletion) and what happens to access after
 * cancelling.
 */

const SECTIONS_HE: LegalSection[] = [
  {
    heading: 'ביטול מנוי',
    body: [
      'ניתן לבטל את המנוי בעצמכם, בכל עת, דרך פורטל ניהול המנוי של Paddle (נגיש מהגדרות הפרופיל בתוך האפליקציה — כפתור "ניהול מנוי ותשלומים"), או בפנייה לתמיכה בכתובת ' +
        CONTACT_EMAIL +
        '. הגישה למסלול הפרימיום נמשכת עד לסוף תקופת החיוב ששולמה — ביטול אינו מפסיק גישה באופן מיידי.',
    ],
  },
  {
    heading: 'מדיניות החזרים כספיים',
    body: [
      'Paddle.com הוא ה-Merchant of Record של כל עסקה באפליקציה זו — כלומר Paddle, לא ChoreChamps, הוא הצד המשפטי שמוכר לך את המנוי ומטפל בתשלום. משמעות הדבר היא שזכאות להחזר כספי, ומדיניות ההחזרים הפעילה בפועל, נקבעות על ידי המדיניות הרשמית של Paddle לרוכשים — ולא על ידי מדיניות עצמאית שChoreChamps קובעת בפני עצמה.',
      'כדי לבקש החזר: הדרך המהירה ביותר היא באמצעות הקבלה שקיבלתם באימייל מ-Paddle בעת הרכישה — היא מכילה קישור ישיר לבקשת החזר/תמיכה מול Paddle. אפשר גם לפנות אלינו בכתובת ' +
        CONTACT_EMAIL +
        ' ואנחנו נעביר את הבקשה או נכוון אתכם לגורם הנכון ב-Paddle.',
    ],
  },
  {
    heading: 'החלפת מסלול חיוב (חודשי/שנתי) וביטול באמצע תקופה',
    body: [
      'אין זיכוי חלקי (Proration) אוטומטי על הזמן שלא נוצל בתקופת חיוב שכבר שולמה, מעבר למדיניות הרגילה של Paddle. ביטול באמצע חודש או שנה משמעו שהגישה למסלול הפרימיום ממשיכה עד לתום התקופה ששולמה, ולאחר מכן המשפחה עוברת אוטומטית למסלול החינמי — הנתונים והחשבון עצמם אינם נמחקים.',
    ],
  },
  {
    heading: 'יצירת קשר',
    body: [
      'שאלות בנוגע לביטול, חיובים או החזרים: ' + CONTACT_EMAIL + '.',
    ],
  },
];

const SECTIONS_EN: LegalSection[] = [
  {
    heading: 'Cancelling Your Subscription',
    body: [
      'You can cancel your subscription yourself, at any time, through Paddle\'s Customer Portal (reachable from in-app profile settings — the "Manage subscription and billing" button), or by contacting support at ' +
        CONTACT_EMAIL +
        '. Access to the Premium plan continues until the end of the billing period you already paid for — cancelling does not cut off access immediately.',
    ],
  },
  {
    heading: 'Refund Policy',
    body: [
      'Paddle.com is the Merchant of Record for every transaction in this app — meaning Paddle, not ChoreChamps, is the legal seller of your subscription and the party handling payment. As a result, refund eligibility and the refund policy actually in effect are governed by Paddle\'s own official buyer policy, not by an independent policy ChoreChamps sets on its own.',
      'To request a refund: the fastest way is via the receipt Paddle emailed you at the time of purchase — it contains a direct link to request support/a refund from Paddle. You can also contact us at ' +
        CONTACT_EMAIL +
        ' and we will forward your request or point you to the right place with Paddle.',
    ],
  },
  {
    heading: 'Switching Billing Frequency (Monthly/Annual) and Mid-Cycle Cancellation',
    body: [
      'There is no automatic proration/partial refund for unused time within an already-paid billing period, beyond Paddle\'s standard policy. Cancelling mid-month or mid-year means Premium access continues until the end of the period already paid for, after which the household automatically reverts to the Free plan — your account and data are not deleted.',
    ],
  },
  {
    heading: 'Contact',
    body: ['Questions about cancellation, billing, or refunds: ' + CONTACT_EMAIL + '.'],
  },
];

export default function RefundPolicy(): React.ReactNode {
  return (
    <LegalDocumentLayout
      titleHe="מדיניות ביטול והחזרים של ChoreChamps"
      titleEn="ChoreChamps Refund and Cancellation Policy"
      updatedLabelHe="עודכן לאחרונה: ספטמבר 2026"
      updatedLabelEn="Last updated: September 2026"
      sectionsHe={SECTIONS_HE}
      sectionsEn={SECTIONS_EN}
      contactEmail={CONTACT_EMAIL}
    />
  );
}
