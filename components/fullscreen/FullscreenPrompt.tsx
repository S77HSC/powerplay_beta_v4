'use client';

import { useState } from 'react';
import { useFullscreenAutoGate, enterFullscreen, exitFullscreen, isFullscreen } from './useFullscreen';

export default function FullscreenPrompt() {
  const { enableEverywhere, disableEverywhere } = useFullscreenAutoGate();
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('prefersFullscreen') !== '1' && !isFullscreen();
  });

  const goFS = async (e) => {
    e.stopPropagation(); // don't let the global auto-gate see this click
    enableEverywhere();
    await enterFullscreen();
    setOpen(false);
  };
  const close = (e) => {
    e.stopPropagation();
    disableEverywhere();
    setOpen(false);
  };
  const toggle = async (e) => {
    e.stopPropagation();
    if (isFullscreen()) await exitFullscreen();
    else await enterFullscreen();
  };

  return (
    <>
      {/* Always-available mini toggle */}
      <button
        data-fs-toggle
        onClick={toggle}
        className="fixed right-3 top-3 z-[1000] rounded-md border border-white/20 bg-black/40 px-2.5 py-1.5 text-xs text-white hover:bg-black/60"
        aria-label="Toggle Full Screen"
      >
        {isFullscreen() ? 'Exit Full Screen' : 'Full Screen'}
      </button>

      {/* One-time soft prompt */}
      {open && (
        <div
          data-fs-prompt
          className="fixed inset-x-0 bottom-4 z-[999] mx-auto w-fit rounded-xl border border-white/15 bg-black/70 px-4 py-3 text-white shadow-lg backdrop-blur"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm">Best viewed in full screen.</span>
            <button
              data-fs-toggle
              onClick={goFS}
              className="rounded-md bg-emerald-400 px-3 py-1.5 text-sm font-semibold text-black hover:brightness-110"
            >
              Enter & remember
            </button>
            <button
              data-fs-toggle
              onClick={close}
              className="rounded-md border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </>
  );
}
