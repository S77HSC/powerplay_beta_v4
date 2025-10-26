'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

let switching = false;     // debounce fullscreen transitions
let switchingTimer = null;
const LOCK_MS = 800;

function lock() {
  switching = true;
  clearTimeout(switchingTimer);
  switchingTimer = setTimeout(() => (switching = false), LOCK_MS);
}

export function isFullscreen() {
  const d = document;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

export async function enterFullscreen(el = document.documentElement) {
  if (switching || isFullscreen()) return;
  lock();
  try {
    await (el.requestFullscreen?.() ??
      el.webkitRequestFullscreen?.() ??
      el.msRequestFullscreen?.());
  } catch {}
}

export async function exitFullscreen() {
  if (switching || !isFullscreen()) return;
  lock();
  const d = document;
  try {
    await (d.exitFullscreen?.() ??
      d.webkitExitFullscreen?.() ??
      d.msExitFullscreen?.());
  } catch {}
}

export function useFullscreenAutoGate(storageKey = 'prefersFullscreen') {
  const [enabled, setEnabled] = useState(isFullscreen());
  const ignoreTargets = useRef(['[data-fs-toggle]', '[data-fs-prompt]']);

  // keep state in sync when user hits ESC, etc.
  useEffect(() => {
    const onChange = () => setEnabled(isFullscreen());
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  // If user opted in, request fullscreen on FIRST neutral click/keydown.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pref = localStorage.getItem(storageKey) === '1';
    if (!pref || isFullscreen()) return;

    const shouldIgnore = (ev) => {
      const t = ev.target;
      return ignoreTargets.current.some((sel) => t?.closest?.(sel));
    };

    const handler = async (ev) => {
      if (shouldIgnore(ev)) return; // don't double-fire with the toggle/prompt
      await enterFullscreen();
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };

    // capture=true so we see the event before other handlers toggle FS
    window.addEventListener('pointerdown', handler, { once: true, capture: true });
    window.addEventListener('keydown', handler, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', handler, { capture: true });
      window.removeEventListener('keydown', handler, { capture: true });
    };
  }, [storageKey]);

  const enableEverywhere = useCallback(() => {
    localStorage.setItem(storageKey, '1');
  }, [storageKey]);

  const disableEverywhere = useCallback(() => {
    localStorage.setItem(storageKey, '0');
  }, [storageKey]);

  return { enabled, enableEverywhere, disableEverywhere };
}
