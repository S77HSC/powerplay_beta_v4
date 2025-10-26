/* eslint-disable @next/next/no-img-element */
'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { sessionData } from '../../lib/sessionData';
import NeonIconBar from '../../lobbycomponents/NeonIconBar';

/* --------------------------- image helpers --------------------------- */

// Ensure paths are web-safe. Keeps "/" but encodes spaces/() etc.
function asAssetURL(p) {
  if (!p) return '';
  return encodeURI(p);
}

// Normalize to a public URL path:
// - strip any "public/" prefix
// - ensure a single leading "/"
function normalizeAssetPath(p) {
  if (!p) return '';
  // remove leading "public/" if someone stored it
  let s = p.replace(/^\/?public\//, '');
  // ensure single leading slash
  s = s.startsWith('/') ? s : `/${s}`;
  return s.replace(/\/{2,}/g, '/');
}

function baseFromVideo(videoSrc) {
  if (!videoSrc) return '';
  const normalized = normalizeAssetPath(videoSrc);
  return normalized.replace(/\.(mp4|webm|mov|m4v)$/i, '');
}

// Build a preference-ordered list of possible image filenames.
function candidateImages({ videoSrc, poster }) {
  const base = baseFromVideo(videoSrc);
  const posterNorm = poster ? normalizeAssetPath(poster) : '';

  const raw = [
    posterNorm, // explicit poster/thumbnail wins
    `${base}.png`,
    `${base}.jpg`,
    `${base}.PNG`,
    `${base}.JPG`,
    `${base}-thumbnail.png`,
    `${base}-thumbnail.jpg`,
    `${base}_thumbnail.png`,
    `${base}_thumbnail.jpg`,
  ].filter(Boolean);

  // Deduplicate while preserving order + URL-encode
  const unique = [];
  const seen = new Set();
  for (const r of raw) {
    const enc = asAssetURL(r);
    if (!seen.has(enc)) {
      seen.add(enc);
      unique.push(enc);
    }
  }
  return unique;
}

function PreviewImage({ videoSrc, poster, alt }) {
  const candidates = candidateImages({ videoSrc, poster });
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  if (!candidates.length || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-300/70">
        No preview
      </div>
    );
  }

  const src = candidates[idx];

  return (
    <img
      src={src}
      alt={alt || 'Preview'}
      className="w-full h-full object-cover"
      onError={() => {
        if (idx < candidates.length - 1) {
          setIdx(idx + 1); // try next candidate
        } else {
          setFailed(true); // exhausted fallbacks
        }
      }}
    />
  );
}

/* ------------------------------ page ------------------------------- */

export default function PageContent() {
  const [player, setPlayer] = useState(null);

  // Fetch player from Supabase (unchanged)
  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('players')
          .select('id, points')
          .eq('auth_id', user.id)
          .single();
        if (data) setPlayer(data);
      } catch (e) {
        console.error('Player fetch failed', e);
      }
    })();
  }, []);

  // Build skills list from sessionData
  const skills = useMemo(
    () =>
      Object.entries(sessionData || {}).map(([id, data]) => ({
        id,
        ...data,
      })),
    []
  );

  // Dynamic height for the scroll area
  const scrollerRef = useRef(null);
  const [scrollerH, setScrollerH] = useState(480);
  useEffect(() => {
    const update = () => {
      const el = scrollerRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const vh = window.innerHeight;
      const h = Math.max(240, vh - top - 40); // 40px bottom gap
      setScrollerH(h);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const id = requestAnimationFrame(update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      cancelAnimationFrame(id);
    };
  }, []);

  if (!player) {
    return <div className="text-white p-10">Loading player…</div>;
  }

  return (
    <>
      <NeonIconBar player={player} />

      {/* Background */}
      <main
        className="pt-12 md:pt-14 min-h-screen relative overflow-hidden"
        style={{
          backgroundImage: "url('/images/futuristic-stadium_4.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/85 pointer-events-none" />

        {/* Content */}
        <section className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pb-12 md:pb-16">
          {/* Header */}
          <header className="mb-3 md:mb-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow">
                  Skills
                </h1>
                <p className="text-cyan-200/80 mt-1">
                  Earn points to unlock abilities. Only the list below scrolls.
                </p>
              </div>
              <div className="shrink-0">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-purple-400/30 bg-purple-500/15 text-purple-100 text-sm md:text-base shadow-[0_0_0_1px_rgba(168,85,247,0.15)_inset]">
                  <span className="font-semibold">{player.points}</span>
                  <span className="opacity-80">XP</span>
                </span>
              </div>
            </div>
            <div className="mt-3 h-px bg-gradient-to-r from-white/10 via-white/20 to-transparent" />
          </header>

          {/* Glass panel */}
          <div className="rounded-2xl border border-cyan-400/20 bg-black/35 backdrop-blur-xl shadow-[0_0_40px_rgba(0,255,255,0.08)] p-3 md:p-4">
            {/* Scroll container */}
            <div
              ref={scrollerRef}
              className="overflow-y-auto overscroll-contain pr-2"
              style={{ height: scrollerH, scrollbarGutter: 'stable' }}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 pb-6">
                {skills.map((skill) => {
                  const unlockXP = Number(skill.unlockXP ?? 0);
                  const pts = Number(player.points ?? 0);
                  const isUnlocked = pts >= unlockXP;
                  const needed = Math.max(unlockXP - pts, 0);
                  const progress = isUnlocked
                    ? 100
                    : Math.max(
                        0,
                        Math.min(
                          100,
                          Math.round((pts / Math.max(unlockXP || 1, 1)) * 100)
                        )
                      );

                  const videoSrc = skill.video || skill.videoUrl || null;
                  const posterSrc = skill.poster || skill.thumbnail || '';
                  const sessionKey = skill.id ?? skill.slug;

                  return (
                    <div
                      key={skill.id}
                      className={`group relative rounded-xl overflow-hidden border bg-gradient-to-b from-slate-900/60 to-black/60 backdrop-blur transition hover:shadow-[0_0_24px_rgba(56,189,248,0.35)] hover:-translate-y-0.5 ${
                        isUnlocked ? 'border-cyan-400/40' : 'border-white/10'
                      }`}
                      style={{ minHeight: '340px' }}
                    >
                      {/* Media */}
                      <div className="p-3">
                        <div className="w-full h-24 rounded-lg border border-white/10 overflow-hidden bg-black/30">
                          <PreviewImage
                            videoSrc={videoSrc}
                            poster={posterSrc}
                            alt={`${skill.title || 'Skill'} preview`}
                          />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="px-3 pb-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base md:text-lg font-semibold text-white leading-tight line-clamp-2">
                            {skill.title || 'Untitled Skill'}
                          </h3>
                          {isUnlocked ? (
                            <span className="shrink-0 text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-300/30">
                              Unlocked
                            </span>
                          ) : (
                            <span className="shrink-0 text-xs px-2 py-1 rounded-full bg-cyan-500/15 text-cyan-200 border border-cyan-300/25">
                              {needed} XP
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-zinc-300/80 line-clamp-2">
                          {skill.description ||
                            'Gain new abilities to level up your game.'}
                        </p>

                        {/* Progress */}
                        <div>
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className={`h-full ${
                                isUnlocked
                                  ? 'bg-emerald-400/80'
                                  : 'bg-cyan-400/80'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          {!isUnlocked && (
                            <div className="mt-1 text-[11px] text-zinc-300/80">
                              {progress}% to unlock
                            </div>
                          )}
                        </div>

                        {/* Actions (Details removed) */}
                        <div className="flex items-center justify-end pt-1">
                          <Link
                            href={`/skill-session?session=${encodeURIComponent(
                              sessionKey
                            )}`}
                            className="text-sm px-2.5 py-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-100 transition"
                          >
                            Earn XP
                          </Link>
                        </div>
                      </div>

                      {/* Hover glow */}
                      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.18),transparent_60%)]" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
