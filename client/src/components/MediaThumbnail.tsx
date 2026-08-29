import React, { useState } from 'react';
import { resolvePhotoUrl } from '../services/api';
import { isPdfUrl } from '../utils/media';
import MediaLightbox from './MediaLightbox';

interface MediaThumbnailProps {
  /** Server-relative URL, e.g. '/uploads/xyz.jpg' — same value RewardCard-style components already receive. */
  url: string;
  alt: string;
  /** Sizing/border/rounding classes for the thumbnail itself, e.g. "w-20 h-20 rounded-lg border border-slate-700". */
  className?: string;
  /** Academy tier only — see MediaLightbox. */
  allowDownload?: boolean;
}

/**
 * A clickable proof-photo/reference-photo/PDF thumbnail that opens
 * MediaLightbox for a full-size view. Used everywhere a task's stored file
 * (reference photo or a submission's photoUrls) is shown to a parent or child.
 */
export default function MediaThumbnail({ url, alt, className, allowDownload }: MediaThumbnailProps): React.ReactNode {
  const [open, setOpen] = useState(false);
  const resolved = resolvePhotoUrl(url);
  const pdf = isPdfUrl(url);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="לחצו לתצוגה מוגדלת"
        className={`overflow-hidden cursor-pointer hover:opacity-80 hover:ring-2 hover:ring-indigo-400 transition-all shrink-0 ${className ?? ''}`}
      >
        {pdf ? (
          <div className="w-full h-full bg-slate-800 border border-slate-700 flex flex-col items-center justify-center gap-0.5 text-slate-300">
            <span className="text-lg">📄</span>
            <span className="text-[9px] font-bold">PDF</span>
          </div>
        ) : (
          <img src={resolved} alt={alt} className="w-full h-full object-cover" />
        )}
      </button>

      {open && (
        <MediaLightbox
          url={resolved}
          isPdf={pdf}
          allowDownload={allowDownload}
          downloadName={url.split('/').pop()}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
