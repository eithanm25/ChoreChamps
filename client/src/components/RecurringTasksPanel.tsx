import React, { useEffect, useState } from 'react';
import axios from 'axios';
import api from '../services/api';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { FREQUENCY_LABELS, type TaskFrequency } from '../types/task';

interface RecurringTemplate {
  id: string;
  title: string;
  frequency: TaskFrequency | null;
  assignedTo: { id: string; name: string } | null;
  basePrice: string;
  maxBonusPrice: string;
  deadlineDurationMinutes: number | null;
  latePenaltyAmount: string | null;
}

/** "2 שעות ו-30 דקות" from a raw minute count — same style as client/src/utils/countdown.ts, just from a duration instead of a future timestamp. */
function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} דקות`;
  if (minutes === 0) return `${hours} שעות`;
  return `${hours} שעות ו-${minutes} דקות`;
}

/**
 * Recurring templates are deliberately hidden from the normal task board
 * (see server's Task.isRecurring docstring) — they only ever generate the
 * real, visible occurrences a parent/child actually interact with. This
 * panel is the one place a parent can see an active recurring series exists
 * at all, and stop it (delete the template, same endpoint as deleting any
 * other task) — without it, a recurring chore would run forever with no way
 * to cancel it.
 */
export default function RecurringTasksPanel(): React.ReactNode {
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { requestConfirm, confirmDialog } = useConfirmDialog();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/tasks/recurring-templates');
        if (!cancelled) {
          setTemplates(res.data.templates || []);
        }
      } catch {
        // Best-effort — an empty panel just reads as "no recurring chores yet".
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStop = (template: RecurringTemplate) => {
    requestConfirm(
      `פעולה זו תעצור לצמיתות את המחזוריות של "${template.title}" — לא ייווצרו עוד מופעים חדשים. מופעים שכבר נוצרו ועדיין פתוחים/בתהליך לא יימחקו. להמשיך?`,
      async () => {
        try {
          await api.delete(`/api/tasks/${template.id}`);
          setTemplates((prev) => prev.filter((t) => t.id !== template.id));
        } catch (err: unknown) {
          if (axios.isAxiosError(err)) {
            console.error('[recurring-templates] failed to stop series:', err.response?.data?.error || err.message);
          }
        }
      },
      { confirmLabel: 'כן, עצור את המחזוריות', danger: true },
    );
  };

  if (loading || templates.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 p-5 rounded-2xl shadow-xl w-full flex flex-col gap-3" dir="rtl">
      {confirmDialog}
      <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
        <span>🔁</span> משימות מחזוריות פעילות ({templates.length})
      </h2>
      <div className="flex flex-col gap-2">
        {templates.map((template) => (
          <div
            key={template.id}
            className="flex items-center justify-between gap-3 bg-slate-900/40 border border-slate-800 rounded-xl px-4 py-3"
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-white text-sm font-bold truncate">{template.title}</span>
              <span className="text-slate-400 text-[11px]">
                {template.frequency && FREQUENCY_LABELS[template.frequency]}
                {' • '}
                {template.assignedTo ? `משויך ל${template.assignedTo.name}` : 'פתוח לכולם'}
                {template.deadlineDurationMinutes && (
                  <> • ⏰ טיימר {formatDuration(template.deadlineDurationMinutes)}</>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleStop(template)}
              className="shrink-0 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-lg text-xs font-bold transition-all"
            >
              🛑 עצור מחזוריות
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
