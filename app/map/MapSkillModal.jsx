// lobbycomponents/MapSkillModal.jsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MapSkillModal({
  session,
  skill,
  stop,
  points = 0,
  open,
  onClose,
}) {
  const router = useRouter();

  // keep a truthy object just to control visibility
  const anyData = useMemo(() => session || skill || stop || null, [session, skill, stop]);
  const isOpen = (open ?? !!anyData) && !!anyData;
  const [navigating, setNavigating] = useState(false);

  if (!isOpen) return null;

  // ----- Field precedence: session > skill > stop -----
  const pick = (field, fallback = undefined) =>
    session?.[field] ?? skill?.[field] ?? stop?.[field] ?? fallback;

  // token (id/slug) – use whichever object has it
  const token =
    session?.session || session?.sessionId || session?.slug || session?.code || session?.id || session?.key ||
    skill?.session   || skill?.sessionId   || skill?.slug   || skill?.code   || skill?.id   || skill?.key   ||
    stop?.session    || stop?.sessionId    || stop?.slug    || stop?.code    || stop?.id    || stop?.key    || '';

  const href = token ? `/skill-session?session=${encodeURIComponent(token)}` : '';

  const stadiumName = pick('stadium', 'Stadium');
  const location    = pick('location', '');
  const title       = pick('title', 'Skill Session');

  // Preferred preview image strictly from session/skill/stop (Wembley as final fallback)
  const preferredImg = session?.img ?? skill?.img ?? stop?.img ?? '/stadiums/wembley.png';
  const [imgSrc, setImgSrc] = useState(preferredImg);
  useEffect(() => setImgSrc(preferredImg), [preferredImg]);

  // Smart fallback: try switching extension before defaulting to Wembley
  const onImgError = () => {
    if (/\.png$/i.test(imgSrc)) {
      setImgSrc(imgSrc.replace(/\.png$/i, '.jpg'));
    } else if (/\.jpe?g$/i.test(imgSrc)) {
      setImgSrc(imgSrc.replace(/\.jpe?g$/i, '.png'));
    } else if (imgSrc !== '/stadiums/wembley.png') {
      setImgSrc('/stadiums/wembley.png');
    }
  };

  const unlockXP = Number.isFinite(session?.unlockXP)
    ? Number(session.unlockXP)
    : Number.isFinite(skill?.unlockXP)
    ? Number(skill.unlockXP)
    : Number.isFinite(stop?.unlockXP)
    ? Number(stop.unlockXP)
    : 0;

  const playerXP = Number(points) || 0;
  const pct = Math.max(0, Math.min(100, unlockXP ? (playerXP / unlockXP) * 100 : 100));
  const unlocked = !unlockXP || playerXP >= unlockXP;

  // prefetch destination
  useEffect(() => {
    if (!isOpen || !token) return;
    try { router.prefetch(href); } catch {}
  }, [isOpen, token, href, router]);

  // esc to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const go = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!unlocked || !token || navigating) return;
    setNavigating(true);
    onClose?.();
    setTimeout(() => { window.location.href = href; }, 0);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className="relative z-10 w-[min(1000px,94vw)] rounded-2xl bg-[#0b1220] text-white shadow-2xl border border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-white/10">
          <div>
            <div className="uppercase text-[11px] tracking-[0.25em] text-cyan-300/80">Stadium</div>
            <div className="text-xl font-extrabold leading-tight">{stadiumName}</div>
            {location && <div className="text-xs text-slate-300">{location}</div>}
          </div>
          <button
            type="button"
            className="h-9 w-9 grid place-items-center rounded-md bg-white/5 hover:bg-white/10"
            aria-label="Close"
            onClick={(e) => { e.stopPropagation(); onClose?.(); }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Stadium image (object-contain to avoid cropping) */}
          <div className="relative aspect-video w-full bg-slate-900/40 grid place-items-center">
            <img
              src={imgSrc}
              alt={`${stadiumName} stadium`}
              className="max-h-full max-w-full object-contain"
              draggable={false}
              onError={onImgError}
            />
          </div>

          {/* Right column */}
          <div className="p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border ${
                  unlocked
                    ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200'
                    : 'bg-amber-500/10 border-amber-400/30 text-amber-200'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${unlocked ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {unlocked ? 'Unlocked' : 'Locked'}
              </span>
              <span className="text-xs text-slate-400">
                Unlocks at <b>{unlockXP} XP</b> • You: {playerXP} XP
              </span>
            </div>

            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full ${unlocked ? 'bg-emerald-400' : 'bg-gradient-to-r from-cyan-400 to-blue-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div>
              <div className="uppercase text-[11px] tracking-[0.25em] text-cyan-300/80 mb-1">Skill</div>
              <div className="text-lg font-bold leading-tight">{title}</div>
              {(session?.description ?? skill?.description ?? stop?.description) && (
                <p className="mt-2 text-sm text-slate-300 line-clamp-3">
                  {session?.description ?? skill?.description ?? stop?.description}
                </p>
              )}
            </div>

            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!unlocked || !token || navigating}
                onClick={go}
                className={`h-12 grid place-items-center rounded-xl font-semibold shadow-[0_10px_30px_rgba(56,189,248,.35)]
                  ${
                    !unlocked || !token || navigating
                      ? 'bg-slate-700/60 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:brightness-110'
                  }`}
                aria-disabled={!unlocked || !token}
              >
                {navigating ? 'Opening…' : 'Enter Training Room'}
              </button>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                className="h-12 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10"
              >
                Close
              </button>
            </div>

            <div className="text-[11px] text-slate-400">Tip: <b>Esc</b> = Close</div>
          </div>
        </div>
      </div>
    </div>
  );
}
