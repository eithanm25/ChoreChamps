import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PLANS } from '../data/subscriptionPlans';

interface LandingPageProps {
  /**
   * 'page' (default): the full marketing homepage — sticky header + hero +
   * footer, each carrying a real signup/login CTA.
   * 'modal': the exact same educational content mounted as a closable
   * overlay from the "?" help icon inside an already-authenticated
   * dashboard — no signup/login CTAs, since those don't apply to someone
   * already inside their account.
   */
  mode?: 'page' | 'modal';
  onClose?: () => void;
}

interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

const PARENT_FEATURES: FeatureItem[] = [
  {
    icon: '📝',
    title: 'משימות מותאמות אישית עם תמונת המחשה',
    description:
      'יוצרים משימה עם כותרת, תיאור ברור לילד/ה, ואפשר לצרף תמונה או קובץ להמחשה — כדי שיהיה ברור בדיוק למה מצפים.',
  },
  {
    icon: '💰',
    title: 'תגמול הוגן על כל משימה',
    description:
      'קובעים מחיר בסיס לכל משימה, ובונוס איכות נוסף שמחושב אוטומטית לפי רמת הביצוע — ילדים לומדים שמאמץ טוב יותר שווה יותר.',
  },
  {
    icon: '🤖',
    title: 'בדיקה חכמה מופעלת AI',
    description:
      'כשהילד/ה שולחים תמונת הוכחה, Claude סורק אותה ומציע ציון וחוות דעת כתובה — ההורה תמיד מקבל את ההחלטה הסופית, אישור או תיקון.',
  },
  {
    icon: '🎁',
    title: 'חנות פרסים משפחתית משלכם',
    description:
      'בונים קטלוג פרסים אישי — פינוקים ביתיים חינמיים או מוצרים אמיתיים — וקובעים כמה עולה כל אחד במטבעות המשפחה.',
  },
  {
    icon: '📊',
    title: 'מעקב חי אחרי כל ילד/ה',
    description:
      'כמות המשימות שכל ילד/ה השלימו אי פעם, והיתרה העדכנית שלהם, מתעדכנות בזמן אמת בלוח הבקרה — בלי לשאול "עשית?"',
  },
];

const CHILD_FEATURES: FeatureItem[] = [
  {
    icon: '🏠',
    title: 'לוח משימות חי',
    description: 'רשימת המשימות מתעדכנת אוטומטית ברגע שהורה מוסיף, משייך או מאשר — בלי צורך לרענן.',
  },
  {
    icon: '📸',
    title: 'צילום הוכחה בלחיצה אחת',
    description: 'מצלמים את תוצאת המשימה ישירות מהדפדפן, בלי להוריד אפליקציה נפרדת — ושולחים לאישור ההורים.',
  },
  {
    icon: '💰',
    title: 'ארנק מטבעות אישי',
    description: 'כל משימה שאושרה מוסיפה מטבעות ליתרה האישית — אפשר לראות בדיוק כמה נצבר ולתכנן קדימה.',
  },
  {
    icon: '🎁',
    title: 'חנות פרסים מרגשת',
    description: 'המטבעות שנצברו הופכים לפרסים אמיתיים — מהחנות המשפחתית שההורים בנו במיוחד.',
  },
];

interface RewardTier {
  icon: string;
  title: string;
  description: string;
}

const REWARD_TIERS: RewardTier[] = [
  {
    icon: '⚡',
    title: 'פרסים מיידיים',
    description: 'פינוקים קטנים ומהירים כמו שעת מסך נוספת, ממתק מיוחד, או אירוח חבר — סיפוק מהיר שמשמר מוטיבציה שוטפת.',
  },
  {
    icon: '🍦',
    title: 'חוויות משותפות',
    description: 'זמן איכות משפחתי — יציאה משותפת לגלידה, ערב סרט עם אבא, או פיקניק. מחזק את הקשר, לא רק את הארנק.',
  },
  {
    icon: '🏆',
    title: 'פרסי ענק לטווח ארוך',
    description: 'מתנות משמעותיות שדורשות חיסכון ממושך — צעצוע נחשק, ציוד ספורט, או טיול ללונה פארק. לומדים לחסוך למטרה.',
  },
];

/** Small pure-CSS accordion — no measuring JS, animates via a grid-rows trick. */
function FeatureAccordion({ items }: { items: FeatureItem[] }): React.ReactNode {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="w-full flex items-center justify-between gap-3 p-4 text-right"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="text-xl shrink-0">{item.icon}</span>
                <span className="font-bold text-white text-sm sm:text-base">{item.title}</span>
              </span>
              <span className={`text-slate-500 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                ⌄
              </span>
            </button>
            <div className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <div className="overflow-hidden">
                <p className="px-4 pb-4 text-slate-400 text-xs sm:text-sm leading-relaxed">{item.description}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }): React.ReactNode {
  return (
    <div className="flex flex-col gap-2 mb-6 text-center">
      <span className="text-indigo-400 text-xs font-black tracking-widest">{eyebrow}</span>
      <h2 className="text-2xl sm:text-3xl font-black text-white">{title}</h2>
    </div>
  );
}

/**
 * Marketing homepage + in-app knowledge base, sharing one implementation.
 * As a route (mode='page') it's what any unauthenticated visitor to "/" sees
 * — see App.tsx for the invite-link bypass that skips this entirely. As a
 * modal (mode='modal') it's the same content reused as a "?" help guide
 * inside the parent/child dashboards, with the account CTAs hidden since
 * they don't apply to someone already signed in.
 */
export default function LandingPage({ mode = 'page', onClose }: LandingPageProps): React.ReactNode {
  const isModal = mode === 'modal';
  const freePlan = PLANS.find((plan) => plan.tier === 'free');
  const premiumPlan = PLANS.find((plan) => plan.tier === 'premium');

  return (
    <div
      className={
        isModal
          ? 'fixed inset-0 z-50 bg-slate-950 overflow-y-auto'
          : 'min-h-screen bg-slate-950 text-slate-100'
      }
      dir="rtl"
    >
      {isModal ? (
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-6 py-4">
          <h1 className="text-lg font-black text-white flex items-center gap-2">
            <span>🏆</span> מדריך ChoreChamps
          </h1>
          <button
            type="button"
            onClick={onClose}
            title="סגירה"
            className="shrink-0 w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-lg font-black transition-all"
          >
            ✕
          </button>
        </header>
      ) : (
        <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur border-b border-slate-800/80">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
            <span className="flex items-center gap-2 font-black text-white text-lg">
              <span>🏆</span> ChoreChamps
            </span>
            <Link
              to="/login"
              className="px-5 py-2 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-100 text-sm font-bold transition-all"
            >
              התחברות
            </Link>
          </div>
        </header>
      )}

      {!isModal && (
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-indigo-950/40 via-slate-950 to-slate-950" />
          <div className="relative max-w-4xl mx-auto px-6 py-16 sm:py-24 flex flex-col items-center text-center gap-6">
            <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-indigo-400 leading-tight">
              הופכים מטלות בית לחוויה משפחתית שכולם אוהבים
            </h1>
            <p className="text-slate-300 text-sm sm:text-lg max-w-2xl leading-relaxed">
              במקום לחזור על אותה בקשה בפעם החמישית, תנו לילדים לוח משימות משחקי, מטבעות שנצברים על כל הישג,
              וחנות פרסים שהם עצמם עוזרים לבנות. פחות צעקות, יותר שיתוף פעולה.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Link
                to="/signup"
                className="px-8 py-3.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-base font-black shadow-2xl shadow-indigo-500/30 hover:from-indigo-600 hover:to-violet-600 transition-all"
              >
                נסו בחינם 🚀
              </Link>
              <Link to="/login" className="text-slate-400 text-sm font-bold hover:text-slate-200 transition-colors">
                כבר יש לכם חשבון? התחברו כאן
              </Link>
            </div>
          </div>
        </section>
      )}

      <main className="max-w-5xl mx-auto px-6 py-12 flex flex-col gap-16">
        {/* חזון ומטרה חינוכית */}
        <section>
          <SectionHeading eyebrow="🚀 החזון שלנו" title="מהצעקות למשחק משפחתי" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div className="flex flex-col gap-4 text-slate-300 text-sm sm:text-base leading-relaxed">
              <p>
                ChoreChamps נולד מתוך הבנה פשוטה: מטלות בית לא צריכות להיות מקור לחיכוך יומיומי. כשהופכים אותן
                למשחק — עם משימות ברורות, תגמול הוגן, וחנות פרסים שהילדים בעצמם בונים איתכם — הבקשה החוזרת
                הופכת לאתגר שכיף לנצח בו.
              </p>
              <p>
                הילדים לומדים אחריות (המשימה שלהם, מההתחלה ועד האישור), אוריינות פיננסית דיגיטלית (צוברים
                מטבעות משפחתיים, שוקלים איך לחסוך אליהם או לממש אותם מיד), ומרגישים מוערכים כשההורה בודק ומעריך
                את מה שהם עשו — לא רק מזכיר להם מה נשאר.
              </p>
              <p className="text-white font-bold">התוצאה: פחות ניגוד, יותר עצמאות, ובית שקט יותר לכל המשפחה.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
              {[
                { icon: '🧠', text: 'עצמאות ואחריות אישית' },
                { icon: '💰', text: 'אוריינות פיננסית מגיל צעיר' },
                { icon: '🤝', text: 'הערכה הדדית במקום ויכוחים' },
              ].map((item) => (
                <div
                  key={item.text}
                  className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 rounded-2xl p-4"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-slate-200 font-bold text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* דשבורד ההורים ופיצ'רים */}
        <section>
          <SectionHeading eyebrow="👩‍🦰 מרכז הבקרה" title="דשבורד ההורים" />
          <FeatureAccordion items={PARENT_FEATURES} />
        </section>

        {/* דשבורד הילדים ופיצ'רים */}
        <section>
          <SectionHeading eyebrow="👦 חוויית הילד" title="דשבורד הצ׳אמפ" />
          <FeatureAccordion items={CHILD_FEATURES} />
        </section>

        {/* חנות הפרסים והקטגוריות */}
        <section>
          <SectionHeading eyebrow="🎁 חנות הפרסים" title="3 סוגי פרסים שמשמרים מוטיבציה לאורך זמן" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {REWARD_TIERS.map((tier) => (
              <div
                key={tier.title}
                className="flex flex-col gap-3 bg-slate-900/50 border border-slate-800 rounded-2xl p-5"
              >
                <span className="text-3xl">{tier.icon}</span>
                <h3 className="text-white font-black text-base">{tier.title}</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{tier.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* השוואת מסלולים */}
        {freePlan && premiumPlan && (
          <section>
            <SectionHeading eyebrow="💎 המסלולים שלנו" title="בחרו את המסלול שמתאים למשפחה שלכם" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {[freePlan, premiumPlan].map((plan) => (
                <div
                  key={plan.tier}
                  className={`relative rounded-3xl p-6 flex flex-col gap-4 border transition-all ${
                    plan.highlight
                      ? 'bg-gradient-to-b from-indigo-950/60 to-slate-900 border-indigo-500/40 shadow-2xl shadow-indigo-500/10'
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
                      <li key={feature} className="flex items-start gap-2 text-slate-300 text-xs sm:text-sm leading-relaxed">
                        <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {!isModal && (
        <footer className="border-t border-slate-800/80 bg-slate-900/40">
          <div className="max-w-4xl mx-auto px-6 py-14 flex flex-col items-center text-center gap-5">
            <h2 className="text-xl sm:text-2xl font-black text-white">מוכנים להפוך את הבית לזירת אליפות?</h2>
            <p className="text-slate-400 text-sm max-w-md">
              ההרשמה לוקחת פחות מדקה, ולא צריך כרטיס אשראי כדי להתחיל במסלול החינמי.
            </p>
            <Link
              to="/signup"
              className="px-8 py-3.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-base font-black shadow-2xl shadow-indigo-500/30 hover:from-indigo-600 hover:to-violet-600 transition-all"
            >
              נסו בחינם 🚀
            </Link>
            <div className="flex items-center gap-4 mt-6 text-[11px]">
              <Link to="/terms" className="text-slate-500 hover:text-slate-300 font-medium transition-colors">
                תנאי שימוש
              </Link>
              <span className="text-slate-700">•</span>
              <Link to="/privacy" className="text-slate-500 hover:text-slate-300 font-medium transition-colors">
                מדיניות פרטיות
              </Link>
            </div>
            <p className="text-slate-600 text-[11px]">© {new Date().getFullYear()} ChoreChamps. כל הזכויות שמורות.</p>
          </div>
        </footer>
      )}
    </div>
  );
}
