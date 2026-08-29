import React, { useState } from 'react';
import MediaLightbox from './MediaLightbox';

interface LocalMediaThumbnailProps {
  file: File;
  /** Blob URL already created via URL.createObjectURL(file) — this component never creates or revokes it. */
  previewUrl: string;
  onRemove: () => void;
  /** Sizing/border/rounding classes for the thumbnail itself. */
  className?: string;
}

/**
 * A not-yet-uploaded photo/PDF thumbnail — the small square with the red ✕
 * shown while composing a task (parent's reference files, child's proof
 * photos). Clicking the thumbnail itself opens a full-size MediaLightbox
 * preview so the sender can double-check they picked the right file before
 * submitting; clicking the ✕ removes it instead (stopPropagation keeps the
 * two actions from triggering each other).
 */
export default function LocalMediaThumbnail({ file, previewUrl, onRemove, className }: LocalMediaThumbnailProps): React.ReactNode {
  const [open, setOpen] = useState(false);
  const isPdf = file.type === 'application/pdf';

  return (
    <>
      <div className={`relative ${className ?? 'w-16 h-16'}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="לחצו לתצוגה מקדימה"
          className="w-full h-full overflow-hidden rounded-lg border border-slate-700 ring-2 ring-slate-800 shadow-md cursor-pointer hover:opacity-80 hover:ring-indigo-400 transition-all"
        >
          {isPdf ? (
            <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center gap-0.5 text-slate-300">
              <span className="text-lg">📄</span>
              <span className="text-[9px] font-bold">PDF</span>
            </div>
          ) : (
            <img src={previewUrl} alt="תצוגה מקדימה" className="w-full h-full object-cover" />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-md cursor-pointer select-none"
          title="הסר קובץ"
        >
          ✕
        </button>
      </div>

      {open && <MediaLightbox url={previewUrl} isPdf={isPdf} onClose={() => setOpen(false)} />}
    </>
  );
}
