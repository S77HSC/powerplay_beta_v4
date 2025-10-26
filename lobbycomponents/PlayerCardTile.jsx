'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

/* ============ utils / math ============ */
const BASE = 20;
const clamp = (n, lo = BASE, hi = 99) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
const toNumber = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const parseJSON = (x) => { try { return typeof x === 'string' ? JSON.parse(x || '{}') : (x || {}); } catch { return {}; } };

const toPublicUrlMaybe = (u) => {
  if (!u) return null;
  if (/^https?:\/\//i.test(u) || u.startsWith('/')) return u;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  const bucket = (process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET || 'avatars').replace(/^\/+|\/+$/g, '');
  const key = u.replace(/^\/+/, '');
  const path = key.startsWith(bucket + '/') ? key : `${bucket}/${key}`;
  return base ? `${base}/storage/v1/object/public/${path}` : u;
};

function tierCapFor(status) {
  switch ((status || '').toLowerCase()) {
    case 'legend':   return 95;
    case 'master':   return 88;
    case 'pro':      return 75;
    case 'semi-pro': return 60;
    default:         return 45;
  }
}
function floorForTier(status) {
  switch ((status || '').toLowerCase()) {
    case 'legend':   return 46;
    case 'master':   return 42;
    case 'pro':      return 34;
    case 'semi-pro': return 28;
    default:         return 22;
  }
}
const clampToTier = (val, cap) => Math.max(BASE, Math.min(Math.max(BASE, cap || 60), Math.round(Number(val) || 0)));

/* decay */
function inactivityFactorStats(lastCompletedAt) {
  if (!lastCompletedAt) return 1;
  const t = new Date(lastCompletedAt).getTime();
  if (!Number.isFinite(t)) return 1;
  const days = Math.max(0, Math.floor((Date.now() - t) / 86400000));
  if (days <= 7) return 1;
  const weeks = Math.floor((days - 7) / 7) + 1;
  return Math.max(0.6, Math.pow(0.93, weeks));
}
function applyDecayToStats(stats, cap, factor) {
  const CAP = Math.max(BASE, Math.min(99, Number(cap) || 60));
  const out = {};
  for (const k of ['pac','sho','pas','dri','def','phy']) {
    const v = Number(stats[k] || BASE);
    const decayed = BASE + factor * (v - BASE);
    out[k] = clamp(decayed, BASE, CAP);
  }
  return out;
}

/* jitter + diversify */
function seedInt(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; h += h << 5;
  return h >>> 0;
}
function jitter(seed, tag, lo, hi) { const s = seedInt(`${seed}:${tag}`); const span = hi - lo + 1; return lo + (s % span); }
function diversify(stats, cap, seed) {
  const CAP  = Math.max(BASE, Math.min(99, Number(cap) || 60));
  const keys = ['pac','sho','pas','dri','def','phy'];
  const out = { ...stats };
  const micro = CAP >= 75 ? 2 : 1;
  for (const k of keys) {
    const j = jitter(seed || 'seed', k.toUpperCase(), -micro, micro);
    out[k] = Math.max(BASE, Math.min(CAP, Math.round((Number(out[k])||BASE) + j)));
  }
  const seen = new Map();
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i], v = out[k];
    const c = (seen.get(v) || 0) + 1;
    seen.set(v, c);
    if (c > 1) out[k] = Math.max(BASE, Math.min(CAP, v + (i < 3 ? -1 : +1)));
  }
  return out;
}

/* rebalance */
function rebalanceTowardAverage(stats, cap, status) {
  const CAP = Math.max(BASE, Math.min(99, Number(cap) || 60));
  const floor = floorForTier(status);
  const keys = ['pac','sho','pas','dri','def','phy'];
  const avg = keys.reduce((s,k)=>s+(Number(stats[k]||BASE)),0) / keys.length;
  const out = { ...stats };
  for (const k of keys) {
    let v = Number(out[k] || BASE);
    if (v < avg - 10) v = v + 0.6*(avg - v);
    v = Math.max(floor, v);
    out[k] = Math.max(BASE, Math.min(CAP, Math.round(v)));
  }
  return out;
}

/* archetype */
function archetypeWeights(position) {
  const pos = (position || 'ST').toUpperCase();
  switch (pos) {
    case 'ST': return { pac: 1.0, sho: 1.2, pas: 0.7, dri: 0.9, def: 0.5, phy: 1.0 };
    case 'CM': return { pac: 0.8, sho: 0.9, pas: 1.2, dri: 1.1, def: 1.0, phy: 1.0 };
    case 'CB': return { pac: 0.7, sho: 0.6, pas: 0.9, dri: 0.6, def: 1.3, phy: 1.2 };
    case 'LW':
    case 'RW': return { pac: 1.2, sho: 1.0, pas: 1.0, dri: 1.2, def: 0.6, phy: 0.8 };
    default:   return { pac: 1.0, sho: 1.0, pas: 1.0, dri: 1.0, def: 1.0, phy: 1.0 };
  }
}
function shapeByArchetype(stats, cap, position, alpha = 0.25) {
  const CAP = Math.max(BASE, Math.min(99, Number(cap) || 60));
  const keys = ['pac','sho','pas','dri','def','phy'];
  const sumStats = keys.reduce((s,k)=>s+Number(stats[k]||BASE),0);
  const above = Math.max(0, sumStats - keys.length * BASE);
  const w = archetypeWeights(position);
  const sumW = keys.reduce((s,k)=>s + (w[k]||1), 0) || 1;
  const target = {};
  for (const k of keys) { const share = (w[k] || 1) / sumW; target[k] = BASE + above * share; }
  const out = {};
  for (const k of keys) {
    const v = Number(stats[k] || BASE);
    const t = target[k];
    const blended = (1 - alpha) * v + alpha * t;
    out[k] = Math.max(BASE, Math.min(CAP, Math.round(blended)));
  }
  return out;
}

/* derive from workouts */
function deriveFromWorkouts(w = {}, capOverride) {
  const sessions = Number(w.sessions || 0);
  const minutes  = Number(w.total_minutes || 0);
  const touches  = Number(w.total_touches || 0);
  const xp       = Number(w.xp_awarded || 0);
  const CAP  = Math.max(BASE, Math.min(99, Number(capOverride) || 60));
  const N = { sessions: 300, minutes: 1200, touches: 20000, xp: 8000 };
  const k = 1.05, gamma = 1.5;
  const sat = (u) => {
    const p = 1 - Math.exp(-k * Math.max(0, u));
    const g = Math.pow(p, gamma);
    const v = BASE + (CAP - BASE) * g;
    return Math.max(BASE, Math.min(CAP, Math.round(v)));
  };
  const ns = sessions / N.sessions;
  const nm = minutes  / N.minutes;
  const nt = touches  / N.touches;
  const nx = xp       / N.xp;
  const pac = sat(0.55*nt + 0.35*nm + 0.10*ns);
  const sho = sat(0.50*nx + 0.30*nm + 0.20*ns);
  const pas = sat(0.80*nm + 0.20*nt);
  const dri = sat(0.75*nt + 0.25*nm);
  const def = sat(0.60*nm + 0.25*ns + 0.15*nt);
  const phy = sat(0.70*nm + 0.25*ns + 0.05*nt);
  const stats = { pac, sho, pas, dri, def, phy };
  const overall = clamp((pac + sho + pas + dri + def + phy) / 6, BASE, CAP);
  return { stats, overall };
}

/* small animated number for OVR */
function AnimatedNumber({ value, duration = 700, className = '' }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round((Number(value) || 0) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <tspan className={className}>{display}</tspan>;
}

/* rarity -> default theme name */
function themeFromRarity(r) {
  const x = String(r || '').toLowerCase();
  if (x === 'legendary') return 'galaxy';
  if (x === 'epic') return 'emerald';
  if (x === 'rare') return 'toty';
  return 'midnight';
}

/* ============ component ============ */
export default function PlayerCardTile({
  mode = 'auto',
  persist = 'none',              // 'none' | 'button' | 'auto'
  width = 252,
  title = 'PLAYER CARD',         // set '' to hide
  theme,                         // override name if provided
  design,                        // <-- NEW: full badge design object (palette/pattern/panel/etc)
  // props-mode fallbacks:
  userName = 'Player',
  avatarUrl = '/characters/striker_base.png',
  rarity = 'common',
  overall = 60,
  position = 'ST',
  stats = { pac: BASE, sho: BASE, pas: BASE, dri: BASE, def: BASE, phy: BASE },
  level = 1,
  playerStatus = 'Beginner',
  debug = false,
}) {
  const [autoLoading, setAutoLoading] = useState(mode === 'auto');
  const [autoData, setAutoData] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [uid, setUid] = useState(null);
  const [usingDerived, setUsingDerived] = useState(false);
  const baseStatsRef = useRef(null);
  const savedOnceRef = useRef(false);

  /* ============ load player (auto) ============ */
  useEffect(() => {
    if (mode !== 'auto') return;
    let alive = true;
    (async () => {
      try {
        setAutoLoading(true);
        const { data: userData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        const userId = userData?.user?.id;
        setUid(userId || null);
        if (!userId) { setAutoData(null); return; }

        const [{ data: p }, { data: w }] = await Promise.all([
          supabase.from('players')
            .select('id,name,avatar_url,points,player_status,equipped_items,auth_id')
            .eq('auth_id', userId)
            .maybeSingle(),
          supabase.from('workout_player_stats')
            .select('sessions,total_minutes,total_touches,xp_awarded,last_completed_at')
            .eq('player_auth_id', userId)
            .maybeSingle(),
        ]);

        setPlayerId(p?.id || null);

        const cap = tierCapFor(p?.player_status);
        const decayF = inactivityFactorStats(w?.last_completed_at);
        const eq = parseJSON(p?.equipped_items);
        const card = eq?.card || {};
        const rawStats = (card?.stats && typeof card.stats === 'object') ? card.stats : card;
        const pos = (card?.position || 'ST').toUpperCase();

        const avatar =
          toPublicUrlMaybe(card?.avatarUrl) ||
          toPublicUrlMaybe(p?.avatar_url) ||
          '/characters/striker_base.png';

        const points = toNumber(p?.points, 0);
        const lvl = Math.max(1, Math.floor(points / 100) + 1);

        let finalStats, finalOverall, derivedUsed = false;

        if (rawStats && Object.keys(rawStats).length > 0) {
          const c = (v) => clampToTier(v, cap);
          const clamped = {
            pac: c(rawStats.pac), sho: c(rawStats.sho), pas: c(rawStats.pas),
            dri: c(rawStats.dri), def: c(rawStats.def), phy: c(rawStats.phy),
          };
          const decayed   = applyDecayToStats(clamped, cap, decayF);
          const balanced  = rebalanceTowardAverage(decayed, cap, p?.player_status);
          const shaped    = shapeByArchetype(balanced, cap, pos, 0.25);
          finalStats      = diversify(shaped, cap, userId);
          finalOverall    = clamp(
            (finalStats.pac + finalStats.sho + finalStats.pas + finalStats.dri + finalStats.def + finalStats.phy) / 6,
            BASE, cap
          );
          baseStatsRef.current = null;
        } else {
          const derived   = w ? deriveFromWorkouts(w, cap) : null;
          const baseStats = derived?.stats || { pac:BASE, sho:BASE, pas:BASE, dri:BASE, def:BASE, phy:BASE };
          baseStatsRef.current = baseStats;
          const decayed   = applyDecayToStats(baseStats, cap, decayF);
          const balanced  = rebalanceTowardAverage(decayed, cap, p?.player_status);
          const shaped    = shapeByArchetype(balanced, cap, pos, 0.25);
          finalStats      = diversify(shaped, cap, userId);
          finalOverall    = derived?.overall ?? clamp(
            (finalStats.pac + finalStats.sho + finalStats.pas + finalStats.dri + finalStats.def + finalStats.phy) / 6,
            BASE, cap
          );
          derivedUsed = !!derived;
        }

        const payload = {
          userName: card?.name || p?.name || 'Player',
          avatarUrl: avatar,
          rarity:   card?.rarity || 'common',
          position: pos,
          playerStatus: p?.player_status || 'Beginner',
          level: lvl,
          stats: finalStats,
          overall: finalOverall,
        };

        if (!alive) return;
        setAutoData(payload);
        setUsingDerived(derivedUsed);
      } catch (e) {
        console.warn('[PlayerCardTile] auto load error:', e?.message || e);
        if (alive) { setAutoData(null); setUsingDerived(false); baseStatsRef.current = null; }
      } finally {
        if (alive) setAutoLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [mode]);

  /* persist once if requested */
  const canPersist = mode === 'auto' && usingDerived && playerId;
  const saveDerived = async () => {
    if (!canPersist) return;
    try {
      const { data: p } = await supabase
        .from('players')
        .select('name,avatar_url,equipped_items,player_status')
        .eq('id', playerId)
        .maybeSingle();

      const cap = tierCapFor(p?.player_status);
      const eq = parseJSON(p?.equipped_items);

      const base = baseStatsRef.current || { pac:BASE, sho:BASE, pas:BASE, dri:BASE, def:BASE, phy:BASE };
      const c = (v) => clampToTier(v, cap);
      const toPersist = { pac:c(base.pac), sho:c(base.sho), pas:c(base.pas), dri:c(base.dri), def:c(base.def), phy:c(base.phy) };
      const overallPersist = clamp((toPersist.pac + toPersist.sho + toPersist.pas + toPersist.dri + toPersist.def + toPersist.phy) / 6, BASE, cap);

      const next = {
        ...eq,
        equipped_card_id: eq.equipped_card_id || 'computed',
        card: {
          ...(eq.card || {}),
          name: autoData?.userName || p?.name || 'Player',
          rarity: eq.card?.rarity || 'common',
          position: autoData?.position || 'ST',
          overall: overallPersist,
          stats: toPersist,
          avatarUrl: autoData?.avatarUrl || p?.avatar_url || '/characters/striker_base.png',
        },
      };

      await supabase.from('players').update({ equipped_items: next }).eq('id', playerId);
      baseStatsRef.current = null;
    } catch (e) {
      console.warn('[PlayerCardTile] persist error:', e?.message || e);
    }
  };
  useEffect(() => {
    if (persist !== 'auto' || !canPersist || savedOnceRef.current) return;
    savedOnceRef.current = true;
    saveDerived();
  }, [persist, canPersist]);

  /* resolved display */
  const resolved = useMemo(() => {
    if (mode !== 'auto') return { userName, avatarUrl, rarity, overall, position, level, playerStatus, stats };
    if (autoLoading) {
      return {
        userName: 'Player',
        avatarUrl: '/characters/striker_base.png',
        rarity: 'common',
        overall: 60, position: 'ST', level: 1, playerStatus: 'Beginner',
        stats: { pac: BASE, sho: BASE, pas: BASE, dri: BASE, def: BASE, phy: BASE },
      };
    }
    return autoData || {
      userName: 'Player',
      avatarUrl: '/characters/striker_base.png',
      rarity: 'common',
      overall: 60, position: 'ST', level: 1, playerStatus: 'Beginner',
      stats: { pac: BASE, sho: BASE, pas: BASE, dri: BASE, def: BASE, phy: BASE },
    };
  }, [mode, autoLoading, autoData, userName, avatarUrl, rarity, overall, position, level, playerStatus, stats]);

  /* ====== FIFA crest render (design-aware) ====== */
  const W = 300, H = 460;
  const height = Math.round(width * (H / 300));

  const THEMES = {
    toty:     { rimHi:'#FFD27A', rimLo:'#A67711', plateHi:'#142457', plateLo:'#0B1434', band:'#0E1A44', accent:'#4ba0ff' },
    midnight: { rimHi:'#D7D7D7', rimLo:'#6B7280', plateHi:'#111315', plateLo:'#0a0b0c', band:'#15181b', accent:'#9ca3af' },
    galaxy:   { rimHi:'#E1C1FF', rimLo:'#7C3AED', plateHi:'#2b1644', plateLo:'#120a22', band:'#3a1b5a', accent:'#c084fc' },
    neon:     { rimHi:'#9BFFE5', rimLo:'#12B8A9', plateHi:'#0b2a2f', plateLo:'#071c21', band:'#0f3a41', accent:'#59ffe7' },
    emerald:  { rimHi:'#A9F1C0', rimLo:'#0E9F6E', plateHi:'#0f2a1e', plateLo:'#0a1f18', band:'#123427', accent:'#34d399' },
    sunset:   { rimHi:'#FFD0B9', rimLo:'#FB7185', plateHi:'#3c0f1e', plateLo:'#230914', band:'#4b1324', accent:'#fb7185' },
  };

  // Palette resolved from design.palette or theme/rarity
  const themeName = theme || (design && design.theme) || themeFromRarity(resolved.rarity);
  const basePalette = THEMES[themeName] || THEMES.toty;
  const C = {
    rimHi:   design?.palette?.rimHi   || basePalette.rimHi,
    rimLo:   design?.palette?.rimLo   || basePalette.rimLo,
    plateHi: design?.palette?.plateHi || basePalette.plateHi,
    plateLo: design?.palette?.plateLo || basePalette.plateLo,
    band:    design?.palette?.band    || basePalette.band,
    accent:  design?.palette?.accent  || basePalette.accent,
  };

  // Pattern settings
  const patType = design?.pattern?.type || 'stripe'; // 'stripe' | 'dots' | 'none'
  const patOpacity = Number(design?.pattern?.opacity ?? 0.14);
  const patRotate = Number(design?.pattern?.rotation ?? -18);

  // Panel overrides
  const panelWidthPct = Number(design?.panel?.widthPct ?? 0.88); // 0.80..0.92
  const panelHeightPx = Number(design?.panel?.height ?? 122);
  const panelLift = Number(design?.panel?.lift ?? 12);

  const crestOuter = `
    M24 78
    Q150 40 276 78
    L276 360
    Q276 386 258 398
    L172 422
    Q150 436 128 422
    L42 398
    Q24 386 24 360
    Z`;
  const crestInner = `
    M28 82
    Q150 44 272 82
    L272 358
    Q272 380 257 390
    L170 414
    Q150 426 130 414
    L43 390
    Q28 380 28 358
    Z`;

  const inner = { left: 28, right: 272, top: 82, bottom: 358 };
  const inset = 10;
  const safe = { left: inner.left + inset, right: inner.right - inset, top: inner.top + inset, bottom: inner.bottom - inset };
  const safeW = safe.right - safe.left;
  const safeH = safe.bottom - safe.top;
  const cx = safe.left + safeW / 2;

  const OVR_SIZE = 54;
  const POS_SIZE = 16;
  const ovrY = safe.top + 26;
  const posY = ovrY + 26;

  const faceR  = Math.round(width * 0.152);
  const faceCY = posY + 64;

  const panelW = Math.round(safeW * panelWidthPct);
  const panelH = panelHeightPx;
  const panelX = Math.round(cx - panelW / 2);
  const minPanelY = faceCY + faceR + 18;
  const targetPanelY = safe.top + Math.floor(safeH * 0.58);
  const panelY = Math.max(minPanelY, Math.min(targetPanelY - panelLift, safe.bottom - panelH - 2));

  const padX = 22;
  const contentLeft = panelX + padX;
  const contentRight = panelX + panelW - padX;
  const mid = Math.round((contentLeft + contentRight) / 2);

  const nameY = panelY + 24;
  const subY  = panelY + 43;

  // generous spacing
  const statsTop = panelY + 60;
  const statsBottom = panelY + panelH - 18;
  const desiredGap = Number(design?.stats?.rowGap ?? 28);
  const topOffset  = 10;
  const avail = statsBottom - (statsTop + topOffset);
  const gap = Math.min(desiredGap, Math.floor(avail / 2));
  const y1 = statsTop + topOffset;
  const y2 = y1 + gap;
  const y3 = y2 + gap;

  const colPad = 16;
  const xLeft  = contentLeft;
  const xRight = mid + colPad;
  const numGap = 30;

  const titleText = design?.title ?? title;
  const showAccent = design?.accentDot !== false;
  const showGrain = design?.grain !== false; // default on

  return (
    <div className="relative mx-auto select-none" style={{ width, height, background: 'transparent', filter: 'drop-shadow(0 16px 28px rgba(0,0,0,.38))' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor={C.rimHi} />
            <stop offset="55%"  stopColor={C.rimLo} />
            <stop offset="100%" stopColor={C.rimHi} />
          </linearGradient>
          <linearGradient id="plate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={C.plateHi} />
            <stop offset="100%" stopColor={C.plateLo} />
          </linearGradient>

          {/* pattern: stripe or dots */}
          <pattern id="stripe" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform={`rotate(${patRotate})`}>
            <rect x="0" y="0" width="14" height="14" fill="rgba(255,255,255,0)" />
            <rect x="0" y="0" width="7"  height="14" fill="rgba(255,255,255,0.05)" />
          </pattern>
          <pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="rgba(255,255,255,0.06)" />
          </pattern>

          <filter id="grain" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="table" tableValues="0 0.02" /></feComponentTransfer>
          </filter>

          <clipPath id="clipCrest"><path d={crestInner} /></clipPath>
          <clipPath id="clipAvatar"><circle cx={cx} cy={faceCY} r={faceR} /></clipPath>
        </defs>

        {/* optional title */}
        {titleText ? (
          <text x={150} y={30} textAnchor="middle" fontSize="18" fontWeight="900" letterSpacing="2" fill="#ffffff">{titleText}</text>
        ) : null}

        {/* crest base */}
        <path d={crestOuter} fill="url(#rim)" />
        <path d={crestInner} fill="url(#plate)" />
        <path d={crestInner} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1.2" />

        {/* pattern layer */}
        {patType !== 'none' && (
          <path d={crestInner} fill={patType === 'dots' ? 'url(#dots)' : 'url(#stripe)'} opacity={patOpacity} />
        )}

        {/* subtle grain */}
        {showGrain && <path d={crestInner} fill="#000" opacity=".16" filter="url(#grain)" />}

        <circle cx="150" cy="64" r="7" fill={C.plateLo} stroke={C.rimLo} strokeWidth="3" />

        <g clipPath="url(#clipCrest)">
          {/* OVR + POS */}
          <text x={cx} y={ovrY} textAnchor="middle" fontSize={OVR_SIZE} fontWeight="900" fill="#ffffff">
            <AnimatedNumber value={Number(resolved.overall) || 0} />
          </text>
          <text x={cx} y={posY} textAnchor="middle" fontSize={POS_SIZE} fontWeight="900" fill="rgba(255,255,255,.9)" letterSpacing="2">
            {String(resolved.position || 'ST')}
          </text>
          {showAccent && <circle cx={safe.right - 8} cy={safe.top + 10} r="5" fill={C.accent} opacity=".9" />}

          {/* avatar */}
          <g>
            <circle cx={cx} cy={faceCY} r={faceR + 12} fill="url(#rim)" />
            <circle cx={cx} cy={faceCY} r={faceR + 4}  fill="rgba(255,255,255,.22)" />
            <circle cx={cx} cy={faceCY} r={faceR + 2}  fill="#000" />
            <image
              href={encodeURI(toPublicUrlMaybe(resolved.avatarUrl) || '/characters/striker_base.png')}
              x={cx - faceR} y={faceCY - faceR} width={faceR * 2} height={faceR * 2}
              preserveAspectRatio="xMidYMid slice" clipPath="url(#clipAvatar)"
            />
          </g>

          {/* custom stickers (optional) */}
          {Array.isArray(design?.stickers) && design.stickers.map((s, i) => (
            <text key={i} x={Number(s.x) || cx} y={Number(s.y) || (safe.top + 20)}
              fontSize={Number(s.size) || 18} textAnchor="middle"
              opacity={Number(s.opacity ?? 1)} transform={`rotate(${Number(s.rot||0)} ${Number(s.x)||cx} ${Number(s.y)||safe.top+20})`}>
              {String(s.emoji || '★')}
            </text>
          ))}

          {/* bottom stats panel */}
          <g>
            <rect x={panelX} y={panelY} rx="12" ry="12" width={panelW} height={panelH}
                  fill={C.band} stroke={C.rimLo} strokeWidth="2" opacity=".96" />
            <rect x={panelX} y={panelY} rx="12" ry="12" width={panelW} height={panelH}
                  fill="black" opacity=".18" filter="url(#grain)" />

            <text x={cx} y={nameY} textAnchor="middle" fontSize="19" fontWeight="900" fill="#ffffff">
              {resolved.userName}
            </text>
            <text x={cx} y={subY} textAnchor="middle" fontSize="13" fontWeight="700" fill="rgba(255,255,255,.85)">
              Lvl {Number(resolved.level) || 1} • {resolved.rarity}
            </text>

            <line x1={mid} y1={y1 - 8} x2={mid} y2={y3 + 8} stroke="rgba(255,255,255,.28)" strokeWidth="1.5" />

            {/* left column */}
            <StatRow x={xLeft}  y={y1} value={resolved.stats.pac} label="PAC" gap={numGap} />
            <StatRow x={xLeft}  y={y2} value={resolved.stats.sho} label="SHO" gap={numGap} />
            <StatRow x={xLeft}  y={y3} value={resolved.stats.pas} label="PAS" gap={numGap} />
            {/* right column */}
            <StatRow x={xRight} y={y1} value={resolved.stats.dri} label="DRI" gap={numGap} />
            <StatRow x={xRight} y={y2} value={resolved.stats.def} label="DEF" gap={numGap} />
            <StatRow x={xRight} y={y3} value={resolved.stats.phy} label="PHY" gap={numGap} />
          </g>
        </g>
      </svg>

      {persist === 'button' && usingDerived && (
        <button onClick={saveDerived}
          className="absolute -bottom-3 right-0 translate-y-full rounded-md bg-amber-400 px-3 py-1 text-black text-xs font-bold shadow">
          Save Card
        </button>
      )}

      {debug && (
        <div className="absolute left-0 right-0 -bottom-8 text-[11px] text-white/80">
          uid: {uid} • usingDerived: {String(usingDerived)} • playerId: {playerId}
        </div>
      )}
    </div>
  );
}

/* start-aligned stat row */
function StatRow({ x, y, value, label, gap = 30 }) {
  const v = clamp(Number(value) || 0, 0, 99);
  const val = String(v).padStart(2, '0');
  return (
    <>
      <text x={x} y={y} textAnchor="start" fontSize="18" fontWeight="900" fill="#ffffff">{val}</text>
      <text x={x + gap} y={y} textAnchor="start" fontSize="14" fontWeight="800" fill="rgba(255,255,255,.9)">{label}</text>
    </>
  );
}
