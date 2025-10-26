'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sessionData } from '../../lib/sessionData'; // ← same place your map uses

const BLUR_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

// build the key your classic trainer expects, e.g. "session_4_outside_take_stop"
function makeLegacyKey(skill) {
  if (!skill) return '';
  if (skill.legacyKey) return skill.legacyKey;
  const slugFrom = (skill.shortTitle || skill.title || '').toLowerCase();
  const slug = slugFrom.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `session_${skill.id}_${slug}`;
}

export default function ArenaClient() {
  const router = useRouter();
  const search = useSearchParams();

  const idStr =
    search.get('session') ||
    search.get('id') ||
    search.get('skill') ||
    search.get('sessionId') ||
    search.get('skillId');

  const id = idStr ? Number(idStr) : NaN;
  const skill = useMemo(() => {
    if (!Number.isFinite(id)) return null;
    return Array.isArray(sessionData) ? sessionData[id] ?? null : sessionData?.[id] ?? null;
  }, [id]);

  if (!skill) {
    return (
      <main className="min-h-screen bg-[#050c12] text-white p-8">
        <h1 className="text-xl font-bold mb-2">Skill not found</h1>
        <p className="text-slate-300 mb-6">Open a skill again from the map.</p>
        <button onClick={() => router.push('/map')} className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-700">
          Back to Map
        </button>
      </main>
    );
  }

  const legacyKey = makeLegacyKey(skill);
  const poster = skill.img || skill.thumbnail || '/stadiums/wembley.png';

  // two possible iframes:
  //  - your 3D arena HTML (put this file in /public): /powerplay-arena-standalone.html
  //  - the classic trainer (camera + touch counter): /skill-player?session=...
  const arenaSrc = `/powerplay-arena-standalone.html?session=${legacyKey}`;
  const trainerSrc = `/skill-player?session=${legacyKey}`;

  // toggle with ?classic=1 to force the legacy trainer instead of the 3D arena
  const useClassic = search.get('classic') === '1';
  const iframeSrc = useClassic ? trainerSrc : arenaSrc;

  return (
    <main className="relative min-h-screen bg-[#050c12] text-white overflow-hidden">
      {/* subtle grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[.08] mix-blend-screen">
        <div className="absolute inset-0 bg-[length:40px_40px] bg-[linear-gradient(to_right,#8be9fd_1px,transparent_1px),linear-gradient(to_bottom,#8be9fd_1px,transparent_1px)] animate-[mapGrid_16s_linear_infinite]" />
      </div>
      <style jsx global>{`
        @keyframes mapGrid {
          from { background-position: 0px 0px, 0px 0px; }
          to   { background-position: 40px 80px, 40px 80px; }
        }
      `}</style>

      {/* header */}
      <div className="sticky top-0 z-30 border-b border-white/5 bg-black/30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between p-3">
          <div className="text-sm">
            <div className="uppercase tracking-[0.2em] text-cyan-300/80 text-[11px]">STADIUM</div>
            <div className="font-bold">{skill.stadium || skill.title}</div>
            <div className="text-xs text-slate-300">{skill.location}</div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/map" className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-sm border border-white/10">
              Back to Map
            </Link>
            <Link
              href={`/arena?session=${id}&classic=${useClassic ? '0' : '1'}`}
              className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-sm border border-white/10"
            >
              {useClassic ? 'Use 3D Arena' : 'Use Classic Trainer'}
            </Link>
          </div>
        </div>
      </div>

      {/* two-column layout */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8 p-6">
        {/* LEFT: poster + info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative rounded-2xl border border-cyan-400/20 bg-white/5 overflow-hidden shadow-[0_0_32px_rgba(34,211,238,.15)]">
            <div className="relative w-full" style={{ aspectRatio: '16 / 9', minHeight: 240 }}>
              <Image
                src={poster}
                alt={skill.stadium || skill.title}
                fill
                priority
                placeholder="blur"
                blurDataURL={BLUR_PIXEL}
                className="object-cover"
              />
            </div>
            <div className="p-4 border-t border-white/10 bg-black/30 backdrop-blur">
              <h1 className="text-lg font-extrabold">{skill.title}</h1>
              <p className="text-xs text-slate-300">{skill.stadium} • {skill.location}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="uppercase tracking-[0.25em] text-[10px] text-cyan-300/80">Unlocks</div>
            <div className="mt-1 text-sm">at <b>{skill.unlockXP} XP</b></div>
          </div>
        </div>

        {/* RIGHT: trainer / arena */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur p-2">
            <iframe
              src={iframeSrc}
              className="w-full h-[calc(100vh-220px)] rounded-xl border border-white/10"
              // for camera/mic in iframe, keep same-origin and allow:
              allow="camera; microphone; autoplay; clipboard-read; clipboard-write; fullscreen"
              title={useClassic ? 'PowerPlay Trainer' : 'PowerPlay Arena 3D'}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
