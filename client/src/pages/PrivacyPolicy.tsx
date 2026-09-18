import React from 'react';
import LegalDocumentLayout, { type LegalSection } from '../components/LegalDocumentLayout';

const CONTACT_EMAIL = 'chorechampssupport@gmail.com';

/**
 * Corrections made against what the app actually does (both languages):
 *  - Dropped the "receipts" example from "how we use your email" — receipts
 *    are sent by Paddle as Merchant of Record (see Payment Processing),
 *    ChoreChamps itself sends no emails at all (no mail-sending service
 *    exists in the backend).
 *  - Added that proof photos are deleted on approval/rejection — true, and
 *    a genuinely reassuring detail (see server/src/services/storage.ts).
 *  - Account/data deletion described as self-service, via the profile
 *    settings "Danger Zone" (DELETE /api/users/purge-account) — a real,
 *    shipped feature, not a support-request-only flow any more.
 *  - Replaced the "Cookies" section entirely: this app has zero cookie
 *    usage. The session token lives in the browser's localStorage, read via
 *    an Authorization header — not a cookie. Claiming otherwise in a privacy
 *    policy is a factual misstatement, not a rounding error.
 */

const SECTIONS_HE: LegalSection[] = [
  {
    heading: 'המידע שאנו אוספים',
    body: [
      'ChoreChamps אוספת את כתובת האימייל ופרטי חשבון הגוגל שלך בעת ההתחברות לפורטל ההורים. אנו אוספים גם שמות של פרופילי ילדים במשפחה, שמות מטלות, קונפיגורציות משפחתיות ותמונות אישור מטלות המועלות על ידי בני המשפחה.',
    ],
  },
  {
    heading: 'כיצד אנו משתמשים במידע',
    body: [
      'האימייל שלך משמש אך ורק לניהול החשבון המשפחתי ולאימות סטטוס ההתחברות שלך. תמונות המטלות שהועלו מעובדות בצורה מאובטחת לצורך אימות ביצוע המטלה בלבד, ונמחקות ממערכות האחסון שלנו לאחר שהמשימה אושרה, נדחתה או נמחקה (ראו סעיף שמירת נתונים ותמונות). אנו מתחייבים לא למכור, להשכיר או לשתף מידע אישי עם צדדים שלישיים למטרות שיווקיות.',
    ],
  },
  {
    heading: 'הגנת פרטיות על ילדים',
    body: [
      'ChoreChamps היא אפליקציה המיועדת למשפחות. כל פרופילי הילדים ורשומות הנתונים מנוהלים בקשיחות תחת פיקוחו ויצירתו של ההורה בעל החשבון הראשי. איננו אוספים ביודעין נתונים ישירות מקטינים ללא בקרת הורים פעילה.',
    ],
  },
  {
    heading: 'עיבוד תשלומים',
    body: [
      'התשלומים מנוהלים על ידי Paddle.com, הפועלת כ-Merchant of Record של כל העסקאות. Paddle אוספת ומעבדת את פרטי התשלום שלך ישירות — ChoreChamps אינה שומרת או מאחסנת את פרטי האשראי או הבנק שלך. Paddle פועלת תחת מדיניות הפרטיות הרשמית שלה (paddle.com/legal/privacy).',
    ],
  },
  {
    heading: 'שמירת נתונים ותמונות',
    body: [
      'אנו שומרים את הפרופילים המשפחתיים והגדרות המשימות שלך כל עוד החשבון שלך פעיל. תמונות האימות שהועלו מאוחסנות בצורה מאובטחת על תשתית Cloudflare R2, ונמחקות באופן שוטף עם אישור/דחיית משימה, עם חוקי מחיקה אוטומטיים (Object Lifecycle) כרשת ביטחון נוספת. באפשרותך למחוק בעצמך, לצמיתות ובכל עת, את החשבון וכל הנתונים הקשורים אליו — דרך "אזור סכנה" בהגדרות הפרופיל בתוך האפליקציה; לחלופין ניתן לפנות לתמיכה בכתובת ' +
        CONTACT_EMAIL +
        '.',
    ],
  },
  {
    heading: 'אחסון מקומי, לא עוגיות',
    body: [
      'ChoreChamps אינה משתמשת בעוגיות (Cookies) למעקב. אנו משתמשים באחסון מקומי בדפדפן (Local Storage) במכשיר שלך כדי לשמור את סשן ההתחברות שלך ואת העדפות הפרופיל, כך שלא תצטרכו להתחבר מחדש בכל פתיחה של האתר. איננו משתמשים במנגנון זה לצורכי פרסום או מעקב צולב בין אתרים.',
    ],
  },
];

const SECTIONS_EN: LegalSection[] = [
  {
    heading: 'Information We Collect',
    body: [
      'ChoreChamps collects your email address and Google account details when you sign in to the parent portal. We also collect the names of child profiles in your family, task names, family configuration data, and task-completion proof photos uploaded by family members.',
    ],
  },
  {
    heading: 'How We Use Information',
    body: [
      'Your email is used solely for managing your family account and verifying your login status. Uploaded task photos are processed securely for the sole purpose of verifying task completion, and are deleted from our storage once a task is approved, rejected, or removed (see Data and Image Retention). We commit to never selling, renting, or sharing personal information with third parties for marketing purposes.',
    ],
  },
  {
    heading: "Children's Privacy",
    body: [
      'ChoreChamps is a family-oriented application. All child profiles and data records are strictly managed under the supervision and creation of the primary account-holding parent. We do not knowingly collect data directly from minors without active parental control.',
    ],
  },
  {
    heading: 'Payment Processing',
    body: [
      'Payments are managed by Paddle.com, which acts as the Merchant of Record for all transactions. Paddle collects and processes your payment details directly — ChoreChamps does not retain or store your credit card or bank details. Paddle operates under its own official privacy policy (paddle.com/legal/privacy).',
    ],
  },
  {
    heading: 'Data and Image Retention',
    body: [
      'We retain your family profiles and task configurations for as long as your account is active. Uploaded verification photos are stored securely on Cloudflare R2 infrastructure and are routinely deleted upon task approval/rejection, with automatic deletion rules (Object Lifecycle) as an additional safeguard. You may delete your account and all associated data yourself, permanently, at any time, via the "Danger Zone" in profile settings within the app; alternatively you may contact support at ' +
        CONTACT_EMAIL +
        '.',
    ],
  },
  {
    heading: 'Local Storage, Not Cookies',
    body: [
      "ChoreChamps does not use tracking cookies. We use your browser's local storage to keep you signed in and remember your profile preferences, so you don't need to log in again every time you open the site. We do not use this mechanism for advertising or cross-site tracking.",
    ],
  },
];

export default function PrivacyPolicy(): React.ReactNode {
  return (
    <LegalDocumentLayout
      titleHe="מדיניות הפרטיות של ChoreChamps"
      titleEn="ChoreChamps Privacy Policy"
      updatedLabelHe="עודכן לאחרונה: ספטמבר 2026"
      updatedLabelEn="Last updated: September 2026"
      sectionsHe={SECTIONS_HE}
      sectionsEn={SECTIONS_EN}
      contactEmail={CONTACT_EMAIL}
    />
  );
}
