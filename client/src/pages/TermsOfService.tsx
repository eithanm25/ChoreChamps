import React from 'react';
import LegalDocumentLayout, { type LegalSection } from '../components/LegalDocumentLayout';

const CONTACT_EMAIL = 'chorechampssupport@gmail.com';

/**
 * Corrections made against what the app actually does (both languages), so
 * this document never promises something a real user can't actually get:
 *  - Single-tier pricing matched to data/subscriptionPlans.ts: one paid
 *    Premium plan, billed either ₪29.90/month or ₪280/year (there used to
 *    be a second, pricier Champ Academy plan — it was folded into Premium).
 *  - "Award stars" -> "award ChoreCoins": the app's currency is ChoreCoins
 *    everywhere in the UI; it never says "stars".
 *  - Cancellation is described as self-service via the real Paddle Customer
 *    Portal (POST /api/payments/portal-session, reachable from profile
 *    settings), and account deletion as self-service via the profile
 *    settings danger zone (DELETE /api/users/purge-account) — both are real,
 *    shipped features, not aspirational. Support email is kept only as a
 *    fallback for anyone who can't use either.
 */

const SECTIONS_HE: LegalSection[] = [
  {
    heading: 'השירות',
    body: [
      'ChoreChamps היא פלטפורמת תוכנה כשירות (SaaS) לגיימיקציה משפחתית וניהול מטלות ביתיות. משתמשים יכולים ליצור, לערוך, לארגן ולנהל מטלות ביתיות וחנויות פרסים משפחתיות מותאמות אישית דרך הפורטל שלנו.',
    ],
  },
  {
    heading: 'חשבונות',
    body: [
      'עליך לספק מידע מדויק בעת יצירת חשבון. אתה אחראי לשמירה על אבטחת פרטי ההתחברות שלך ועל כל הפעילות המתרחשת תחת חשבונך.',
    ],
  },
  {
    heading: 'מסלול חינמי ומסלול פרימיום',
    body: [
      'ChoreChamps מציעה מסלול חינמי (FREE) הכולל מספר מוגבל של בדיקות איכות מבוססות בינה מלאכותית, מכסת תמונות הוכחה/ייחוס למשימה, ארנק ChoreCoins מלא (העברות בין הורה לילד/ה ובין אחים) וכולל פרסומות. מסלול מנוי אחד בתשלום — Champ Premium — פותח חוויה נקייה לחלוטין מפרסומות, בדיקות AI ללא הגבלה, יותר תמונות ייחוס והוכחה למשימה, העלאת קבצי PDF ונפח אחסון מורחב לתמונות ייחוס. Premium נמכר בשתי תדירויות חיוב לבחירתך: 29.90 ₪ לחודש, או 280 ₪ לשנה (המסלול השנתי חוסך כ-22% בסך הכל, כ-6.6 ₪ פחות בכל חודש בהשוואה לתשלום החודשי). התמחור המלא והעדכני מוצג תמיד בממשק האפליקציה.',
    ],
  },
  {
    heading: 'תשלומים וחיובים',
    body: [
      'התשלומים מעובדים על ידי Paddle.com, המשמש כ-Merchant of Record הרשמי של כל עסקה. חשוב לדעת: מכיוון ש-Paddle הוא ה-Merchant of Record, החיוב בכרטיס האשראי/דוח הבנק שלך יופיע תחת השם "Alex Markov" ו/או "Paddle.com" — זהו החיוב הרשמי והתקין עבור המנוי שלך ב-ChoreChamps, אין להירתע ממנו. המנויים מתחדשים אוטומטית בסוף כל תקופת החיוב שנבחרה (חודשית או שנתית). ניתן לבטל את המנוי באופן עצמאי בכל עת דרך פורטל ניהול המנוי של Paddle, הנגיש מהגדרות הפרופיל בתוך האפליקציה; לחלופין ניתן לפנות לתמיכה בכתובת ' +
        CONTACT_EMAIL +
        '. הגישה לפיצ׳רים בתשלום תימשך עד לסוף תקופת החיוב ששולמה. החזרים כספיים מטופלים בהתאם למדיניות ההחזרים של Paddle ולתקנות הגנת הצרכן החלות — ראו מדיניות הביטול וההחזרים שלנו.',
    ],
  },
  {
    heading: 'שימוש הוגן',
    body: [
      'אתה מסכים לא להשתמש בשירות כדי להפר כל חוק או תקנה, לא לנסות לבצע הנדסה לאחור, גירוד נתונים (Scraping) או לנצל לרעה את הפלטפורמה, ולא להעלות תוכן המפר זכויות קניין רוחני של צד שלישי.',
    ],
  },
  {
    heading: 'אימות מבוסס בינה מלאכותית (AI)',
    body: [
      'אימותי ביצוע המשימות מבוצעים בסיוע ניתוח בינה מלאכותית ועשויים לכלול לעיתים סטיות עיבוד קלות. להורים נשמרת תמיד הסמכות הבלעדית לאשר, לדחות או להעניק מטבעות (ChoreCoins) בתוך סביבת הדשבורד שלהם.',
    ],
  },
  {
    heading: 'הגבלת אחריות',
    body: [
      'השירות מסופק "כמות שהוא" (As-Is) ללא אחריות מכל סוג שהוא. החברה לא תישא באחריות לנזקים עקיפים, מקריים או תוצאתיים הנובעים מהשימוש שלך בפלטפורמה.',
    ],
  },
  {
    heading: 'סיום פעילות ומחיקה',
    body: [
      'אנו שומרים לעצמנו את הזכות להשעות או לסגור חשבונות המפרים תנאים אלה. באפשרותך למחוק את חשבונך וכל המידע הקשור אליו באופן עצמאי ולצמיתות, בכל עת, דרך "אזור סכנה" בהגדרות הפרופיל בתוך האפליקציה; לחלופין ניתן לפנות לתמיכה בכתובת ' +
        CONTACT_EMAIL +
        '. המחיקה, לאחר ביצועה, היא סופית ובלתי הפיכה.',
    ],
  },
  {
    heading: 'הדין החל',
    body: ['תנאים אלה כפופים לחוקי מדינת ישראל. כל מחלוקת תתברר בבתי המשפט המוסמכים בישראל.'],
  },
];

const SECTIONS_EN: LegalSection[] = [
  {
    heading: 'The Service',
    body: [
      'ChoreChamps is a software-as-a-service (SaaS) platform for family gamification and household chore management. Users can create, edit, organize, and manage household tasks and personalized family reward stores through our portal.',
    ],
  },
  {
    heading: 'Accounts',
    body: [
      'You must provide accurate information when creating an account. You are responsible for maintaining the security of your login credentials and for all activity that occurs under your account.',
    ],
  },
  {
    heading: 'Free and Premium Plans',
    body: [
      'ChoreChamps offers a free (FREE) plan that includes a limited number of AI-based quality checks, a capped number of proof/reference photos per task, a full ChoreCoins wallet (transfers between parent and child, and between siblings), and ads. One paid plan — Champ Premium — unlocks a completely ad-free experience, unlimited AI checks, more reference and proof photos per task, PDF file uploads, and expanded reference-photo storage. Premium is sold at two billing frequencies: ₪29.90/month, or ₪280/year (the annual plan saves about 22% overall — roughly ₪6.6 less per month than paying monthly). Full, current pricing is always shown in the app interface.',
    ],
  },
  {
    heading: 'Payments and Billing',
    body: [
      'Payments are processed by Paddle.com, acting as the Merchant of Record for all transactions. Important: because Paddle is the Merchant of Record, your card/bank statement will show the charge under the name "Alex Markov" and/or "Paddle.com" — this is the correct, official charge for your ChoreChamps subscription, not a cause for concern. Subscriptions renew automatically at the end of each chosen billing period (monthly or annual). You may cancel at any time, self-service, through Paddle’s Customer Portal (reachable from in-app profile settings), or by contacting support at ' +
        CONTACT_EMAIL +
        '. Access to paid features continues until the end of the paid billing period. Refunds are handled in accordance with Paddle’s refund policy and applicable consumer protection regulations — see our Refund and Cancellation Policy.',
    ],
  },
  {
    heading: 'Fair Use',
    body: [
      'You agree not to use the Service to violate any law or regulation, not to attempt reverse engineering, scraping, or otherwise abuse the platform, and not to upload content that infringes a third party’s intellectual property rights.',
    ],
  },
  {
    heading: 'AI-Based Verification',
    body: [
      'Task-completion verification is assisted by AI-based image analysis and may occasionally include minor processing deviations. Parents always retain sole and exclusive authority to approve, reject, or award ChoreCoins within their dashboard.',
    ],
  },
  {
    heading: 'Limitation of Liability',
    body: [
      'The Service is provided "as-is" without warranties of any kind. The Company is not liable for indirect, incidental, or consequential damages arising from your use of the platform.',
    ],
  },
  {
    heading: 'Termination and Deletion',
    body: [
      'We reserve the right to suspend or terminate accounts that violate these Terms. You may delete your account and all associated data yourself, permanently, at any time, via the "Danger Zone" in profile settings within the app; alternatively you may contact ' +
        CONTACT_EMAIL +
        '. Once completed, deletion is final and irreversible.',
    ],
  },
  {
    heading: 'Governing Law',
    body: ['These Terms are governed by the laws of the State of Israel. Any dispute will be resolved in the competent courts of Israel.'],
  },
];

export default function TermsOfService(): React.ReactNode {
  return (
    <LegalDocumentLayout
      titleHe="תנאי השימוש של ChoreChamps"
      titleEn="ChoreChamps Terms of Service"
      updatedLabelHe="עודכן לאחרונה: ספטמבר 2026"
      updatedLabelEn="Last updated: September 2026"
      sectionsHe={SECTIONS_HE}
      sectionsEn={SECTIONS_EN}
      contactEmail={CONTACT_EMAIL}
    />
  );
}
