import React from 'react';
import LegalDocumentLayout, { type LegalSection } from '../components/LegalDocumentLayout';

const CONTACT_EMAIL = 'support@chorechampsapp.com';

/**
 * Corrections made against what the app actually does (both languages), so
 * this document never promises something a real user can't actually get:
 *  - Plan names/prices matched to data/subscriptionPlans.ts: Premium is
 *    the ₪19/mo plan and Champ Academy is the ₪39/mo plan — the source
 *    text had these two swapped/renamed.
 *  - "Award stars" -> "award ChoreCoins": the app's currency is ChoreCoins
 *    everywhere in the UI; it never says "stars".
 *  - Cancellation and account deletion described as support-request flows
 *    (contact support@...), not a "Settings" self-service toggle — no such
 *    self-service cancel-subscription or delete-account feature exists in
 *    the app today. Promising one in a legal document would be a real
 *    liability the moment a user tried to use it.
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
    heading: 'מסלולים חינמיים ובתשלום',
    body: [
      'ChoreChamps מציעה מסלול חינמי (FREE) הכולל מספר מוגבל של בדיקות איכות מבוססות בינה מלאכותית ומכסת תמונות הוכחה/ייחוס למשימה. שני מסלולי מנוי בתשלום פותחים יכולות מורחבות: מסלול Premium ב-19 ₪ לחודש (בדיקות AI ללא הגבלה, יותר תמונות ייחוס והוכחה למשימה), ומסלול Champ Academy ב-39 ₪ לחודש (כל יתרונות Premium, בתוספת העלאת קבצי PDF וארנק משפחתי משותף בין אחים). התמחור המלא והעדכני מוצג תמיד בממשק האפליקציה.',
    ],
  },
  {
    heading: 'תשלומים וחיובים',
    body: [
      'התשלומים מעובדים על ידי Paddle.com, המשמש כ-Merchant of Record הרשמי של כל עסקה. המנויים מתחדשים אוטומטית בסוף כל תקופת חיוב. ניתן לבקש ביטול המנוי בכל עת בפנייה לתמיכה בכתובת ' +
        CONTACT_EMAIL +
        '; הגישה לפיצ׳רים בתשלום תימשך עד לסוף תקופת החיוב ששולמה. החזרים כספיים מטופלים בהתאם למדיניות ההחזרים של Paddle ולתקנות הגנת הצרכן החלות.',
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
      'אנו שומרים לעצמנו את הזכות להשעות או לסגור חשבונות המפרים תנאים אלה. באפשרותך לבקש מחיקה מלאה ולצמיתות של חשבונך וכל המידע הקשור אליו בכל עת, בפנייה לכתובת ' +
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
    heading: 'Free and Paid Plans',
    body: [
      'ChoreChamps offers a free (FREE) plan that includes a limited number of AI-based quality checks and a capped number of proof/reference photos per task. Two paid subscription plans unlock expanded capabilities: the Premium plan at ₪19/month (unlimited AI checks, more reference and proof photos per task), and the Champ Academy plan at ₪39/month (all Premium benefits, plus PDF file uploads and a shared family wallet between siblings). Full, current pricing is always shown in the app interface.',
    ],
  },
  {
    heading: 'Payments and Billing',
    body: [
      'Payments are processed by Paddle.com, acting as the Merchant of Record for all transactions. Subscriptions renew automatically at the end of each billing period. You may request cancellation at any time by contacting support at ' +
        CONTACT_EMAIL +
        '; access to paid features continues until the end of the paid billing period. Refunds are handled in accordance with Paddle’s refund policy and applicable consumer protection regulations.',
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
      'We reserve the right to suspend or terminate accounts that violate these Terms. You may request full, permanent deletion of your account and all associated data at any time by contacting ' +
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
