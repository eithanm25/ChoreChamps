import React, { useEffect, useState } from 'react';

interface MediaLightboxProps {
  /** Already-resolved, absolute URL (see resolvePhotoUrl). */
  url: string;
  isPdf: boolean;
  /** Academy tier only — everywhere else, files are deleted on approval with no way to get them back. */
  allowDownload?: boolean;
  downloadName?: string;
  onClose: () => void;
}

/**
 * Full-screen viewer for a proof photo or PDF worksheet — opened by clicking
 * any MediaThumbnail. Images render at their natural size (capped to the
 * viewport); PDFs render in an iframe using the browser's native PDF viewer.
 */
export default function MediaLightbox({ url, isPdf, allowDownload, downloadName, onClose }: MediaLightboxProps): React.ReactNode {
  const [downloading, setDownloading] = useState(false);
  // Drives the enter transition: mounts at opacity/scale 0, then flips true one
  // frame later so the browser actually animates the change instead of
  // painting the final state immediately.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // A plain <a download> is silently ignored by browsers when the link is
  // cross-origin (the API runs on a different origin than the client) — it
  // just navigates instead of saving. Fetching the file as a blob first and
  // triggering the save from a blob: URL (same-origin from the page's POV)
  // makes the download actually happen regardless of API/client origin.
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('download failed');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadName ?? 'file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Last resort: open it in a new tab so the user can save manually.
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* כפתור סגירה בולט, קבוע בפינה העליונה — לא זז עם גודל התוכן */}
      <button
        type="button"
        onClick={onClose}
        title="סגירה"
        className="fixed top-4 right-4 z-[60] w-11 h-11 rounded-full bg-white text-slate-900 text-xl font-black shadow-2xl ring-2 ring-white/50 hover:scale-110 transition-transform flex items-center justify-center"
      >
        ✕
      </button>

      {allowDownload && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          disabled={downloading}
          className="fixed top-4 right-20 z-[60] px-4 h-11 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-2xl transition-all disabled:opacity-50 flex items-center"
        >
          {downloading ? 'מוריד...' : '⬇️ הורדה'}
        </button>
      )}

      <div
        className={`relative w-full max-w-4xl max-h-[90vh] flex items-center justify-center transition-all duration-300 ${
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {isPdf ? (
          <iframe src={url} title="תצוגת מסמך" className="w-full h-[80vh] rounded-xl bg-white shadow-2xl" />
        ) : (
          <img src={url} alt="תצוגה מוגדלת" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" />
        )}
      </div>
    </div>
  );
}
