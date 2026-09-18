import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export interface LegalSection {
  heading: string;
  body: string[];
}

interface LegalDocumentLayoutProps {
  titleHe: string;
  titleEn: string;
  updatedLabelHe: string;
  updatedLabelEn: string;
  sectionsHe: LegalSection[];
  sectionsEn: LegalSection[];
  contactEmail: string;
}

type Lang = 'he' | 'en';

/**
 * Shared bilingual chrome for legal documents (Terms of Service, Privacy
 * Policy) — a tab switcher rather than side-by-side columns, since dense
 * legal paragraphs in two languages side by side is unreadable on mobile.
 * Each page (TermsOfService.tsx, PrivacyPolicy.tsx) only supplies its own
 * content; this component owns the layout, dark theme, and language toggle.
 */
export default function LegalDocumentLayout({
  titleHe,
  titleEn,
  updatedLabelHe,
  updatedLabelEn,
  sectionsHe,
  sectionsEn,
  contactEmail,
}: LegalDocumentLayoutProps): React.ReactNode {
  const [lang, setLang] = useState<Lang>('he');
  const isHebrew = lang === 'he';
  const sections = isHebrew ? sectionsHe : sectionsEn;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-4" dir={isHebrew ? 'rtl' : 'ltr'}>
          <Link to="/" className="flex items-center gap-2 font-black text-white text-base shrink-0">
            <span>🏆</span> ChoreChamps
          </Link>

          {/* בורר שפה: עברית / English */}
          <div className="flex gap-1 bg-slate-800/60 p-1 rounded-full ring-1 ring-slate-700/60">
            <button
              type="button"
              onClick={() => setLang('he')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                isHebrew ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              עברית
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                !isHebrew ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              English
            </button>
          </div>
        </div>
      </header>

      <main
        className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-8"
        dir={isHebrew ? 'rtl' : 'ltr'}
        lang={isHebrew ? 'he' : 'en'}
      >
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl sm:text-3xl font-black text-white">{isHebrew ? titleHe : titleEn}</h1>
          <p className="text-slate-500 text-xs">{isHebrew ? updatedLabelHe : updatedLabelEn}</p>
        </div>

        <div className="flex flex-col gap-8">
          {sections.map((section, index) => (
            <section key={section.heading} className="flex flex-col gap-2">
              <h2 className="text-white font-bold text-base sm:text-lg flex items-center gap-2">
                <span className="text-indigo-400 text-sm font-mono">{index + 1}.</span>
                {section.heading}
              </h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-slate-300 text-sm leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-800 pt-6">
          <nav className="flex items-center gap-3 text-xs flex-wrap">
            <Link to="/terms" className="text-slate-400 hover:text-slate-200 font-medium transition-colors">
              {isHebrew ? 'תנאי שימוש' : 'Terms of Service'}
            </Link>
            <span className="text-slate-700">•</span>
            <Link to="/privacy" className="text-slate-400 hover:text-slate-200 font-medium transition-colors">
              {isHebrew ? 'מדיניות פרטיות' : 'Privacy Policy'}
            </Link>
            <span className="text-slate-700">•</span>
            <Link to="/refund-policy" className="text-slate-400 hover:text-slate-200 font-medium transition-colors">
              {isHebrew ? 'מדיניות ביטול והחזרים' : 'Refund & Cancellation Policy'}
            </Link>
          </nav>
          <p className="text-slate-500 text-xs">
            {isHebrew ? 'שאלות? נשמח לעזור: ' : 'Questions? We are happy to help: '}
            <a href={`mailto:${contactEmail}`} className="text-indigo-400 font-bold hover:text-indigo-300">
              {contactEmail}
            </a>
          </p>
          <p className="text-slate-600 text-[11px]">
            © {new Date().getFullYear()} ChoreChamps — {isHebrew ? 'מופעל על ידי' : 'Operated by'} Alex Markov.
          </p>
        </div>
      </main>
    </div>
  );
}
