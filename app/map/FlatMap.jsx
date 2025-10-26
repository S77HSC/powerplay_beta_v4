'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ComposableMap, Geographies, Geography, Marker, Line, ZoomableGroup
} from 'react-simple-maps';
import { geoInterpolate } from 'd3-geo';
import { supabase } from '../../lib/supabase';
import { getTour, getUnlockState } from '../../lib/tour';
import MapSkillModal from './MapSkillModal';
import NeonIconBar from '../../lobbycomponents/NeonIconBar'; // ← adjust path if needed

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// ---------- tuning ----------
const DOT_R = 3;
const DOT_R_NEXT = 4;
const TOUCH_R = 9;
const CLUSTER_R = 9;
const CLUSTER_DEG = 3;

const PATH_MAIN_WIDTH = 1.8;
const PATH_GLOW_WIDTH = 3.0;
const PATH_GLOW_OPACITY = 0.25;
// ----------------------------

const hasCoords = s => typeof s?.lat === 'number' && typeof s?.lng === 'number';

/** Great-circle polyline segments between A -> B */
function gcSegments(a, b, steps = 28) {
  const interp = geoInterpolate([a.lng, a.lat], [b.lng, b.lat]);
  const pts = Array.from({ length: steps + 1 }, (_, i) => interp(i / steps));
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
  return segs;
}

/** Simple grid-based clustering when zoomed out */
function buildClusters(nodes, zoom) {
  if (zoom >= 3) return nodes.map(n => ({ type: 'point', lat: n.lat, lng: n.lng, items: [n] }));
  const cell = CLUSTER_DEG;
  const buckets = new Map();
  for (const n of nodes) {
    const ky = `${Math.floor(n.lat / cell)}|${Math.floor(n.lng / cell)}`;
    if (!buckets.has(ky)) buckets.set(ky, []);
    buckets.get(ky).push(n);
  }
  const out = [];
  for (const list of buckets.values()) {
    if (list.length === 1) {
      const n = list[0];
      out.push({ type: 'point', lat: n.lat, lng: n.lng, items: [n] });
    } else {
      const lat = list.reduce((a, b) => a + b.lat, 0) / list.length;
      const lng = list.reduce((a, b) => a + b.lng, 0) / list.length;
      out.push({ type: 'cluster', lat, lng, items: list });
    }
  }
  return out;
}

export default function FlatMap() {
  const [player, setPlayer] = useState(null);
  const [selected, setSelected] = useState(null);
  const [origin, setOrigin] = useState(null); // click origin for modal animation

  // Viewport-aware SVG size for full-screen cover
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1920);
  const [vh, setVh] = useState(typeof window !== 'undefined' ? window.innerHeight : 980);
  useEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [center, setCenter] = useState([0, 20]); // [lng, lat]
  const [zoom, setZoom] = useState(1.35); // a touch larger on open

  // Hover preview + runner orb state
  const [hovered, setHovered] = useState(null);      // { s, x, y }
  const [runnerPos, setRunnerPos] = useState(null);  // [lng, lat]

  // --- Supply Drop (x2 XP on NEXT) ---
  const [boostEndsAt, setBoostEndsAt] = useState(null);   // ISO string
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('players')
        .select('id, points')
        .eq('auth_id', user.id)
        .single();
      setPlayer(data || { points: 0 });
    })();
  }, []);

  // Demo boost window stored locally (swap to backend later)
  useEffect(() => {
    const KEY = 'pp-next-boost-ends';
    let ends = localStorage.getItem(KEY);
    let endsAt = ends ? new Date(ends) : null;
    if (!endsAt || endsAt < new Date()) {
      endsAt = new Date(Date.now() + 45 * 60 * 1000); // 45 minutes
      localStorage.setItem(KEY, endsAt.toISOString());
    }
    setBoostEndsAt(endsAt.toISOString());
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const boostRemainingMs = boostEndsAt ? (new Date(boostEndsAt).getTime() - now) : 0;

  // Prefer your new sessionData.img; fall back to legacy fields; then a safe default.
  const tour = useMemo(() => {
    return getTour().map(n => ({
      ...n,
      img:
        n.img ||
        n.stadiumImage ||
        n.thumbnail ||
        '/stadiums/wembley.png',
    }));
  }, []);

  const points = player?.points || 0;
  const state = useMemo(() => getUnlockState(points), [points]);

  const current = state.current || null;
  const next = state.next || null;
  const boostActive = next && boostRemainingMs > 0;

  const unlockedNodes = useMemo(() => {
    const list = Array.isArray(state.unlocked)
      ? state.unlocked
      : tour.filter(s => points >= s.unlockXP);
    return [...list].sort((a, b) => a.unlockXP - b.unlockXP).filter(hasCoords);
  }, [state.unlocked, tour, points]);

  const plotted = useMemo(() => tour.filter(hasCoords), [tour]);

  const unlockedPathSegments = useMemo(() => {
    if (unlockedNodes.length < 2) return [];
    const segs = [];
    for (let i = 0; i < unlockedNodes.length - 1; i++) {
      segs.push(...gcSegments(unlockedNodes[i], unlockedNodes[i + 1], 24));
    }
    return segs;
  }, [unlockedNodes]);

  const curNextSegments = useMemo(() => {
    if (!current || !next || !hasCoords(current) || !hasCoords(next)) return [];
    return gcSegments(current, next, 24);
  }, [current, next]);

  const clustered = useMemo(() => buildClusters(plotted, zoom), [plotted, zoom]);

  const openDetailsFor = (s) => {
    setSelected({ ...s, __isNext: !!(next && s.id === next.id), img: s.img });
  };

  const onClusterClick = (cl) => {
    setCenter([cl.lng, cl.lat]);
    setZoom(z => Math.min(z * 1.7, 5));
  };

  // Dense list of points along unlocked path → smooth runner animation
  const pathPoints = useMemo(() => {
    if (!unlockedPathSegments?.length) return [];
    const pts = [];
    unlockedPathSegments.forEach(seg => {
      const [[x1,y1],[x2,y2]] = seg;
      const steps = 6; // density per segment
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
      }
    });
    return pts;
  }, [unlockedPathSegments]);

  // Animate the runner orb
  useEffect(() => {
    if (!pathPoints.length) return;
    let raf; let t = 0;
    const tick = () => {
      t = (t + 0.003) % 1; // speed
      const idx = Math.floor(t * (pathPoints.length - 1));
      setRunnerPos(pathPoints[idx]);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pathPoints]);

  // Points to "reveal" in fog-of-war
  const fogUnlockedPoints = useMemo(() => {
    if (!unlockedPathSegments?.length) return [];
    const seen = new Set();
    const acc = [];
    unlockedPathSegments.forEach(([[x1,y1],[x2,y2]]) => {
      const a = `${x1},${y1}`, b = `${x2},${y2}`;
      if (!seen.has(a)) { seen.add(a); acc.push([x1,y1]); }
      if (!seen.has(b)) { seen.add(b); acc.push([x2,y2]); }
    });
    return acc;
  }, [unlockedPathSegments]);

  const scale = 1 / zoom;
  const rNormal  = Math.max(2, DOT_R * scale);
  const rNext    = Math.max(3, DOT_R_NEXT * scale);
  const rTouch   = Math.max(8, TOUCH_R * scale);
  const rCluster = Math.max(7, CLUSTER_R * scale);

  // helper for mm:ss
  const fmt = (ms) => {
    const s = Math.max(0, Math.floor(ms/1000));
    const m = Math.floor(s/60).toString().padStart(2,'0');
    const ss = (s%60).toString().padStart(2,'0');
    return `${m}:${ss}`;
  };

  return (
  <div className="fixed inset-0 z-0">
    {/* CSS-only Fortnite-y background (no image file) */}
    {/* base color */}
    <div className="pointer-events-none absolute inset-0 bg-[#06121a]" />

    {/* subtle animated grid */}
    <div
      className="pointer-events-none absolute inset-0 opacity-[.08] mix-blend-screen"
      style={{
        backgroundImage: `
          linear-gradient(to right, #8be9fd 1px, transparent 1px),
          linear-gradient(to bottom, #8be9fd 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        animation: 'mapGrid 16s linear infinite',
      }}
    />
    {/* soft color vignettes */}
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: `
          radial-gradient(1100px 700px at 50% 0%, rgba(34,211,238,.14), transparent 70%),
          radial-gradient(900px 700px at 20% 100%, rgba(16,185,129,.10), transparent 70%),
          radial-gradient(1200px 900px at 80% 55%, rgba(59,130,246,.08), transparent 70%)
        `,
      }}
    />

    <style jsx>{`
      @keyframes mapGrid {
        from { background-position: 0px 0px, 0px 0px; }
        to   { background-position: 40px 80px, 40px 80px; }
      }
    `}</style>

    {/* Neon toolbar */}
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-20">
      <NeonIconBar current="map" />
    </div>

      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-start justify-between">
        <div className="text-white drop-shadow">
          <h1 className="text-xl font-bold">World Stadium Tour</h1>
          <p className="text-sm text-cyan-300">Points: <span className="font-semibold">{points}</span></p>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-gray-200">
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#22c55e]" /> Unlocked Path</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#3b82f6]" /> Current → Next</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#f59e0b]" /> Next Stop</span>
            {boostActive && (
              <span className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-amber-500/20 text-amber-200 border border-amber-400/30">
                <span className="text-[11px] font-bold">x2 XP ACTIVE</span>
                <span className="text-[11px] font-mono">{fmt(boostRemainingMs)}</span>
              </span>
            )}
          </div>
        </div>
        {next && (
          <div className="text-right text-xs text-gray-100 bg-black/35 border border-white/10 rounded-lg p-3 backdrop-blur">
            <div>Next: <span className="font-semibold">{next.title}</span></div>
            <div className="text-gray-300">{next.stadium ?? ''} • {next.location ?? ''}</div>
            <div className="text-gray-300">Needs {Math.max(0, next.unlockXP - points)} XP</div>
          </div>
        )}
      </div>

      {/* Full-screen, viewport-fitting map */}
      <ComposableMap
        projection="geoNaturalEarth1"
        width={vw}
        height={vh}
        preserveAspectRatio="xMidYMid slice"
        style={{ width: '100vw', height: '100vh', opacity: 0.98 }}
      >
        <defs>
          <radialGradient id="g-unlocked" cx="50%" cy="50%" r="65%">
            <stop offset="0%"  stopColor="#bff7ff" />
            <stop offset="55%" stopColor="#3be7ff" />
            <stop offset="100%" stopColor="#3be7ff22" />
          </radialGradient>
          <radialGradient id="g-next" cx="50%" cy="50%" r="65%">
            <stop offset="0%"  stopColor="#ffe8b3" />
            <stop offset="55%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#f59e0b22" />
          </radialGradient>
          <radialGradient id="g-locked" cx="50%" cy="50%" r="65%">
            <stop offset="0%"  stopColor="#e5e7eb" />
            <stop offset="55%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#94a3b822" />
          </radialGradient>
          <linearGradient id="pathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>

        <ZoomableGroup
          minZoom={0.9}
          maxZoom={6}
          center={center}
          zoom={zoom}
          onMove={({ zoom }) => setZoom(zoom)}
          onMoveEnd={({ coordinates, zoom }) => { setCenter(coordinates); setZoom(zoom); }}
        >
          {/* ---------- Fog-of-war mask & overlay ---------- */}
          <defs>
            <mask id="pp-reveal-mask">
              <rect x="-100%" y="-100%" width="400%" height="400%" fill="black" opacity="0.85" />
              {fogUnlockedPoints.map(([lng,lat], i) => (
                <circle key={i} cx={lng} cy={lat} r={14/zoom} fill="white" />
              ))}
              {unlockedPathSegments?.map(([[x1,y1],[x2,y2]], i) => (
                <Line key={`m-${i}`} from={[x1,y1]} to={[x2,y2]} stroke="white" strokeWidth={10/zoom} strokeLinecap="round" />
              ))}
              {next && typeof next.lng === 'number' && typeof next.lat === 'number' && (
                <circle cx={next.lng} cy={next.lat} r={22/zoom} fill="white" />
              )}
            </mask>
          </defs>

          <rect
            x="-100%" y="-100%" width="400%" height="400%"
            fill="rgba(6,12,18,.70)"
            style={{ mixBlendMode:'multiply' }}
            mask="url(#pp-reveal-mask)"
          />

          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  style={{
                    default: { fill: 'rgba(86,169,104,0.80)', stroke: 'rgba(22,78,99,0.6)', strokeWidth: 0.6 },
                    hover:   { fill: 'rgba(90,180,110,0.85)', stroke: 'rgba(12,74,110,0.9)', strokeWidth: 0.8 },
                    pressed: { fill: 'rgba(86,169,104,0.80)', stroke: 'rgba(22,78,99,0.6)', strokeWidth: 0.6 }
                  }}
                />
              ))
            }
          </Geographies>

          {/* Unlocked path */}
          {unlockedPathSegments.map(([[x1, y1], [x2, y2]], i) => (
            <g key={`u-${i}`}>
              <Line
                from={[x1, y1]} to={[x2, y2]}
                stroke="#22d3ee"
                strokeOpacity={PATH_GLOW_OPACITY}
                strokeWidth={PATH_GLOW_WIDTH}
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 4px rgba(34,211,238,0.55))' }}
              />
              <Line
                from={[x1, y1]} to={[x2, y2]}
                stroke="#7dd3fc"
                strokeWidth={PATH_MAIN_WIDTH}
                strokeLinecap="round"
              />
            </g>
          ))}

          {/* Current → Next */}
          {curNextSegments.map(([[x1, y1], [x2, y2]], i) => (
            <g key={`cn-${i}`}>
              <Line
                from={[x1, y1]} to={[x2, y2]}
                stroke="#3b82f6"
                strokeOpacity={0.35}
                strokeWidth={PATH_GLOW_WIDTH + 0.4}
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 5px rgba(59,130,246,0.65))' }}
              />
              <Line
                from={[x1, y1]} to={[x2, y2]}
                stroke="url(#pathGrad)"
                strokeWidth={PATH_MAIN_WIDTH + 0.2}
                strokeLinecap="round"
              />
            </g>
          ))}

          {/* Runner orb */}
          {runnerPos && (
            <Marker coordinates={runnerPos}>
              <g style={{ filter:'drop-shadow(0 0 6px rgba(255,255,255,.9))' }}>
                <circle r={2.2/zoom} fill="#fff" />
                <circle
                  r={5/zoom}
                  fill="transparent"
                  stroke="#22d3ee"
                  strokeWidth={1/zoom}
                  style={{ opacity:.55, animation:'ppRunnerPulse 1.2s infinite' }}
                />
              </g>
            </Marker>
          )}

          {/* Supply Drop ring on NEXT */}
          {boostActive && next && typeof next.lat === 'number' && typeof next.lng === 'number' && (
            <Marker coordinates={[next.lng, next.lat]}>
              <g className="pp-boost-spin" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                <circle r={28/zoom} fill="rgba(245,158,11,0.10)" />
                <circle r={24/zoom} fill="rgba(245,158,11,0.15)" style={{ animation: 'ppPulse 1.8s ease-out infinite' }} />
                <circle
                  r={22/zoom}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={1.6/zoom}
                  strokeDasharray={`${8/zoom} ${6/zoom}`}
                  opacity={0.95}
                />
                <text y={-12/zoom} textAnchor="middle" style={{ fill:'#fde68a', fontSize: 8/zoom, fontWeight: 800 }}>x2 XP</text>
              </g>
            </Marker>
          )}

          {/* Markers / Clusters */}
          {clustered.map((entry, idx) => {
            if (entry.type === 'cluster') {
              const count = entry.items.length;
              return (
                <Marker
                  key={`c-${idx}`}
                  coordinates={[entry.lng, entry.lat]}
                  onClick={(e) => { e.stopPropagation(); onClusterClick(entry); }}
                  style={{ cursor: 'pointer' }}
                >
                  <g transform={`scale(${scale})`} className="transition-transform duration-150 hover:scale-[1.15]">
                    <circle r={Math.max(7, CLUSTER_R * scale)} fill="#0b1320" stroke="#94a3b8" strokeWidth={1.6} />
                    <text y={3} textAnchor="middle" style={{ fill: '#e5e7eb', fontSize: 9, fontWeight: 700 }}>{count}</text>
                  </g>
                </Marker>
              );
            }

            const s = entry.items[0];
            const isUnlocked = points >= s.unlockXP;
            const isNext = next && s.id === next.id;

            const ring = isUnlocked ? '#22c55e' : isNext ? '#f59e0b' : '#cbd5e1';
            const glow = isUnlocked
              ? '0 0 6px rgba(34,197,94,0.70)'
              : isNext
              ? '0 0 6px rgba(245,158,11,0.70)'
              : '0 0 4px rgba(203,213,225,0.60)';

            const fillId = isUnlocked ? 'url(#g-unlocked)' : isNext ? 'url(#g-next)' : 'url(#g-locked)';

            return (
              <Marker
                key={s.id}
                coordinates={[s.lng, s.lat]}
                onMouseEnter={(e) => {
                  const n = e.nativeEvent;
                  setHovered({ s, x: n.clientX, y: n.clientY });
                }}
                onMouseLeave={() => setHovered(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setHovered(null);
                  const n = e.nativeEvent;
                  setOrigin({ x: n.clientX, y: n.clientY });
                  openDetailsFor(s);
                }}
                style={{ cursor: 'pointer' }}
              >
                <g transform={`scale(${scale})`} className="transition-transform duration-150 hover:scale-[1.2]">
                  <circle r={Math.max(8, TOUCH_R * scale)} fill="transparent" />
                  {isNext && (
                    <circle
                      r={Math.max(3, DOT_R_NEXT * scale) + 5}
                      fill="rgba(245,158,11,0.16)"
                      style={{ animation: 'pingGlow 1.6s infinite' }}
                    />
                  )}
                  <circle r={(isNext ? rNext : rNormal) + 1.2} fill="transparent" stroke={ring} strokeWidth={1.1} />
                  <circle
                    r={isNext ? rNext : rNormal}
                    fill={fillId}
                    stroke="rgba(12,22,40,0.9)"
                    strokeWidth={0.6}
                    style={{ filter: `drop-shadow(${glow})` }}
                  />
                </g>
                <title>{s.stadium || s.title}</title>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {/* Hover preview card */}
      {hovered && (
        <div
          className="fixed z-50 rounded-xl overflow-hidden border border-white/10 shadow-xl pointer-events-none"
          style={{ left: hovered.x + 16, top: hovered.y + 16, width: 240, background:'rgba(6,12,18,.95)' }}
        >
          <div style={{ position:'relative', width:'100%', aspectRatio:'16 / 9' }}>
            <img
              src={hovered.s.img || hovered.s.thumbnail || '/stadiums/wembley.png'}
              alt=""
              style={{ width:'100%', height:'100%', objectFit:'cover' }}
            />
          </div>
          <div className="p-3">
            <div className="text-white text-sm font-semibold truncate">{hovered.s.stadium ?? hovered.s.title}</div>
            <div className="text-xs text-slate-300 truncate">{hovered.s.location ?? ''}</div>
            <div className="mt-2 text-[11px] text-slate-300">
              Unlocks at <b className="text-white">{hovered.s.unlockXP} XP</b>
            </div>
          </div>
        </div>
      )}

      {/* Details modal */}
      {selected && (
        <MapSkillModal
          skill={selected}
          points={points}
          origin={origin}
          onClose={() => setSelected(null)}
          boostActive={boostActive && selected?.id === next?.id}
          boostRemainingMs={boostRemainingMs}
        />
      )}

      <style jsx global>{`
        @keyframes pingGlow {
          0% { transform: scale(1); opacity: 0.9; }
          70% { transform: scale(1.8); opacity: 0; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes ppRunnerPulse {
          0% { transform: scale(1); opacity: .6; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .pp-boost-spin { animation: ppSpin 12s linear infinite; }
        @keyframes ppSpin { to { transform: rotate(360deg); } }
        @keyframes ppPulse {
          0% { transform: scale(1); opacity: .35; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
