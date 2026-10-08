import React from 'react';
import { Link, useParams } from 'react-router-dom';
import GuidesLayout from '../components/GuidesLayout';
import { GUIDES, getGuideBySlug } from '../data/guides';

const DATE_FORMATTER = new Intl.DateTimeFormat('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });

export default function GuideArticle(): React.ReactNode {
  const { slug } = useParams<{ slug: string }>();
  const guide = getGuideBySlug(slug);

  if (!guide) {
    return (
      <GuidesLayout>
        <div className="flex flex-col items-center gap-4 text-center py-12">
          <span className="text-4xl">🔍</span>
          <h1 className="text-xl font-black text-white">המדריך לא נמצא</h1>
          <p className="text-slate-400 text-sm">אולי הקישור השתנה — אפשר לחזור לרשימת המדריכים.</p>
          <Link
            to="/guides"
            className="px-6 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold transition-all"
          >
            לכל המדריכים
          </Link>
        </div>
      </GuidesLayout>
    );
  }

  const otherGuides = GUIDES.filter((g) => g.slug !== guide.slug);

  return (
    <GuidesLayout>
      <article className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Link to="/guides" className="text-indigo-400 text-xs font-bold hover:text-indigo-300 w-fit">
            ← כל המדריכים
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{guide.icon}</span>
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">{guide.title}</h1>
          </div>
          <div className="flex items-center gap-3 text-slate-500 text-xs font-medium">
            <span>⏱️ {guide.readingMinutes} דקות קריאה</span>
            <span>•</span>
            <span>עודכן לאחרונה: {DATE_FORMATTER.format(new Date(guide.updatedAt))}</span>
          </div>
        </header>

        <div className="flex flex-col gap-8">
          {guide.sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-3">
              <h2 className="text-white font-bold text-lg sm:text-xl">{section.heading}</h2>
              {section.blocks.map((block, blockIndex) =>
                block.type === 'p' ? (
                  <p key={blockIndex} className="text-slate-300 text-sm sm:text-base leading-relaxed">
                    {block.text}
                  </p>
                ) : (
                  <ul key={blockIndex} className="flex flex-col gap-1.5 pr-1">
                    {block.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-slate-300 text-sm sm:text-base leading-relaxed">
                        <span className="text-indigo-400 mt-1.5 text-[8px] shrink-0">●</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ),
              )}
            </section>
          ))}
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/20 p-5 flex flex-col sm:flex-row items-center gap-4 justify-between">
          <p className="text-slate-300 text-sm leading-relaxed">
            רוצים לנהל את המטלות והתגמולים של הילדים שלכם בלוח אחד, בלי לוח פתקים שנאבד? ChoreChamps עושה את זה
            בחינם.
          </p>
          <Link
            to="/signup"
            className="shrink-0 px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-black shadow-lg hover:from-indigo-600 hover:to-violet-600 transition-all"
          >
            נסו בחינם 🚀
          </Link>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-800 pt-6">
          <h2 className="text-white font-bold text-sm">מדריכים נוספים שיכולים לעניין אתכם</h2>
          <div className="flex flex-col gap-2">
            {otherGuides.map((other) => (
              <Link
                key={other.slug}
                to={`/guides/${other.slug}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-indigo-500/50 transition-all"
              >
                <span className="text-xl shrink-0">{other.icon}</span>
                <span className="text-slate-200 text-sm font-bold">{other.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </article>
    </GuidesLayout>
  );
}
