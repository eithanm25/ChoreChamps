import React from 'react';
import { Link } from 'react-router-dom';

interface GuidesLayoutProps {
  children: React.ReactNode;
}

/**
 * Shared chrome for the /guides index and /guides/:slug articles — same
 * header/footer language as LandingPage.tsx (logo, login link, legal nav,
 * contact email) so these read as part of the same site rather than a
 * bolted-on microsite, which matters both for visitors and for anyone
 * reviewing the site's overall content depth.
 */
export default function GuidesLayout({ children }: GuidesLayoutProps): React.ReactNode {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir="rtl">
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur border-b border-slate-800/80">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-black text-white text-lg">
            <span>🏆</span> ChoreChamps
          </Link>
          <Link
            to="/login"
            className="px-5 py-2 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-100 text-sm font-bold transition-all"
          >
            התחברות
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-10">{children}</main>

      <footer className="border-t border-slate-800/80 bg-slate-900/40">
        <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col items-center text-center gap-4">
          <div className="flex items-center gap-4 text-[11px] flex-wrap justify-center">
            <Link to="/guides" className="text-slate-500 hover:text-slate-300 font-medium transition-colors">
              כל המדריכים
            </Link>
            <span className="text-slate-700">•</span>
            <Link to="/terms" className="text-slate-500 hover:text-slate-300 font-medium transition-colors">
              תנאי שימוש
            </Link>
            <span className="text-slate-700">•</span>
            <Link to="/privacy" className="text-slate-500 hover:text-slate-300 font-medium transition-colors">
              מדיניות פרטיות
            </Link>
            <span className="text-slate-700">•</span>
            <a
              href="mailto:chorechampssupport@gmail.com"
              className="text-slate-500 hover:text-slate-300 font-medium transition-colors"
            >
              chorechampssupport@gmail.com
            </a>
          </div>
          <p className="text-slate-600 text-[11px]">© {new Date().getFullYear()} ChoreChamps. כל הזכויות שמורות.</p>
        </div>
      </footer>
    </div>
  );
}
