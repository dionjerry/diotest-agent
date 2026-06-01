'use client';

import { useCallback, useEffect, useState } from 'react';

export interface RecorderStepData {
  id: string;
  timestamp: string;
  action: string;
  title: string;
  selector?: string;
  url: string;
  value?: string;
  kept: boolean;
  screenshot?: { id: string; capturedAt: string; dataUrl: string };
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    click: 'Clicked', input: 'Typed', change: 'Changed', select: 'Selected',
    submit: 'Submitted', focus: 'Focused', blur: 'Blurred', scroll: 'Scrolled',
    keydown: 'Key press', navigation: 'Navigated',
  };
  return map[action] ?? action;
}

function actionChipClass(action: string): string {
  if (action === 'click') return 'bg-blue-500/10 text-blue-400';
  if (action === 'navigation') return 'bg-purple-500/10 text-purple-400';
  if (action === 'input' || action === 'change') return 'bg-emerald-500/10 text-emerald-400';
  if (action === 'submit') return 'bg-amber-500/10 text-amber-400';
  return 'bg-zinc-800/60 text-zinc-400';
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: { src: string; caption: string }[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);

  const prev = useCallback(() => setIndex((i) => (i > 0 ? i - 1 : images.length - 1)), [images.length]);
  const next = useCallback(() => setIndex((i) => (i < images.length - 1 ? i + 1 : 0)), [images.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prev, next]);

  const current = images[index];
  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 z-10 p-2 text-zinc-400 hover:text-white bg-zinc-900/80 rounded-lg transition-colors"
        onClick={onClose}
      >
        <span className="material-symbols-outlined text-[20px]">close</span>
      </button>

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs text-zinc-400 bg-zinc-900/80 px-3 py-1.5 rounded-full">
          {index + 1} / {images.length}
        </div>
      )}

      {/* Prev */}
      {images.length > 1 && (
        <button
          className="absolute left-4 p-3 text-zinc-400 hover:text-white bg-zinc-900/80 rounded-lg transition-colors z-10"
          onClick={(e) => { e.stopPropagation(); prev(); }}
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
      )}

      {/* Image */}
      <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <img
          src={current.src}
          alt={current.caption}
          className="max-w-[88vw] max-h-[80vh] object-contain rounded-lg shadow-2xl border border-zinc-800/60"
        />
        <p className="text-xs text-zinc-500 text-center max-w-[60ch] leading-5">{current.caption}</p>
      </div>

      {/* Next */}
      {images.length > 1 && (
        <button
          className="absolute right-4 p-3 text-zinc-400 hover:text-white bg-zinc-900/80 rounded-lg transition-colors z-10"
          onClick={(e) => { e.stopPropagation(); next(); }}
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      )}
    </div>
  );
}

// ── Step list ────────────────────────────────────────────────────────────────

export function RecorderStepList({ steps }: { steps: RecorderStepData[] }) {
  const [lightbox, setLightbox] = useState<{ images: { src: string; caption: string }[]; index: number } | null>(null);

  // Build an array of all screenshot images for navigation
  const allImages = steps
    .filter((s) => s.screenshot?.dataUrl && s.screenshot.dataUrl.length > 0)
    .map((s) => ({ src: s.screenshot!.dataUrl, caption: s.title }));

  function openLightbox(screenshotSrc: string) {
    const idx = allImages.findIndex((img) => img.src === screenshotSrc);
    if (idx !== -1) setLightbox({ images: allImages, index: idx });
  }

  return (
    <>
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      <div className="space-y-2">
        {steps.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-600 gap-3">
            <span className="material-symbols-outlined text-4xl">videocam_off</span>
            <p className="text-sm">No steps recorded in this session.</p>
          </div>
        )}

        {steps.map((step, i) => {
          const hasScreenshot = Boolean(step.screenshot?.dataUrl && step.screenshot.dataUrl.length > 0);

          return (
            <div
              key={step.id}
              className={`rounded-lg border overflow-hidden transition-colors ${
                step.kept
                  ? 'bg-[#19191d] border-zinc-800/30'
                  : 'bg-[#141418] border-zinc-800/20 opacity-55'
              }`}
            >
              {/* Step header row */}
              <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                {/* Index + kept indicator */}
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0 pt-0.5 w-5">
                  <span className="text-[10px] font-mono text-zinc-600 leading-none">{i + 1}</span>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${step.kept ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0 ${actionChipClass(step.action)}`}>
                      {actionLabel(step.action)}
                    </span>
                    <span className="text-sm text-zinc-200 font-medium leading-snug">{step.title}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-zinc-600 flex-wrap font-mono">
                    {step.selector && (
                      <span className="bg-zinc-900/60 px-1.5 py-0.5 rounded text-zinc-500 truncate max-w-[18ch]">{step.selector}</span>
                    )}
                    {step.value && (
                      <span className="text-zinc-500">"{step.value.slice(0, 40)}{step.value.length > 40 ? '…' : ''}"</span>
                    )}
                    <span className="text-zinc-700">{new Date(step.timestamp).toLocaleTimeString()}</span>
                    <span className="truncate max-w-[30ch] text-zinc-700">{step.url}</span>
                  </div>
                </div>
              </div>

              {/* Screenshot — full-width below, click to open lightbox */}
              {hasScreenshot && (
                <div className="px-4 pb-4">
                  <button
                    type="button"
                    className="w-full group relative overflow-hidden rounded-lg border border-zinc-800/40 hover:border-zinc-600/60 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    onClick={() => openLightbox(step.screenshot!.dataUrl)}
                    title="Click to expand"
                  >
                    <img
                      src={step.screenshot!.dataUrl}
                      alt={step.title}
                      className="w-full h-auto max-h-64 object-contain bg-zinc-950"
                      loading="lazy"
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 bg-black/70 rounded-lg px-3 py-2 text-xs text-white">
                        <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                        Click to expand
                      </div>
                    </div>
                    {/* Timestamp badge */}
                    <div className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-zinc-400 rounded px-1.5 py-0.5 font-mono">
                      {new Date(step.screenshot!.capturedAt).toLocaleTimeString()}
                    </div>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
