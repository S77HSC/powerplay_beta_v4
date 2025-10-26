'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { sessionData } from '../../lib/sessionData';
import dynamic from 'next/dynamic';
import confetti from 'canvas-confetti';
import Image from 'next/image';

const BallTouchTrackerFinal = dynamic(() => import('../../components/BallTouchTrackerFinal'), { ssr: false });

const XP_GOAL = 100;
const REPS = 3;
const REST = 10;

const LEVELS = {
  beginner: 20,
  intermediate: 30,
  advanced: 40,
  elite: 50,
};

export default function WorkoutBuilder() {
  const router = useRouter();

  const [player, setPlayer] = useState(null);
  const [points, setPoints] = useState(0);
  const [rank, setRank] = useState(null);
  const [sessions, setSessions] = useState(0);
  const [goals, setGoals] = useState(0);
  const [wins, setWins] = useState(0);

  const [selectedLevel, setSelectedLevel] = useState(null);
  const [workout, setWorkout] = useState([]);
  const [isReady, setIsReady] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [prepCountdown, setPrepCountdown] = useState(0);
  const [repCountdown, setRepCountdown] = useState(0);

  const [totalTime, setTotalTime] = useState(0);           // live remaining seconds
  const [initialTotalTime, setInitialTotalTime] = useState(0); // planned total at start

  const [currentSkillIndex, setCurrentSkillIndex] = useState(0);
  const [currentRep, setCurrentRep] = useState(0);

  const [touchCount, setTouchCount] = useState(0); // live for current skill
  const [touchesPerSkill, setTouchesPerSkill] = useState([]); // locked values per skill
  const touchesPerSkillRef = useRef([]);

  const [xpEarned, setXpEarned] = useState(25);
  const [showXpModal, setShowXpModal] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [trackerActive, setTrackerActive] = useState(false);

  // user must press Start; no auto-start on level select
  const [startRequested, setStartRequested] = useState(false);

  const videoRef = useRef(null);

  // unlocked_skills.players_id stores auth_id
  const getPlayerKey = (p) => p?.auth_id;

  // ---------- Supabase helpers (auth_id keyed) ----------
  const fetchUnlockedSet = async (playerKey) => {
    const { data, error } = await supabase
      .from('unlocked_skills')
      .select('skill_id')
      .eq('players_id', playerKey);
    if (error) {
      console.error('fetchUnlockedSet error:', error);
      return new Set();
    }
    return new Set((data || []).map((r) => r.skill_id));
  };

  const seedStartersIfEmpty = async (playerKey) => {
    const starters = Object.entries(sessionData)
      .sort((a, b) => (a[1].unlockXP ?? Infinity) - (b[1].unlockXP ?? Infinity))
      .slice(0, 4)
      .map(([key]) => ({
        players_id: playerKey,
        skill_id: key,
        unlocked_at: new Date().toISOString(),
      }));
    if (starters.length) {
      const { error } = await supabase.from('unlocked_skills').insert(starters);
      if (error) console.error('seedStartersIfEmpty error:', error);
    }
  };

  const backfillUnlocks = async (playerKey, currentPoints) => {
    try {
      const already = await fetchUnlockedSet(playerKey);
      const toGrant = Object.entries(sessionData)
        .filter(([key, s]) => (s.unlockXP ?? Infinity) <= (currentPoints ?? 0) && !already.has(key))
        .map(([key]) => ({
          players_id: playerKey,
          skill_id: key,
          unlocked_at: new Date().toISOString(),
        }));
      if (toGrant.length) {
        const { error } = await supabase.from('unlocked_skills').insert(toGrant);
        if (error) console.error('backfill insert error:', error);
      }
    } catch (e) {
      console.error('backfillUnlocks error:', e);
    }
  };

  // ---------- Load player & ensure unlocks exist ----------
  useEffect(() => {
    const fetchPlayer = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: playerData, error: pErr } = await supabase
        .from('players')
        .select('*')
        .eq('auth_id', user.id)
        .single();

      if (pErr || !playerData) {
        console.error('No player row for user', user?.id, pErr || {});
        return;
      }

      setPlayer(playerData);
      setPoints(playerData.points || 0);
      setGoals(playerData.goals || 0);
      setWins(playerData.games_won || 0);

      // sessions
      const { data: sessionRows } = await supabase
        .from('workout_sessions')
        .select('id')
        .eq('player_id', playerData.id);
      setSessions(sessionRows?.length || 0);

      // rank
      const { data: allPlayers } = await supabase.from('players').select('id, points');
      if (allPlayers) {
        const sorted = allPlayers.sort((a, b) => (b.points || 0) - (a.points || 0));
        const position = sorted.findIndex((p) => p.id === playerData.id);
        setRank(position >= 0 ? position + 1 : null);
      }

      // Unlocks: seed & backfill
      const playerKey = getPlayerKey(playerData);
      if (!playerKey) return;
      let unlockedSet = await fetchUnlockedSet(playerKey);
      if (unlockedSet.size === 0) {
        await seedStartersIfEmpty(playerKey);
        unlockedSet = await fetchUnlockedSet(playerKey);
      }
      await backfillUnlocks(playerKey, playerData.points || 0);
    };

    fetchPlayer();
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [workout, currentSkillIndex]);

  // ---------- Build workout for a level (no auto-start) ----------
  const prepareWorkout = async (level) => {
    if (!player) return;
    setSelectedLevel(level);
    setStartRequested(false); // ensure it waits for Start click

    const playerKey = getPlayerKey(player);
    if (!playerKey) return;

    let unlockedSet = await fetchUnlockedSet(playerKey);
    if (unlockedSet.size === 0) {
      await seedStartersIfEmpty(playerKey);
      unlockedSet = await fetchUnlockedSet(playerKey);
    }

    const unlocked = Object.entries(sessionData)
      .filter(([key]) => unlockedSet.has(key))
      .sort(() => 0.5 - Math.random())
      .slice(0, 4)
      .map(([key, s]) => ({ ...s, key, reps: REPS, time: LEVELS[level], rest: REST }));

    const picks =
      unlocked.length > 0
        ? unlocked
        : Object.entries(sessionData)
            .sort((a, b) => (a[1].unlockXP ?? Infinity) - (b[1].unlockXP ?? Infinity))
            .slice(0, 4)
            .map(([key, s]) => ({ ...s, key, reps: REPS, time: LEVELS[level], rest: REST }));

    // plan time (work + rest per skill, minus final rest)
    const plannedTotal = picks.reduce((sum, s) => sum + (s.time * REPS) + (s.rest * REPS), 0) - REST;

    setWorkout(picks);
    setIsReady(true);
    setIsRunning(false);
    setIsResting(false);
    setCurrentSkillIndex(0);
    setCurrentRep(0);
    setPrepCountdown(0);
    setRepCountdown(0);
    setTouchCount(0);
    setTouchesPerSkill([]);
    touchesPerSkillRef.current = [];
    setTotalTime(plannedTotal);
    setInitialTotalTime(plannedTotal);
  };

  // ---------- Start button (user-initiated) ----------
  const startSession = async () => {
    setStartRequested(true);
    setPrepCountdown(3);
    setTrackerActive(false);
    new Audio('/sounds/VoicesAI_Sonic_Rep_one.mp3').play();
  };

  // Countdown: only start if user requested
  useEffect(() => {
    if (prepCountdown > 0) {
      const t = setTimeout(() => setPrepCountdown((p) => p - 1), 1000);
      return () => clearTimeout(t);
    }
    if (prepCountdown === 0 && isReady && startRequested && !isRunning) {
      setIsRunning(true);
      setRepCountdown(workout[0]?.time);
      setTimeout(() => setTrackerActive(true), 0);
    }
  }, [prepCountdown, isReady, startRequested, isRunning, workout]);

  // Global total-time ticker (works during work + rest)
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setTotalTime((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  // Per-segment timer
  useEffect(() => {
    if (!isRunning || repCountdown <= 0) return;
    const t = setTimeout(() => setRepCountdown((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [repCountdown, isRunning]);

  // Flow between work & rest — SNAPSHOT touches at end of WORK
  useEffect(() => {
    if (!isRunning || repCountdown > 0) return;
    const current = workout[currentSkillIndex];

    if (isResting) {
      // finished a REST block -> either next rep, next skill, or finish workout
      if (currentRep + 1 < REPS) {
        const nextRep = currentRep + 1;
        setCurrentRep(nextRep);
        setIsResting(false);
        setRepCountdown(current.time);
        setTrackerActive(true);
        playAudioForRep(nextRep);
      } else if (currentSkillIndex + 1 < workout.length) {
        const nextIdx = currentSkillIndex + 1;
        setCurrentSkillIndex(nextIdx);
        setCurrentRep(0);
        setIsResting(false);
        setRepCountdown(workout[nextIdx].time);
        setTrackerActive(true);
        setTouchCount(0); // fresh counter for new skill
        playAudio('VoicesAI_Sonic_next_skill.mp3');
        setTimeout(() => playAudio('VoicesAI_Sonic_Rep_one.mp3'), 1500);
      } else {
        playAudio('VoicesAI_Sonic_session_completed.mp3');
        finishWorkout();
      }
    } else {
      // WORK just ended -> snapshot touches for this skill
      setTouchesPerSkill((prev) => {
        const updated = [...prev];
        updated[currentSkillIndex] = touchCount;
        touchesPerSkillRef.current = updated;
        return updated;
      });

      setTouchCount(0); // reset live counter before rest

      // Switch to REST
      setIsResting(true);
      setRepCountdown(REST);
      setTrackerActive(false);
      playAudio('VoicesAI_Sonic_Take_a_break.mp3');
    }
  }, [repCountdown, isRunning, isResting, currentRep, currentSkillIndex, workout, touchCount]);

  const playAudio = (fileName) => new Audio(`/sounds/${fileName}`).play();
  const playAudioForRep = (rep) => {
    const files = ['VoicesAI_Sonic_Rep_two.mp3', 'VoicesAI_Sonic_Rep_three.mp3'];
    if (files[rep - 1]) playAudio(files[rep - 1]);
  };

  const handleTouchDetected = (newTouchCount) => {
    setTouchCount(newTouchCount);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 300);
  };

  // ---------- Finish & Save ----------
  const finishWorkout = async () => {
    setIsRunning(false);
    setIsReady(false);
    setStartRequested(false);

    // make sure the last skill's touches are captured if we ended on WORK (safety)
    setTouchesPerSkill((prev) => {
      const updated = [...prev];
      updated[currentSkillIndex] = updated[currentSkillIndex] ?? touchCount;
      touchesPerSkillRef.current = updated;
      return updated;
    });

    // compute totals
    const touchesArray = touchesPerSkillRef.current || [];
    const totalTouches = touchesArray.reduce((sum, v) => sum + (v || 0), 0);
    const elapsedSeconds = Math.max(0, (initialTotalTime || 0) - (totalTime || 0));

    try {
      if (player) {
        // per-skill rows: NO per-line XP
        const sessionInserts = workout.map((skill, i) => ({
          player_id: player.id,
          completed_at: new Date().toISOString(),
          xr_awarded: 0,
          reps: skill.reps,
          work_time: skill.time,
          rest_time: skill.rest,
          skill_name: skill.name || skill.title,
          touches: touchesArray[i] || 0,
        }));
        await supabase.from('workout_sessions').insert(sessionInserts);

        // workout table totals (rename columns if needed to match your schema)
        await supabase.from('workout_table').insert([{
          player_id: player.id,
          level: selectedLevel,
          workout_data: workout.map(w => ({
            name: w.name || w.title,
            reps: w.reps,
            time: w.time,
            rest: w.rest,
          })),
          xp: xpEarned,
          total_touches: totalTouches,
          total_time_seconds: elapsedSeconds,
          created_at: new Date().toISOString(),
        }]);

        // award XP ONCE
        const newPoints = (points ?? 0) + xpEarned;
        await supabase.from('players').update({ points: newPoints }).eq('id', player.id);
        setPoints(newPoints);

        // confetti if leveled up
        if (Math.floor(newPoints / XP_GOAL) > Math.floor((points ?? 0) / XP_GOAL)) {
          confetti({ particleCount: 140, spread: 70, origin: { y: 0.6 } });
        }

        // Show reward modal
        setShowXpModal(true);
      }
    } catch (err) {
      console.error('Error saving session:', err);
    } finally {
      setTrackerActive(false);
      resetWorkout();
    }
  };

  const resetWorkout = () => {
    setWorkout([]);
    setSelectedLevel(null);
    setCurrentSkillIndex(0);
    setCurrentRep(0);
    setTouchCount(0);
    setTouchesPerSkill([]);
    touchesPerSkillRef.current = [];
    setPrepCountdown(0);
    setRepCountdown(0);
    setTotalTime(0);
    setInitialTotalTime(0);
    setIsResting(false);
    setIsRunning(false);
    setStartRequested(false);
  };

  // cumulative touches shown in UI
  const touchesSoFar =
    (touchesPerSkillRef.current?.reduce((a, b) => a + (b || 0), 0) || 0) + (touchCount || 0);

  const current = workout[currentSkillIndex];

  return (
    <main className="relative min-h-screen text-white px-4 py-6 font-sans bg-gradient-to-br from-[#0a0f19] via-[#111827] to-[#0a0f19]">
      <div
        className="absolute inset-0 z-0 opacity-40 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: "url('/images/workout_builder.png')" }}
      />
      <div className="relative z-10 max-w-6xl mx-auto space-y-8 px-4 md:px-8">
        {/* Back + Title */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition"
            aria-label="Go back"
          >
            ← Back
          </button>
          <h2 className="text-center font-sans tracking-wide text-sky-400 font-bold text-xl flex-1">
            Auto Workout Builder
          </h2>
          <div className="w-[68px]" />
        </div>

        {/* Single player header */}
        {player && (
          <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/10 flex flex-col md:flex-row justify-between items-center md:items-end gap-6 mt-2">
            <div className="flex items-center gap-4">
              {player.avatar_url && (
                <Image
                  src={
                    player.avatar_url.startsWith('http')
                      ? player.avatar_url
                      : `https://uitlajpnqruvvykrcyyg.supabase.co/storage/v1/object/public/avatars/${player.avatar_url}`
                  }
                  alt="Avatar"
                  width={80}
                  height={80}
                  className="rounded-full border-2 border-white/30 w-[80px] h-[80px] object-cover"
                />
              )}
              <div>
                <h2 className="text-2xl font-bold text-cyan-300">{player.name}</h2>
                <p className="text-sm text-gray-400">{player?.team || player?.team_name || 'Team Unknown'}</p>
                <p className="text-xs text-sky-400 mt-1">Global Rank #{rank ?? 1}</p>
                <div className="w-full max-w-xs mt-2">
                  <div className="h-2 rounded-full bg-gray-700">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-400 to-pink-500 rounded-full animate-pulse"
                      style={{ width: `${Math.min(((points ?? 0) % 1000) / 10, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-right mt-1">{points ?? 0} XP</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto">
              <Stat label="XP" value={points ?? 0} />
              <Stat label="Sessions" value={sessions} />
              <Stat label="Goals" value={goals} />
              <Stat label="Wins" value={wins} />
            </div>
          </div>
        )}

        {/* Level buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 justify-center max-w-xs mx-auto">
          {Object.keys(LEVELS).map((level) => (
            <button
              key={level}
              onClick={async () => {
                try {
                  await prepareWorkout(level);
                } catch (e) {
                  console.error(e);
                }
              }}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                selectedLevel === level
                  ? 'bg-sky-500 text-white'
                  : 'bg-gray-800 border border-yellow-500 hover:bg-sky-600 text-white'
              }`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>

        {/* Workout area */}
        {isReady && (
          <>
            {isRunning && workout[currentSkillIndex]?.video_url && (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                loop
                className="rounded-2xl shadow-lg w-full max-w-[600px] mx-auto shadow-md border border-white/10 mt-6"
              >
                <source src={workout[currentSkillIndex].video_url} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            )}

            <div className="text-center font-sans tracking-wide mt-4 text-sm space-y-1">
              <p className="text-sky-300">
                Total Time Remaining: {Math.floor(totalTime / 60)}:{(totalTime % 60).toString().padStart(2, '0')}
              </p>
              <p className="text-sky-300">XP: {points} / Level {Math.floor(points / XP_GOAL)}</p>
              <p className="text-green-400 font-extrabold text-4xl">Touches: {touchesSoFar}</p>
            </div>

            <div className="text-center font-sans tracking-wide space-y-2">
              <h2 className="text-5xl font-extrabold">{prepCountdown > 0 ? `${prepCountdown}` : `${repCountdown}s`}</h2>
              <p className="text-xl text-sky-400">{isResting ? 'Rest' : `Skill ${currentSkillIndex + 1}, Rep ${currentRep + 1}`}</p>
              <div className="flex justify-center gap-4 mt-2">
                <button
                  onClick={startSession}
                  disabled={isRunning || prepCountdown > 0}
                  className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded text-lg font-semibold"
                >
                  Start
                </button>
                {isRunning ? (
                  <button
                    onClick={() => {
                      setIsRunning(false);
                      setTrackerActive(false);
                    }}
                    className="bg-yellow-600 hover:bg-yellow-500 px-4 py-1 rounded"
                  >
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (startRequested) {
                        setIsRunning(true);
                        setTrackerActive(true);
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded"
                  >
                    Resume
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsRunning(false);
                    setIsReady(false);
                    resetWorkout();
                  }}
                  className="bg-red-600 hover:bg-red-500 px-4 py-1 rounded"
                >
                  Stop
                </button>
              </div>
            </div>

            <div className="w-full mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="rounded-2xl shadow-lg overflow-hidden border border-white/10 relative">
                <BallTouchTrackerFinal
                  key={trackerActive ? 'active' : 'inactive'}
                  active={trackerActive}
                  onTouchDetected={handleTouchDetected}
                />
                {showFlash && <div className="absolute inset-0 bg-green-500 opacity-30 animate-pulse" />}
              </div>

              <div className="bg-gray-800 border border-yellow-500 p-4 rounded-2xl shadow-lg space-y-2">
                {isRunning && workout[currentSkillIndex]?.video_url && (
                  <section className="flex flex-col md:flex-row gap-6 items-start mt-6">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      loop
                      className="rounded-2xl shadow-lg w-full md:w-1/2 shadow-md border border-white/10"
                    >
                      <source src={workout[currentSkillIndex].video_url} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                    <div className="w-full md:w-1/2">{/* webcam slot */}</div>
                  </section>
                )}

                <h3 className="text-xl font-extrabold text-yellow-300 uppercase tracking-wide text-sky-400">
                  Session Overview
                </h3>
                {workout.map((s, i) => (
                  <div key={i} className={`text-sm border-b pb-1 ${i === currentSkillIndex ? 'bg-sky-900/30 rounded' : ''}`}>
                    <p className="font-semibold text-white">Skill {i + 1}: {s.name || s.title}</p>
                    <p className="text-sky-300">{s.reps} Reps × {s.time}s</p>
                    <p className="text-xs text-emerald-300">Touches saved: {touchesPerSkillRef.current[i] ?? 0}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Reward modal */}
        {showXpModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <div className="relative w-full max-w-md rounded-2xl border border-amber-400/50 bg-gradient-to-b from-[#0b1220] to-[#0a0f19] p-6 text-center shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
              {/* close button */}
              <button
                onClick={() => setShowXpModal(false)}
                className="absolute right-3 top-3 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-sm hover:bg-white/20"
                aria-label="Close"
              >
                ✕
              </button>

              {/* reward icon */}
              <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-tr from-yellow-300 to-pink-400 text-[#0a0f19] shadow-lg">
                ⭐
              </div>

              <h3 className="text-2xl font-extrabold text-amber-300 tracking-wide">Workout Complete!</h3>
              <p className="mt-1 text-sm text-gray-300">Nice work. Rewards have been applied.</p>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-3xl font-black text-white">{xpEarned} XP</div>
                <div className="text-xs text-gray-400 mt-1">Total touches: {touchesPerSkillRef.current.reduce((a,b)=>a+(b||0),0)}</div>
              </div>

              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowXpModal(false)}
                  className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
                >
                  Close
                </button>
                <button
                  onClick={() => { setShowXpModal(false); router.back(); }}
                  className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-[#0a0f19] hover:bg-amber-300"
                >
                  Exit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }) {
  const icon = label === 'XP' ? '⚡' : label === 'Sessions' ? '📅' : label === 'Goals' ? '🥅' : '🏆';
  return (
    <div className="flex flex-col items-center bg-black/10 rounded-lg px-4 py-2 border border-white/10">
      <div className="text-xl mb-1">{icon}</div>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}
