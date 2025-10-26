'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { sessionData } from '../../../lib/sessionData';
import BallTouchTrackerFinal from '../../../components/BallTouchTrackerFinal';
import SessionCompleteModal from 'app/skill-session/SessionCompleteModal';

/* ---------- helpers for daily fallback ---------- */
const LONDON_TZ = 'Europe/London';
const todayYMD = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: LONDON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickK(arr, k, rng) {
  const pool = [...arr];
  const out = [];
  while (k-- > 0 && pool.length) {
    const i = Math.floor(rng() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/* ---------- rarity bonus ---------- */
const RARITY_BONUS = { legendary: 10, epic: 6, rare: 3, common: 0 };

/* ---------- XP weights & bounds ---------- */
const XP_WEIGHTS = { perSecond: 0.2, perRep: 5, perTouch: 1 };
const XP_MIN = 10;
const XP_MAX = 1000;

/* ---------- XR helpers ---------- */
function toNumber(v) {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return NaN;
}
function pickFinite(...vals) {
  for (const v of vals) {
    const n = toNumber(v);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}
function deepFindNumber(obj, keys, depth = 0) {
  if (!obj || depth > 6) return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const v = deepFindNumber(item, keys, depth + 1);
      if (v != null) return v;
    }
    return null;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const key = String(k).toLowerCase();
      if (keys.has(key)) {
        const n = toNumber(v);
        if (Number.isFinite(n)) return n;
      }
      if (v && typeof v === 'object') {
        const inner = deepFindNumber(v, keys, depth + 1);
        if (inner != null) return inner;
      }
    }
  }
  return null;
}
const XR_KEYS = new Set(['xr_awarded', 'xr']);

/* =================================================================== */

export default function DailyPlayerPage() {
  const params = useSearchParams();

  /* ---------- player ---------- */
  const [player, setPlayer] = useState(null);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('auth_id', user.id)
        .single();
      setPlayer(data || null);
    })();
  }, []);

  /* ---------- equipped card ---------- */
  const [equipped, setEquipped] = useState(null);
  useEffect(() => {
    (async () => {
      if (!player?.id) { setEquipped(null); return; }
      const { data } = await supabase
        .from('user_cards')
        .select('id, is_equipped, cards:card_id(name, rarity, image_url)')
        .eq('player_id', player.id)
        .eq('is_equipped', true)
        .maybeSingle();
      setEquipped(data || null);
    })();
  }, [player?.id]);
  useEffect(() => {
    const onUpdate = () => {
      if (!player?.id) return;
      supabase
        .from('user_cards')
        .select('id, is_equipped, cards:card_id(name, rarity, image_url)')
        .eq('player_id', player.id)
        .eq('is_equipped', true)
        .maybeSingle()
        .then(({ data }) => setEquipped(data || null));
    };
    window.addEventListener('cards:updated', onUpdate);
    return () => window.removeEventListener('cards:updated', onUpdate);
  }, [player?.id]);

  /* ---------- pick sessions ---------- */
  const initialKeys = useMemo(
    () => [params.get('sessionA'), params.get('sessionB')].filter(Boolean),
    [params]
  );
  const [sessionKeys, setSessionKeys] = useState(initialKeys);
  useEffect(() => {
    if (sessionKeys.length || !player) return;
    const pts = Number(player?.points) || 0;
    const unlocked = Object.entries(sessionData)
      .filter(([_, s]) => pts >= (Number(s.unlockXP) || 0))
      .map(([id]) => id);
    const pool = unlocked.length ? unlocked : Object.keys(sessionData);
    const seed = `${player.auth_id || player.id || 'anon'}|${todayYMD()}`;
    const rng = mulberry32(hashStr(seed));
    const picks = pickK(pool, Math.min(2, pool.length), rng);
    setSessionKeys(picks.length ? picks : [Object.keys(sessionData)[0]]);
  }, [player, sessionKeys.length]);

  /* ---------- constants for each drill ---------- */
  const reps = 5;
  const workTime = 30;
  const restTime = 15;

  /* ---------- drill state ---------- */
  const [currentIndex, setCurrentIndex] = useState(0);
  const s = sessionData[sessionKeys[currentIndex]] || null;

  const [prepCountdown, setPrepCountdown] = useState(0);
  const prevPrepRef = useRef(0);
  const [repCountdown, setRepCountdown] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [currentRep, setCurrentRep] = useState(0);
  const [afterPrep, setAfterPrep] = useState(false);

  /* ---------- audio ---------- */
  const [volume, setVolume] = useState(0.18);
  const audioCtxRef = useRef(null);
  const ensureAudio = async () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtxRef.current) audioCtxRef.current = new AC();
    if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
    return audioCtxRef.current;
  };
  const playPattern = async (steps, gap = 0.08) => {
    const ctx = await ensureAudio();
    if (!ctx) return;
    let t = ctx.currentTime;
    for (const s of steps) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = s.type || 'sine';
      osc.frequency.setValueAtTime(s.f, t);
      gain.gain.setValueAtTime(volume, t);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + s.d);
      t += s.d + gap;
    }
  };
  const vibrate = (pattern) => { try { navigator.vibrate && navigator.vibrate(pattern); } catch {} };
  const beepCountdownTick = () => { playPattern([{ f: 820, d: 0.12 }]); vibrate([45]); };
  const beepCountdownGo   = () => { playPattern([{ f: 1000, d: 0.16 }, { f: 1200, d: 0.22 }], 0.04); vibrate([60, 40, 100]); };
  const beepRest          = () => { if (restTime > 0) { playPattern([{ f: 500, d: 0.14 }, { f: 380, d: 0.16 }], 0.08); vibrate([35, 45, 35]); } };
  const beepWorkStart     = () => { playPattern([{ f: 700, d: 0.12 }, { f: 900, d: 0.16 }], 0.06); vibrate([60]); };
  const beepComplete      = () => { playPattern([{ f: 600, d: 0.12 }, { f: 900, d: 0.12 }, { f: 1200, d: 0.22 }], 0.08); vibrate([80, 40, 120]); };

  /* ---------- touches ---------- */
  const [totalTouches, setTotalTouches] = useState(0);
  const lastRawCountRef = useRef(0);
  const prevFrame = useRef(0);

  /* ---------- timers ---------- */
  const timerRef = useRef(null);
  const savedRef = useRef(false);

  /* ---------- working seconds ---------- */
  const [workSecondsDrill, setWorkSecondsDrill] = useState(0);
  const [workSecondsTotal, setWorkSecondsTotal] = useState(0);

  /* ---------- video control ---------- */
  const videoRef = useRef(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const play = async () => { try { await v.play(); } catch {} };
    play();
  }, [s?.id]);

  /* ---------- countdown beeps ---------- */
  useEffect(() => {
    const prev = prevPrepRef.current;
    if (prepCountdown > 0 && prepCountdown !== prev) {
      beepCountdownTick();
      prevPrepRef.current = prepCountdown;
    }
    if (prev === 1 && prepCountdown === 0) beepCountdownGo();
  }, [prepCountdown]);

  /* ---------- prep countdown ---------- */
  useEffect(() => {
    if (prepCountdown > 0) {
      timerRef.current = setTimeout(() => setPrepCountdown((c) => c - 1), 1000);
    } else if (prepCountdown === 0 && afterPrep && !isRunning) {
      setAfterPrep(false);
      startDrill();
    }
    return () => clearTimeout(timerRef.current);
  }, [prepCountdown, afterPrep, isRunning]);

  /* ---------- rep/rest countdown ---------- */
  useEffect(() => {
    if (!isRunning || isPaused || repCountdown <= 0) return;
    timerRef.current = setTimeout(() => {
      setRepCountdown((t) => t - 1);
      if (!isResting) {
        setWorkSecondsDrill((s) => s + 1);
        setWorkSecondsTotal((s) => s + 1);
      }
    }, 1000);
    return () => clearTimeout(timerRef.current);
  }, [repCountdown, isRunning, isPaused, isResting]);

  /* ---------- phase beeps ---------- */
  const prevPhaseRef = useRef('idle');
  const phaseName = prepCountdown > 0 ? 'countdown'
                  : !isRunning ? 'idle'
                  : isPaused ? 'paused'
                  : isResting ? 'rest'
                  : 'work';
  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev !== phaseName) {
      if (phaseName === 'rest') beepRest();
      if (phaseName === 'work' && (prev === 'rest' || prev === 'countdown')) beepWorkStart();
      prevPhaseRef.current = phaseName;
    }
  }, [phaseName]);

  /* ---------- segment transitions ---------- */
  useEffect(() => {
    if (repCountdown !== 0 || !isRunning || isPaused) return;
    if (isResting) {
      setIsResting(false);
      setCurrentRep((r) => r + 1);
      setRepCountdown(workTime);
    } else {
      if (currentRep < reps) {
        setIsResting(true);
        setRepCountdown(restTime);
      } else {
        finishDrill();
      }
    }
  }, [repCountdown, isRunning, isPaused, isResting, currentRep]);

  /* ---------- controls ---------- */
  const handleStart = async () => {
    if (!equipped) {
      alert("Equip a card in the Lobby (Collectables) before starting today's challenge.");
    }
    await ensureAudio();
    setAfterPrep(true);
    setPrepCountdown(3);
  };

  const startDrill = () => {
    setIsRunning(true);
    setIsPaused(false);
    setIsResting(false);
    setCurrentRep(1);
    setRepCountdown(workTime);

    prevFrame.current = lastRawCountRef.current;
    setWorkSecondsDrill(0);
    try {
      const v = videoRef.current;
      if (v) {
        v.currentTime = 0;
        const p = v.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch {}
  };

  const resetDrillState = () => {
    setCurrentRep(0);
    setRepCountdown(0);
    setPrepCountdown(0);
    setAfterPrep(false);
    setIsPaused(false);
    setIsResting(false);
  };

  /* ---------- touch counting only while active ---------- */
  const isActiveNow = (running, paused, resting) => running && !paused && !resting;
  const onTouchChange = (cnt) => {
    lastRawCountRef.current = cnt;
    const active = isActiveNow(isRunning, isPaused, isResting);
    if (!active) { prevFrame.current = cnt; return; }
    const diff = cnt - prevFrame.current;
    if (diff > 0) {
      setTotalTouches((t) => t + diff);
      prevFrame.current = cnt;
    }
  };
  useEffect(() => {
    const id = setInterval(() => {
      const active = isActiveNow(isRunning, isPaused, isResting);
      if (!active) return;
      const cnt = lastRawCountRef.current;
      const diff = cnt - prevFrame.current;
      if (diff > 0) {
        setTotalTouches((t) => t + diff);
        prevFrame.current = cnt;
      }
    }, 80);
    return () => clearInterval(id);
  }, [isRunning, isPaused, isResting]);
  useEffect(() => {
    if (!isActiveNow(isRunning, isPaused, isResting)) {
      prevFrame.current = lastRawCountRef.current;
    }
  }, [isPaused, isResting, isRunning]);

  /* ---------- stop modal ---------- */
  const [stopModalOpen, setStopModalOpen] = useState(false);
  const onStopClick = () => {
    if (phaseName === 'work' || phaseName === 'rest' || phaseName === 'countdown') setStopModalOpen(true);
  };
  const resumeFromStop = () => setStopModalOpen(false);
  const endWithoutSaving = () => {
    setStopModalOpen(false);
    clearTimeout(timerRef.current);
    setIsRunning(false);
    resetDrillState();
    try { videoRef.current?.pause(); } catch {}
  };
  const savePartialAndEnd = async () => {
    setStopModalOpen(false);

    const drillsCompleted = currentIndex;
    const repsCompletedBefore = drillsCompleted * reps;
    const repsCompletedInCurrent = isResting ? currentRep : Math.max(0, currentRep - 1);
    const repsCompleted = repsCompletedBefore + repsCompletedInCurrent;

    const workingSeconds = workSecondsTotal;
    const touchesNow = totalTouches;

    const stats = {
      reps: Math.max(0, repsCompleted),
      touches: touchesNow,
      workSeconds: Math.max(0, workingSeconds),
      restSeconds: 0,
      totalSeconds: Math.max(0, workingSeconds),
    };

    clearTimeout(timerRef.current);
    setIsRunning(false);
    try { videoRef.current?.pause(); } catch {}
    await saveDailyAndShowModal(stats, true);
  };

  /* ---------- completion modal ---------- */
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionXP, setSessionXP] = useState(0);
  const [coachSummary, setCoachSummary] = useState('');
  const [callingModel, setCallingModel] = useState(false);
  const [completedStats, setCompletedStats] = useState(null);

  function localSummary({ reps, workSeconds, restSeconds, touches }) {
    const avg = reps ? Math.round(touches / reps) : 0;
    const w = reps ? Math.round(workSeconds / reps) : 0;
    const r = reps > 1 ? Math.round(restSeconds / (reps - 1)) : 0;
    if (!touches) return `Completed ${reps} reps @ ~${w}s work / ${r || 0}s rest — no touches detected.`;
    return `Completed ${reps} reps @ ~${w}s work / ${r || 0}s rest — ${touches} touches (~${avg}/rep). Nice work!`;
  }

  const finishDrill = async () => {
    setIsRunning(false);
    setIsPaused(false);
    setIsResting(false);
    try { videoRef.current?.pause(); } catch {}
    prevFrame.current = lastRawCountRef.current;

    if (currentIndex < sessionKeys.length - 1) {
      setCurrentIndex((i) => i + 1);
      resetDrillState();
      return;
    }

    const drills = Math.max(1, sessionKeys.length);
    const repsCompleted = reps * drills;
    const workingSeconds = workSecondsTotal;
    const touchesNow = totalTouches;

    const stats = {
      reps: repsCompleted,
      touches: touchesNow,
      workSeconds: workingSeconds,
      restSeconds: 0,
      totalSeconds: workingSeconds,
    };
    await saveDailyAndShowModal(stats, false);
  };

  const saveDailyAndShowModal = async (stats, isPartial) => {
    if (savedRef.current) return;
    savedRef.current = true;
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error('You must be logged in to save your workout.');
      if (!player?.id) throw new Error('Player profile not loaded yet.');

      let computedXP =
        stats.workSeconds * XP_WEIGHTS.perSecond +
        stats.reps * XP_WEIGHTS.perRep +
        stats.touches * XP_WEIGHTS.perTouch;
      computedXP = Math.round(Math.min(XP_MAX, Math.max(XP_MIN, computedXP)));
      const rarity = equipped?.cards?.rarity || 'common';
      const bonusXP = RARITY_BONUS[rarity] ?? 0;
      const totalXP = computedXP + bonusXP;

      const insertPayload = {
        player_id: player.id,
        completed_at: new Date().toISOString(),
        skill_name: isPartial ? 'Daily Combo (Partial)' : 'Daily Combo',
        reps: stats.reps,
        work_time: stats.workSeconds,
        rest_time: stats.restSeconds,
        touches: stats.touches,
        xr_awarded: totalXP,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('workout_sessions')
        .insert([insertPayload])
        .select('id, xr_awarded')
        .single();
      if (insertErr) throw insertErr;
      if (!inserted?.id) throw new Error('Session saved but id was not returned');

      const { data: row, error: selErr } = await supabase
        .from('workout_sessions')
        .select('id, xr_awarded')
        .eq('id', inserted.id)
        .single();
      if (selErr) throw selErr;

      const xr = pickFinite(deepFindNumber(row, XR_KEYS), row?.xr_awarded, totalXP);
      const xrInt = Math.max(0, Math.floor(xr || 0));
      setSessionXP(xrInt);

      const { error: updErr } = await supabase
        .from('players')
        .update({
          points: (player.points || 0) + xrInt,
          streak: (player.streak || 0) + 1,
          workouts_completed: (player.workouts_completed || 0) + 1,
          last_completed: new Date().toISOString(),
        })
        .eq('id', player.id);
      if (updErr) console.error('Update players failed:', updErr);

      setCompletedStats(stats);
      setCoachSummary(localSummary(stats));
      setCallingModel(false);
      setSessionComplete(true);
    } catch (e) {
      console.error('Save error:', e);
      alert(e?.message || 'Could not save workout.');
      savedRef.current = false;
    }
  };

  /* ---------- labels ---------- */
  const stadiumName = s?.stadium || 'Stadium';
  const venueLocation = s?.location || '';
  const heroImg = s?.img || '/stadiums/wembley.png';

  /* ---------- derived UI strings ---------- */
  const dailyTitles = sessionKeys
    .map((key, i) => sessionData[key]?.title || `Skill ${i + 1}`)
    .join(' • ');
  const equippedName = equipped?.cards?.name || 'Equipped';
  const equippedRarity = equipped?.cards?.rarity || 'common';
  const equippedBonus = RARITY_BONUS[equippedRarity] ?? 0;

  return (
    <main className="relative h-screen overflow-hidden text-white">
      {/* Background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: "url('/images/futuristic-stadium_4.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(.92) saturate(1.03)',
        }}
      />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(0,0,0,.16),rgba(0,0,0,.88))]" />

      {/* Layout: three rows (back + compact info + main) */}
      <div className="mx-auto max-w-[1400px] px-6 py-4 h-full grid grid-rows-[auto_auto_1fr] gap-3">
        {/* Back */}
        <div>
          <Link
            href="/lobby"
            className="inline-block rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15"
          >
            ← Back to Lobby
          </Link>
        </div>

        {/* Compact info bar (centered; equal-height chips) */}
        <div className="rounded-xl border border-white/12 bg-black/30 px-3 py-2 backdrop-blur-sm">
          <div className="flex flex-wrap justify-center items-stretch gap-2 text-[11px]">
            {/* Stadium chip */}
            <div className="h-10 flex items-center gap-2 rounded-md border border-white/12 bg-white/5 px-3">
              <span className="uppercase tracking-[0.18em] text-cyan-300/80">Stadium</span>
              <span className="font-semibold">{stadiumName}</span>
              {venueLocation && <span className="text-white/70">• {venueLocation}</span>}
            </div>

            {/* Daily chip */}
            {dailyTitles && (
              <div className="h-10 flex items-center gap-2 rounded-md border border-white/12 bg-white/5 px-3">
                <span className="rounded-sm bg-yellow-400/20 text-yellow-300 px-1.5 py-0.5 font-semibold">Daily</span>
                <span className="text-white/90 truncate max-w-[42ch] sm:max-w-[60ch] md:max-w-[80ch]">
                  {dailyTitles}
                </span>
              </div>
            )}

            {/* Equipped chip */}
            {equipped && (
              <div className="h-10 flex items-center gap-2 rounded-md border border-white/12 bg-white/5 px-3">
                {equipped?.cards?.image_url && (
                  <img
                    src={equipped.cards.image_url}
                    alt={equippedName}
                    className="h-6 w-4 object-contain rounded-sm"
                  />
                )}
                <span className="font-semibold truncate max-w-[18ch]">
                  {equippedName} <span className="text-white/70">({equippedRarity})</span>
                </span>
                <span className="text-emerald-300/90">• Bonus: +{equippedBonus} XP</span>
              </div>
            )}
          </div>
        </div>

        {/* MAIN */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 min-h-0">
          {/* LEFT: Video + controls */}
          <div className="flex flex-col min-h-0">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 flex-1 min-h-0">
              <div className="relative w-full h-full">
                {s ? (
                  <video
                    ref={videoRef}
                    key={s.id}
                    src={s.video}
                    poster={heroImg}
                    preload="metadata"
                    muted
                    playsInline
                    autoPlay
                    controls
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-white/70">Loading…</div>
                )}

                {/* Title moved to top-left so bottom controls remain clickable */}
                <div className="absolute top-2 left-2 z-10 pointer-events-none">
                  <div className="pointer-events-auto rounded-md border border-white/15 bg-black/50 backdrop-blur px-3 py-1.5">
                    <div className="text-[12px] font-semibold leading-none">
                      {s?.title || 'Daily Skill Session'}
                    </div>
                    <div className="mt-0.5 text-[10px] text-white/80">
                      {stadiumName}{venueLocation ? ` • ${venueLocation}` : ''}
                    </div>
                  </div>
                </div>

                {/* Countdown overlay */}
                {prepCountdown > 0 && (
                  <div className="absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-sm">
                    <div className="text-center">
                      <div className="text-7xl font-black tabular-nums">{prepCountdown || 'GO'}</div>
                      <div className="mt-2 text-xs uppercase tracking-widest text-white/70">Get ready…</div>
                    </div>
                  </div>
                )}

                {/* Stop confirm overlay */}
                {stopModalOpen && (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-xl border border-white/10 bg-neutral-900/95 p-4">
                      <div className="mb-3 text-sm">End session?</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button onClick={resumeFromStop} className="rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/20">Resume</button>
                        <button onClick={endWithoutSaving} className="rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/20">End without saving</button>
                        <button onClick={savePartialAndEnd} className="rounded-md bg-sky-500 px-3 py-2 text-sm font-semibold text-black hover:brightness-110">Save partial & end</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-4">
              {!equipped && (
                <div className="mb-3 rounded-md border border-yellow-300/30 bg-yellow-300/10 px-3 py-2 text-[12px]">
                  <span className="font-semibold text-yellow-300">Equip a card</span> in the Lobby → Collectables to start today’s challenge.
                </div>
              )}

              <p className="text-sm text-white/80 mb-3">
                Adjust your session and press <b>{currentIndex === 0 ? 'Start Training' : 'Start Next Drill'}</b>. Use <b>Stop</b> to save a partial anytime.
              </p>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <Field label="Reps" value={reps} />
                <Field label="Time/Rep (s)" value={workTime} />
                <Field label="Rest (s)" value={restTime} />
              </div>

              <div className="mb-3">
                <div className="mb-1 text-[10px] uppercase text-white/60">Volume</div>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-40"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                {!isRunning ? (
                  <button
                    onClick={handleStart}
                    disabled={!equipped}
                    className="rounded-lg bg-sky-500 px-5 py-3 font-semibold text-black hover:brightness-110 disabled:opacity-60"
                  >
                    {currentIndex === 0 ? 'Start Training' : 'Start Next Drill'}
                  </button>
                ) : !isPaused ? (
                  <button
                    onClick={() => setIsPaused(true)}
                    className="rounded-lg bg-yellow-500 px-5 py-3 font-semibold text-black hover:brightness-110"
                  >
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={() => setIsPaused(false)}
                    className="rounded-lg bg-blue-500 px-5 py-3 font-semibold text-black hover:brightness-110"
                  >
                    Resume
                  </button>
                )}

                {(phaseName === 'work' || phaseName === 'rest' || phaseName === 'countdown') && (
                  <button onClick={() => setStopModalOpen(true)} className="rounded-lg bg-white/10 px-5 py-3 text-sm hover:bg-white/20">Stop</button>
                )}

                <Link
                  href="/skill-session"
                  className="rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm hover:bg-white/10"
                >
                  Browse Skills
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT: Tracker — no overlay UI here */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 flex flex-col min-h-0">
            <div className="relative rounded-xl bg-black/80 overflow-hidden aspect-[4/3] w-full">
              <div className="tracker-stage absolute inset-0">
                {isRunning && !isPaused && !isResting && s ? (
                  <BallTouchTrackerFinal isActive onTouchChange={onTouchChange} />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-white/70 text-sm px-3">
                    {prepCountdown > 0 ? (
                      'Get ready…'
                    ) : isResting ? (
                      <div className="text-center">
                        <div className="text-[10px] uppercase tracking-widest text-cyan-300/80 mb-1">Rest</div>
                        <div className="text-5xl font-black tabular-nums">{repCountdown}</div>
                        <div className="mt-2 text-xs text-white/60">Camera paused • touches not counted</div>
                      </div>
                    ) : (
                      <>Camera starts when you press <b>{currentIndex === 0 ? 'Start Training' : 'Start Next Drill'}</b>.</>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-1 text-center text-[10px] text-white/70 leading-tight">
              <span className="font-semibold text-lime-300">DETECTION</span> • Camera pauses during rest; resumes on work.
            </div>

            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
              <Stat label="Phase">
                {prepCountdown > 0 ? `Starting in ${prepCountdown}` : !isRunning ? 'Idle' : isPaused ? 'Paused' : isResting ? 'Rest' : 'Working'}
              </Stat>
              <Stat label="Rep">{!isRunning ? `0/${reps}` : `${Math.max(1, currentRep)}/${reps}`}</Stat>
              <Stat label="Time Left">{(isRunning && !isPaused) ? repCountdown : '-'}</Stat>
              <div className="rounded-md border border-white/10 bg-white/5 p-2">
                <div className="text-[9px] uppercase text-white/60 leading-none">Touches</div>
                <div className="mt-1 text-2xl font-bold leading-none">{totalTouches}</div>
                <div className="mt-2 flex items-center gap-1">
                  <button onClick={() => setTotalTouches(0)} className="rounded bg-white/10 px-2 py-1 text-[10px] hover:bg-white/20">Reset</button>
                  <button onClick={() => setTotalTouches((t) => t + 1)} className="rounded bg-white/10 px-2 py-1 text-[10px] hover:bg-white/20">+1</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Session Complete Modal */}
        <SessionCompleteModal
          open={sessionComplete}
          onClose={() => {
            setSessionComplete(false);
            setCoachSummary('');
            setCallingModel(false);
            window.location.reload();
          }}
          xp={sessionXP}
          points={0}
          pointsLabel=""
          summary={coachSummary}
          loading={callingModel}
          stats={
            completedStats || {
              reps: reps * Math.max(1, sessionKeys.length),
              touches: totalTouches,
              workSeconds: workSecondsTotal,
              restSeconds: 0,
              totalSeconds: workSecondsTotal,
            }
          }
        />
      </div>

      <style jsx global>{`
        .tracker-stage { position: absolute; inset: 0; }
        .tracker-stage canvas,
        .tracker-stage video {
          width: 100% !important;
          height: 100% !important;
          display: block;
          object-fit: contain !important;
          object-position: center center !important;
          background: black;
        }
      `}</style>
    </main>
  );
}

/* ---------- tiny UI helpers ---------- */
function Field({ label, value }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase text-white/60">{label}</div>
      <input value={value} disabled className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm" />
    </div>
  );
}
function Stat({ label, children }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-2">
      <div className="text-[9px] uppercase text-white/60 leading-none">{label}</div>
      <div className="mt-1 text-base font-semibold truncate">{children}</div>
    </div>
  );
}
