/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const Z_TOP = 2147483647; // max practical z-index

export default function ItemPreviewModal({ open = false, item = null, onClose, onUnlock }) {
  const [mounted, setMounted] = useState(false);
  const [portalEl, setPortalEl] = useState(null);
  const safe = item ?? {};

  // Create (or reuse) a portal root appended as the LAST child of <body>
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('pp-modal-root');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pp-modal-root';
      document.body.appendChild(el);
    } else {
      document.body.appendChild(el); // ensure it paints last
    }
    setPortalEl(el);
    setMounted(true);
  }, []);

  // Lock scroll + add a class that only disables clicks on other *fixed* layers
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('locker-modal-open');
    const cleanup = () => {
      document.body.style.overflow = prev;
      document.body.classList.remove('locker-modal-open');
    };
    return cleanup;
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Derive fields safely
  const title = safe.title ?? safe.name ?? 'Locker Item';
  const description =
    safe.description ?? 'Preview this item. Unlock with XP to equip it in your locker.';
  const cost = Number.isFinite(safe.cost) ? safe.cost : (Number(safe.xp) || null);

  const previewSrc = useMemo(() => {
    const src = safe.image || safe.preview || safe.thumbnail || safe.poster || '';
    if (src) return normalize(src);
    if (safe.video) {
      const base = normalize(safe.video).replace(/\.(mp4|webm|mov|m4v)$/i, '');
      return `${base}.png`;
    }
    return '';
  }, [safe.image, safe.preview, safe.thumbnail, safe.poster, safe.video]);

  if (!mounted || !portalEl || !open) return null;

  const modal = (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2147483647] isolate bg-black/80 backdrop-blur-sm grid place-items-center pointer-events-auto"
        onClick={onClose}             // backdrop click closes
        aria-modal="true"
        role="dialog"
      >
        <motion.div
          key="panel"
          initial={{ y: 16, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 8, opacity: 0, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 220, damping: 24 }}
          onClick={(e) => e.stopPropagation()}  // keep clicks inside from closing
          style={{ zIndex: Z_TOP }}
          className="relative mx-3 w-full max-w-6xl rounded-2xl overflow-hidden border border-white/12 bg-[#0a0f18]/95 shadow-2xl"
        >
          {/* top-right close */}
          <button
            aria-label="Close"
            onClick={onClose}
            style={{ zIndex: Z_TOP }}
            className="absolute right-3 top-3 h-9 px-3 rounded-lg bg-black/60 text-white/90 border border-white/15 hover:bg-black/50"
          >
            Close
          </button>

          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr]">
            {/* preview */}
            <div className="p-6">
              <div className="w-full aspect-[4/3] rounded-xl border border-white/10 bg-black/30 overflow-hidden grid place-items-center">
                {previewSrc ? (
                  <img src={previewSrc} alt={`${title} preview`} className="max-w-full max-h-full object-contain" />
                ) : (
                  <div className="text-zinc-300/70 text-sm">No preview</div>
                )}
              </div>
            </div>

            {/* details */}
            <div className="p-6 bg-gradient-to-b from-zinc-900/40 to-black/30">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl md:text-2xl font-bold text-white">{title}</h3>
                {cost !== null && (
                  <span className="shrink-0 text-[13px] px-2.5 py-1.5 rounded-lg border border-amber-400/30 bg-amber-500/15 text-amber-200">
                    XP {cost}
                  </span>
                )}
              </div>

              {description && (
                <p className="mt-3 text-zinc-300/85 leading-relaxed">{description}</p>
              )}

              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white/90"
                >
                  Close
                </button>
                {typeof onUnlock === 'function' && (
                  <button
                    onClick={() => onUnlock(safe)}
                    className="px-4 py-2 rounded-lg font-semibold text-black bg-amber-400 hover:brightness-95"
                  >
                    Unlock
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modal, portalEl);
}

/* helpers */
function normalize(p) {
  let s = String(p || '').replace(/^\/?public\//, '');
  if (!s.startsWith('/')) s = `/${s}`;
  return encodeURI(s);
}