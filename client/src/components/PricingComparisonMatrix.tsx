import React from 'react';
import {
  PREMIUM_ANNUAL_SAVINGS_COPY,
  PREMIUM_BILLING_OPTIONS,
  PRICING_MATRIX_ROWS,
} from '../data/subscriptionPlans';

/**
 * Row-by-row Free vs Premium comparison matrix. A CSS grid, not an HTML
 * table — the two status columns are fixed-width (rem, never grow) and the
 * criterion column absorbs the rest as 1fr, so long Hebrew criteria wrap
 * vertically inside their own cell instead of ever forcing the row wider
 * than its container (zero horizontal overflow on any viewport).
 */
export default function PricingComparisonMatrix(): React.ReactNode {
  return (
    <div className="w-full rounded-2xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
      <div className="grid grid-cols-[1fr_4.5rem_4.5rem] sm:grid-cols-[1fr_7rem_7rem] items-center gap-1 sm:gap-3 px-3 sm:px-5 py-3 border-b border-slate-700/50 bg-slate-900/50">
        <span className="text-slate-400 text-[11px] sm:text-xs font-bold">קריטריון</span>
        <span className="text-center text-slate-300 text-[11px] sm:text-xs font-black">מסלול חינמי</span>
        <span className="text-center text-amber-300 text-[11px] sm:text-xs font-black">מנוי פרימיום 👑</span>
      </div>

      {PRICING_MATRIX_ROWS.map((row, index) => (
        <div
          key={row.criterion}
          className={`grid grid-cols-[1fr_4.5rem_4.5rem] sm:grid-cols-[1fr_7rem_7rem] items-start gap-1 sm:gap-3 px-3 sm:px-5 py-3 ${
            index % 2 === 1 ? 'bg-slate-900/20' : ''
          }`}
        >
          <span className="text-slate-200 text-xs sm:text-sm font-bold leading-snug">{row.criterion}</span>

          <div className="flex flex-col items-center gap-0.5 text-center">
            <span className={`text-base sm:text-lg ${row.free.included ? 'text-emerald-400' : 'text-rose-400'}`}>
              {row.free.included ? '✅' : '❌'}
            </span>
            {row.free.note && <span className="text-slate-500 text-[9px] sm:text-[10px] leading-tight">{row.free.note}</span>}
          </div>

          <div className="flex flex-col items-center gap-0.5 text-center">
            <span className={`text-base sm:text-lg ${row.premium.included ? 'text-emerald-400' : 'text-rose-400'}`}>
              {row.premium.included ? '✅' : '❌'}
            </span>
            {row.premium.note && (
              <span className="text-slate-500 text-[9px] sm:text-[10px] leading-tight">{row.premium.note}</span>
            )}
          </div>
        </div>
      ))}

      <div className="px-4 sm:px-5 py-4 bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border-t border-slate-700/50 text-center">
        <p className="text-white text-sm sm:text-base font-black">
          {PREMIUM_BILLING_OPTIONS.year.priceLabel} / שנה
        </p>
        <p className="text-emerald-400 text-xs sm:text-sm font-bold mt-1">{PREMIUM_ANNUAL_SAVINGS_COPY}</p>
      </div>
    </div>
  );
}
