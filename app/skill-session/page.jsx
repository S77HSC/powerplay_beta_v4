// app/skill-session/page.jsx
'use client';
export const dynamic = 'force-dynamic';

/**
 * Skill Session — rep/rest sequencing copied from Daily (working)
 * ----------------------------------------------------------------
 * This component now mirrors the countdown/work/rest state machine used
 * in DailyPlayerContent.jsx so reps NEVER skip. Increment happens exactly
 * once at REST → WORK (or immediately if rest = 0s).
 */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { sessionData } from '../../lib/sessionData';
import BallTouchTrackerFinal from '../../components/BallTouchTrackerFinal';
import SessionCompleteModal from 'app/skill-session/SessionCompleteModal';

const TABLE = 'workout_sessions';

export default function SkillSessionPage() {
  return <ClientSkillSessionPage />;
}

function ClientSkillSessionPage() {
  // ----- derive content from query param -----
  const params = useSearchParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sessionKey = mounted ? (params.get('session')?.trim() ?? '') : '';
  const s = (sessionKey && sessionData[sessionKey]) || null;

  const title       = s?.title ?? 'Skill Session';
  const videoSrc    = s?.video ?? '';
  const posterSrc   = s?.img || '/stadiums/wembley.png';
  const stadiumName = s?.stadium ?? 'Stadium';
  const location    = s?.location ?? '';

  // =========================
  // USER CONTROLS
  // =========================
  const [reps, setReps] = useState(6);
  const [timePerRep, setTimePerRep] = useState(10);
  const [restTime, setRestTime] = useState(5);
  const [touches, setTouches] = useState(0);

  const totalWork = useMemo(() => (reps || 0) * (timePerRep || 0), [reps, timePerRep]);
  const totalRest = useMemo(() => Math.max(0, (Math.max(1, reps || 0) - 1) * (restTime || 0)), [reps, restTime]);
  const totalSecs = totalWork + totalRest;

  // =========================
  // STATE MACHINE (identical to Daily)
  // phases: idle | countdown | work | rest | done
  // =========================
  const [isRunning, setIsRunning] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [prepCountdown, setPrepCountdown] = useState(0); // 3..2..1..GO
  const [repCountdown, setRepCountdown] = useState(0);   // seconds left in current segment
  const [currentRep, setCurrentRep] = useState(0);       // 1-based
  const [afterPrep, setAfterPrep] = useState(false);
  const prevPhaseRef = useRef('idle');

  // Derived phase label for UI and video
  const phase = prepCountdown > 0 ? 'countdown' : !isRunning ? 'idle' : isResting ? 'rest' : 'work';

  // =========================
  // AUDIO / VIBRATION (same patterns)
  // =========================
  const [volume, setVolume] = useState(0.18);
  const audioCtxRef = useRef(null);
  const ensureAudio = async () => {
    const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
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

  // =========================
  // VIDEO CONTROL
  // =========================
  const videoRef = useRef(null);
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    if (!isRunning) {
      v.loop = true; try { v.play().catch(() => {}); } catch {}
    } else if (phase === 'work') {
      v.loop = false; try { v.play().catch(() => {}); } catch {}
    } else {
      try { v.pause(); } catch {}
    }
  }, [isRunning, phase, videoSrc]);

  // =========================
  // COUNTDOWN BEEPS (3..2..1..GO)
  // =========================
  const prevPrepRef = useRef(0);
  useEffect(() => {
    const prev = prevPrepRef.current;
    if (prepCountdown > 0 && prepCountdown !== prev) {
      beepCountdownTick();
      prevPrepRef.current = prepCountdown;
    }
    if (prev === 1 && prepCountdown === 0) beepCountdownGo();
  }, [prepCountdown]);

  // =========================
  // PREP COUNTDOWN ENGINE
  // =========================
  const prepTimerRef = useRef(null);
  useEffect(() => {
    if (prepCountdown > 0) {
      prepTimerRef.current = setTimeout(() => setPrepCountdown((c) => c - 1), 1000);
    } else if (prepCountdown === 0 && afterPrep && !isRunning) {
      setAfterPrep(false);
      startFirstWork();
    }
    return () => clearTimeout(prepTimerRef.current);
  }, [prepCountdown, afterPrep, isRunning]);

  // =========================
  // REP/REST COUNTDOWN ENGINE (identical to Daily’s approach)
  // =========================
  const segTimerRef = useRef(null);
  const [workSeconds, setWorkSeconds] = useState(0); // actual work seconds (for partials)
  useEffect(() => {
    if (!isRunning || repCountdown <= 0) return;
    segTimerRef.current = setTimeout(() => {
      setRepCountdown((t) => t - 1);
      if (!isResting) setWorkSeconds((s) => s + 1);
    }, 1000);
    return () => clearTimeout(segTimerRef.current);
  }, [repCountdown, isRunning, isResting]);

  // =========================
  // PHASE TRANSITIONS WHEN A SEGMENT ENDS
  // =========================
  useEffect(() => {
    if (!isRunning || repCountdown !== 0) return;
    if (isResting) {
      // REST → WORK: increment exactly once here
      setIsResting(false);
      setCurrentRep((r) => r + 1);
      setRepCountdown(Math.max(1, Number(timePerRep) || 0));
    } else {
      // WORK just ended
      if (currentRep >= Math.max(1, Number(reps) || 0)) {
        // finished last rep
        setIsRunning(false);
        beepComplete();
        setTimeout(() => handleSave(), 0);
      } else if (Math.max(0, Number(restTime) || 0) > 0) {
        // enter rest (do NOT increment yet)
        setIsResting(true);
        setRepCountdown(Math.max(1, Number(restTime) || 0));
      } else {
        // no rest → immediately advance to next rep
        setCurrentRep((r) => r + 1);
        setRepCountdown(Math.max(1, Number(timePerRep) || 0));
      }
    }
  }, [repCountdown, isRunning, isResting, currentRep, reps, timePerRep, restTime]);

  // Phase change beeps
  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev !== phase) {
      if (phase === 'rest') beepRest();
      if (phase === 'work' && (prev === 'rest' || prev === 'countdown')) beepWorkStart();
      prevPhaseRef.current = phase;
    }
  }, [phase]);

  // =========================
  // START / STOP / PARTIAL SAVE
  // =========================
  const saveTriggeredRef = useRef(false);

  const onStart = async () => {
    saveTriggeredRef.current = false;
    try { ensureAudio(); } catch {}
    setTouches(0);
    setCurrentRep(0);
    setRepCountdown(0);
    setIsResting(false);
    setIsRunning(false);
    setAfterPrep(true);
    setPrepCountdown(3);
  };

  const startFirstWork = () => {
    setIsRunning(true);
    setIsResting(false);
    setCurrentRep(1);
    setRepCountdown(Math.max(1, Number(timePerRep) || 0));
    try {
      const v = videoRef.current; if (v) { v.currentTime = 0; v.loop = false; v.muted = true; v.play().catch(() => {}); }
    } catch {}
  };

  const onStopClick = () => {
    if (phase === 'work' || phase === 'rest' || phase === 'countdown') setStopOpen(true);
  };
  const [stopOpen, setStopOpen] = useState(false);
  const onStopResume = () => setStopOpen(false);
  const onStopDiscard = () => {
    setStopOpen(false);
    clearTimeout(prepTimerRef.current); clearTimeout(segTimerRef.current);
    try { videoRef.current?.pause(); } catch {}
    setIsRunning(false); setIsResting(false); setPrepCountdown(0); setRepCountdown(0); setCurrentRep(0);
    saveTriggeredRef.current = false;
  };
  const onStopSavePartial = async () => {
    setStopOpen(false);

    // completed reps so far — same rule as Daily
    const completedReps = isResting ? currentRep : Math.max(0, currentRep - 1);

    const partialWork   = phase === 'work' ? Math.max(0, (Number(timePerRep) || 0) - repCountdown) : 0;
    const partialRest   = phase === 'rest' ? Math.max(0, (Number(restTime) || 0) - repCountdown) : 0;

    const workSecondsCalc = (completedReps * (Number(timePerRep) || 0)) + partialWork;
    const restBlocksBefore = Math.max(0, completedReps - 1);
    const restSecondsCalc = ((Number(restTime) || 0) * restBlocksBefore) + partialRest;

    await handleSave({
      reps: completedReps,
      touches,
      workSeconds: Math.max(0, Math.floor(workSecondsCalc)),
      restSeconds: Math.max(0, Math.floor(restSecondsCalc)),
      totalSeconds: Math.max(0, Math.floor(workSecondsCalc + restSecondsCalc)),
    });

    clearTimeout(prepTimerRef.current); clearTimeout(segTimerRef.current);
    try { videoRef.current?.pause(); } catch {}
    setIsRunning(false); setIsResting(false); setPrepCountdown(0); setRepCountdown(0); setCurrentRep(0);
  };

  // =========================
  // SAVE (same as before; planned on natural complete, partial if requested)
  // =========================
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionXP, setSessionXP] = useState(0);
  const [coachSummary, setCoachSummary] = useState('');

  async function handleSave(forceStats) {
    if (saveTriggeredRef.current) return; // single-flight
    saveTriggeredRef.current = true;
    try {
      // 1) Auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to save this workout.');

      // 2) Player by auth_id (RLS requirement)
      const { data: player, error: pErr } = await supabase
        .from('players')
        .select('id')
        .eq('auth_id', user.id)
        .single();
      if (pErr || !player?.id) throw new Error('Player profile not found.');

      // 3) Stats
      const stats = forceStats || {
        reps: Math.max(0, Number(reps) || 0),
        touches: Math.max(0, Number(touches) || 0),
        workSeconds: Math.max(0, Number(totalWork) || 0),
        restSeconds: Math.max(0, Number(totalRest) || 0),
        totalSeconds: Math.max(0, Number(totalSecs) || 0),
      };

      // 4) Insert
      const insertRow = {
        skill_name: title,
        reps: stats.reps,
        work_time: stats.workSeconds,
        rest_time: stats.restSeconds,
        touches: stats.touches,
        player_id: player.id,
        completed_at: new Date().toISOString(),
      };
      const ins = await supabase.from(TABLE).insert(insertRow).select('id').single();
      if (ins.error) throw new Error(ins.error?.message || JSON.stringify(ins.error));

      // 5) Select xp
      const sel = await supabase
        .from(TABLE)
        .select('id,xr_awarded,completed_at')
        .eq('id', ins.data.id)
        .single();
      if (sel.error) throw new Error(sel.error?.message || JSON.stringify(sel.error));

      const xr = typeof sel.data?.xr_awarded === 'string' ? Number(sel.data.xr_awarded) : sel.data?.xr_awarded;
      const xp = Number.isFinite(xr) ? Math.max(0, Math.floor(xr)) : 0;
      setSessionXP(xp);

      setCoachSummary(localSummary(title, stats, timePerRep, restTime));
      setSessionComplete(true);
    } catch (e) {
      console.error('[skill-session] save failed:', e);
      setSessionXP(0);
      setCoachSummary('');
      setSessionComplete(true);
      saveTriggeredRef.current = false; // allow retry
    }
  }

  function localSummary(title, { reps, workSeconds, restSeconds, touches }, workTime, restT) {
    const avg = reps ? Math.round(touches / reps) : 0;
    const w = reps ? Math.round(workSeconds / Math.max(1, reps)) : Number(workTime) || 0;
    const r = reps > 1 ? Math.round(restSeconds / Math.max(1, reps - 1)) : Number(restT) || 0;
    if (!touches) return `${title}: Completed ${reps} reps (~${w}s work / ${r || 0}s rest). No touches detected — try enabling the camera or tap +1.`;
    return `${title}: ${reps} reps (~${w}s work / ${r || 0}s rest), ${touches} touches (~${avg}/rep). Nice work!`;
  }

  if (!mounted) return null;

  // =========================
  // UI
  // =========================
  const bgSrc = '/images/futuristic-stadium_4.png';
  return (
    <main className="relative min-h-screen text-white">
      {/* Background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: `url('${bgSrc}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(.92) saturate(1.03)'
        }}
      />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(0,0,0,16),rgba(0,0,0,88))]" />

      <div className="mx-auto max-w-[1400px] px-6 py-4 h-full grid grid-rows-[auto_auto_1fr] gap-3">
        {/* Back */}
        <div>
          <Link href="/lobby" className="inline-block rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15">
            ← Back to Lobby
          </Link>
        </div>

        {/* Stadium pill */}
        <div className="rounded-2xl border border-white/10 bg-black/40 px-5 py-3">
          <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-300/80">Stadium</div>
          <div className="text-xl font-bold leading-tight">{stadiumName}</div>
          {location && <div className="text-xs text-white/70">{location}</div>}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 min-h-0">
          {/* LEFT: Video + overlays */}
          <div className="flex flex-col min-h-0">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 flex-1 min-h-0">
              <div className="relative w-full h-full">
                {videoSrc ? (
                  <video
                    ref={videoRef}
                    key={videoSrc || 'novid'}
                    src={videoSrc}
                    poster={posterSrc}
                    preload="metadata"
                    muted
                    playsInline
                    controls
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-white/70">No training video</div>
                )}

                {/* Title chip moved to top-left so bottom controls remain clickable */}
                <div className="absolute top-2 left-2 z-10 pointer-events-none">
                  <div className="pointer-events-auto rounded-md border border-white/15 bg-black/50 backdrop-blur px-3 py-1.5">
                    <div className="text-[12px] font-semibold leading-none">
                      {title}
                    </div>
                    <div className="mt-0.5 text-[10px] text-white/80">
                      {stadiumName}{location ? ` • ${location}` : ''}
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

                {/* Stop confirm modal */}
                {stopOpen && (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-xl border border-white/10 bg-neutral-900/95 p-4">
                      <div className="mb-3 text-sm">End session?</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button onClick={onStopResume} className="rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/20">Resume</button>
                        <button onClick={onStopDiscard} className="rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/20">End without saving</button>
                        <button onClick={onStopSavePartial} className="rounded-md bg-sky-500 px-3 py-2 text-sm font-semibold text-black hover:brightness-110">Save partial & end</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="text-sm text-white/80 mb-3">
                Adjust your session and press <b>Start Training</b>. Use <b>Stop</b> to <b>Save partial & end</b> anytime; results also save automatically when you finish.
              </p>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <NumberInput label="Reps" value={reps} onChange={(v) => setReps(Math.max(1, v))} min={1} />
                <NumberInput label="Time/Rep (s)" value={timePerRep} onChange={(v) => setTimePerRep(Math.max(1, v))} min={1} />
                <NumberInput label="Rest (s)" value={restTime} onChange={(v) => setRestTime(Math.max(0, v))} min={0} />
              </div>

              <div className="mb-3">
                <div className="mb-1 text-[10px] uppercase text-white/60">Volume</div>
                <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-40" />
              </div>

              <div className="flex flex-wrap gap-3">
                {(phase === 'work' || phase === 'rest' || phase === 'countdown') ? (
                  <button onClick={onStopClick} className="rounded-lg bg-white/10 px-5 py-3 text-sm hover:bg-white/20">Stop</button>
                ) : (
                  <button onClick={onStart} className="rounded-lg bg-sky-500 px-5 py-3 font-semibold text-black hover:brightness-110">Start Training</button>
                )}
                <Link href="/skills" className="rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm hover:bg-white/10">Browse Skills</Link>
              </div>
            </div>
          </div>

          {/* RIGHT: Tracker & Stats */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 flex flex-col min-h-0">
            <div className="relative rounded-xl bg-black/80 overflow-hidden aspect-[4/3] w-full">
              <div className="tracker-stage absolute inset-0">
                {isRunning && !isResting && s ? (
                  <BallTouchTrackerFinal isActive onTouchChange={setTouches} />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-white/70 text-sm px-3">
                    {prepCountdown > 0 ? 'Get ready…' : isResting ? (
                      <div className="text-center">
                        <div className="text-[10px] uppercase tracking-widest text-cyan-300/80 mb-1">Rest</div>
                        <div className="text-5xl font-black tabular-nums">{repCountdown}</div>
                        <div className="mt-2 text-xs text-white/60">Camera paused • touches not counted</div>
                      </div>
                    ) : (
                      <>Camera starts when you press <b>Start Training</b>.</>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-1 text-center text-[10px] text-white/70 leading-tight">
              <span className="font-semibold text-lime-300">DETECTION</span> • Camera pauses during rest; resumes on work.
            </div>

            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
              <Stat label="Phase">{phase === 'idle' ? 'Idle' : phase === 'countdown' ? `Starting in ${prepCountdown}` : phase === 'work' ? 'Working' : 'Rest'}</Stat>
              <Stat label="Rep">{(phase === 'work' || phase === 'rest') ? `${Math.max(1, currentRep)}/${reps}` : `0/${reps}`}</Stat>
              <Stat label="Time Left">{(phase === 'work' || phase === 'rest') && isRunning ? repCountdown : '-'}</Stat>
              <div className="rounded-md border border-white/10 bg-white/5 p-2">
                <div className="text-[9px] uppercase text-white/60 leading-none">Touches</div>
                <div className="mt-1 text-2xl font-bold leading-none">{touches}</div>
                <div className="mt-2 flex items-center gap-1">
                  <button onClick={() => setTouches(0)} className="rounded bg-white/10 px-2 py-1 text-[10px] hover:bg-white/20">Reset</button>
                  <button onClick={() => setTouches((t) => t + 1)} className="rounded bg-white/10 px-2 py-1 text-[10px] hover:bg-white/20">+1</button>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-md border border-white/10 bg-white/5 p-3">
              <div className="text-[10px] uppercase text-white/60 mb-1">Planned Session</div>
              <div className="text-sm text-white/90">Reps: <b>{reps}</b> • Time/Rep: <b>{timePerRep}s</b> • Rest: <b>{restTime}s</b> • Total: <b>{totalSecs}s</b></div>
            </div>
          </div>
        </div>
      </div>

      {/* Completion Modal */}
      <SessionCompleteModal
        open={sessionComplete}
        onClose={() => setSessionComplete(false)}
        loading={false}
        xp={sessionXP}
        points={sessionXP}
        summary={coachSummary}
        stats={{
          reps,
          touches,
          workSeconds: totalWork,
          restSeconds: totalRest,
          totalSeconds: totalSecs,
        }}
      />

      <style jsx global>{`
        .tracker-stage canvas,
        .tracker-stage video {
          width: 100% !important;
          height: 100% !important;
          display: block;
          object-fit: contain !important;
          background: black;
        }
      `}</style>
    </main>
  );
}

// =========================
// SMALL UI PIECES
// =========================
function NumberInput({ label, value, onChange, min = 0 }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase text-white/60">{label}</div>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
      />
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
