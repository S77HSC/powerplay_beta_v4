'use client';

import { useEffect, useState } from 'react';

/**
 * Blocks the UI with a “Rotate your iPad” overlay when the device
 * looks like an iPad and is in portrait. Works on iPadOS (even when UA says “Mac”).
 */
export default function OrientationGate({ onlyLandscape = true }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const looksLikeIpad = () => {
      const ua = navigator.userAgent || navigator.vendor || '';
      const touchMac = /Macintosh/.test(ua) && 'ontouchend' in document;
      return /iPad/.test(ua) || touchMac;
    };

    const check = () => {
      const portrait = window.matchMedia('(orientation: portrait)').matches;
      const w = window.innerWidth;
      const h = window.innerHeight;
      // iPad-ish size window (744–1180 logical px is iPad range)
      const ipadishSize = Math.min(w, h) >= 700 && Math.min(w, h) <= 1180;
      setShow(onlyLandscape && portrait && (looksLikeIpad() || ipadishSize));
    };

    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, [onlyLandscape]);

  if (!show) return null;

  return (
    <div className="rotate-overlay">
      <div className="rotate-card">
        <div className="rotate-badge">🔁</div>
        <h2>Rotate your iPad</h2>
        <p>PowerPlay runs in landscape on iPad for the best experience.</p>
      </div>
    </div>
  );
}
