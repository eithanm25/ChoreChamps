import React from 'react';
import { Link } from 'react-router-dom';
import GuidesLayout from '../components/GuidesLayout';
import { GUIDES } from '../data/guides';

/**
 * Public, standalone reading list at /guides — independent parenting/finance
 * content a visitor can read without ever signing up. See data/guides.ts for
 * the "why" (AdSense content-depth review), and GuideArticle.tsx for the
 * per-article page this links to.
 */
export default function GuidesIndex(): React.ReactNode {
  return (
    <GuidesLayout>
      <div className="flex flex-col gap-3 text-center">
        <span className="text-indigo-400 text-xs font-black tracking-widest">📚 מדריכים להורים</span>
        <h1 className="text-2xl sm:text-4xl font-black text-white">כלים וטיפים לגידול ילדים אחראיים</h1>
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
          מדריכים מעשיים על מטלות בית, דמי כיס ואוריינות פיננסית לילדים — כתובים על ידי הצוות שמאחורי
          ChoreChamps, לכל הורה, בלי קשר אם אתם משתמשים באפליקציה שלנו.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {GUIDES.map((guide) => (
          <Link
            key={guide.slug}
            to={`/guides/${guide.slug}`}
            className="flex items-start gap-4 p-5 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/80 transition-all"
          >
            <span className="text-3xl shrink-0">{guide.icon}</span>
            <div className="flex flex-col gap-1.5 min-w-0">
              <h2 className="text-white font-bold text-base sm:text-lg leading-tight">{guide.title}</h2>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{guide.excerpt}</p>
              <span className="text-slate-500 text-[11px] font-medium mt-1">⏱️ {guide.readingMinutes} דקות קריאה</span>
            </div>
          </Link>
        ))}
      </div>
    </GuidesLayout>
  );
}
