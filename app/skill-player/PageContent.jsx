'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { sessionData } from '../../lib/sessionData';
import { supabase } from '../../lib/supabase';

// ──────────────────────────────────────────────────────────
// Lazy‑load the webcam tracker so SSR doesn’t choke
// ──────────────────────────────────────────────────────────
const BallTouchTrackerFinal = dynamic(
  () => import('../../components/BallTouchTrackerFinal'),
  { ssr: false }
);

export default function PageContent() {
  /*─────────────────── UI STATE ───────────────────*/
  const [reps, setReps]               = useState(5);
  const [timePerRep, setTimePerRep]   = useState(30);
  const [restTime, setRestTime]       = useState(15);

  const [prepCountdown, setPrepCountdown] = useState(0);
  const [repCountdown, setRepCountdown]   = useState(0);
  const [isRunning, setIsRunning]         = useState(false);
  const [isPaused, setIsPaused]           = useState(false);
  const [isResting, setIsResting]         = useState(false);
  const [currentRep, setCurrentRep]       = useState(0);

  const [shouldStartAfterCountdown, setShouldStartAfterCountdown] = useState(false);
  const [workoutFinished, setWorkoutFinished] = useState(false);
  const [completed, setCompleted]           = useState(false);

  const [touchCount, setTouchCount]       = useState(0);
  const [finalTouchCount, setFinalTouchCount] = useState(0);

  /* NEW: bump to remount tracker */
  const [trackerKey, setTrackerKey] = useState(0);

  const timerRef = useRef(null);

  /*─────────────────── SESSION DATA ───────────────────*/
  const searchParams = useSearchParams();
  const sessionKey = searchParams.get('session');
  const session    = sessionData[sessionKey];
  console.log('🌟 URL sessionKey =', sessionKey);

  /*─────────────────── TIMERS ───────────────────*/
  useEffect(() => {
    if (prepCountdown > 0) {
      const t = setTimeout(() => setPrepCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
    if (shouldStartAfterCountdown) startWorkout();
  }, [prepCountdown, shouldStartAfterCountdown]);

  useEffect(() => {
    if (isRunning && repCountdown > 0 && !isPaused) {
      timerRef.current = setTimeout(() => setRepCountdown((c) => c - 1), 1000);
    } else if (repCountdown === 0 && isRunning && !isPaused) {
      handleRepFinish();
    }
    return () => clearTimeout(timerRef.current);
  }, [repCountdown, isRunning, isPaused]);

  /*─────────────────── WORKOUT HELPERS ───────────────────*/
  const startWorkout = () => {
    setIsRunning(true);
    setIsPaused(false);
    setIsResting(false);
    setRepCountdown(timePerRep);
    setCurrentRep(1);
    setTouchCount(0);
    setFinalTouchCount(0);
  };

  const handleRepFinish = () => {
    if (currentRep < reps) {
      setIsResting(true);
      setTimeout(() => {
        setIsResting(false);
        setRepCountdown(timePerRep);
        setCurrentRep((prev) => prev + 1);
      }, restTime * 1000);
    } else {
      setWorkoutFinished(true);
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (workoutFinished && !completed) {
      setFinalTouchCount(touchCount);
      handleComplete(touchCount);
    }
  }, [workoutFinished]);

  /*─────────────────── SAVE TO SUPABASE ───────────────────*/
  const handleComplete = async (touches) => {
    console.log('🧪 handleComplete triggered with touches =', touches);

    /* current user */
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('❌ No authenticated user');
      return;
    }

    /* player row */
    const { data: player, error: playerErr } = await supabase
      .from('players')
      .select('id, points')
      .eq('auth_id', user.id)
      .single();

    if (playerErr || !player) {
      console.error('❌ Player lookup failed:', playerErr);
      return;
    }

    /* derived metrics */
    const workSeconds = reps * timePerRep;
    const restSeconds = (reps - 1) * restTime;
    const earnedXP    = Math.floor(workSeconds / 4);   // 1 XP per 4 s

    /* insert workout */
    const { error: insertError } = await supabase.from('workout_sessions').insert([
      {
        player_id: player.id,
        skill_name: session.title,
        reps,
        work_time: workSeconds,
        rest_time: restSeconds,
        completed_at: new Date().toISOString(),
        touches,
        xr_awarded: earnedXP,
      },
    ]);

    if (insertError) {
      console.error('❌ Insert failed:', insertError);
      return;
    }

    /* update player */
    await supabase
      .from('players')
      .update({ points: (player.points || 0) + earnedXP })
      .eq('id', player.id);

    setCompleted(true);
    console.log('✅ Workout saved, XP awarded:', earnedXP);
  };

  /*─────────────────── RESET BUTTON HANDLER ───────────────────*/
  const handleReset = () => {
    setIsRunning(false);
    setIsPaused(false);
    setWorkoutFinished(false);
    setCompleted(false);
    setCurrentRep(0);
    setRepCountdown(0);
    setPrepCountdown(0);
    setFinalTouchCount(0);
    setTrackerKey((k) => k + 1);  // force a fresh tracker
  };

  /*─────────────────── EARLY EXIT ───────────────────*/
  if (!session) {
    return (
      <div className="text-white text-center p-8">
        <h2 className="text-lg font-bold">Session not found.</h2>
      </div>
    );
  }

  /*─────────────────── RENDER ───────────────────*/
  return (
    <main
      className="min-h-screen bg-cover bg-center text-white px-4 py-6"
      style={{ backgroundImage: "url('/images/daily_challenge_background.png')" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold text-yellow-400 uppercase tracking-wide drop-shadow-md">
            Skill Session
          </h1>
          <p className="text-sm text-gray-300">
            Train like a pro. Track your skills. Earn your XP.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LEFT: video + controls */}
          <div className="bg-black/30 border border-yellow-500 rounded-xl p-4 flex flex-col gap-4">
            <video
              src={session.video}
              controls
              className="w-full rounded-md h-[240px] md:h-[320px] object-cover"
            />

            <div className="grid grid-cols-3 gap-4 text-xs">
              <label className="flex flex-col gap-1">
                Reps
                <input
                  type="number"
                  value={reps}
                  onChange={(e) => setReps(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-yellow-500 rounded px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1">
                Time/Rep (s)
                <input
                  type="number"
                  value={timePerRep}
                  onChange={(e) => setTimePerRep(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-yellow-500 rounded px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1">
                Rest Time (s)
                <input
                  type="number"
                  value={restTime}
                  onChange={(e) => setRestTime(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-yellow-500 rounded px-2 py-1"
                />
              </label>
            </div>

            {/* status */}
            {prepCountdown > 0 && (
              <p className="text-center text-xl text-yellow-300">
                Get Ready: {prepCountdown}
              </p>
            )}
            {isResting && (
              <p className="text-center text-lg text-blue-300">Resting…</p>
            )}
            {isRunning && !isResting && (
              <p className="text-center text-lg text-lime-300">
                Rep {currentRep}/{reps} — {repCountdown}s
              </p>
            )}
            {workoutFinished && (
              <p className="text-center text-lg text-green-400">
                Workout complete! Touches: {finalTouchCount}
              </p>
            )}

            {/* buttons */}
            {!isRunning && !workoutFinished && (
              <button
                onClick={() => {
                  setPrepCountdown(5);
                  setShouldStartAfterCountdown(true);
                }}
                className="bg-yellow-400 text-black px-4 py-2 rounded font-bold text-xs hover:bg-yellow-500"
              >
                ▶ Start Workout
              </button>
            )}
            {(isRunning || workoutFinished) && (
              <button
                onClick={handleReset}
                className="bg-gray-600 text-white px-4 py-2 rounded font-bold text-xs hover:bg-gray-700"
              >
                🔄 Reset
              </button>
            )}
          </div>

          {/* RIGHT: tracker */}
          <div className="bg-black/30 border border-yellow-500 rounded-xl p-4">
            <h2 className="text-yellow-200 font-semibold text-sm mb-2">
              Skill Tracker
            </h2>

            <BallTouchTrackerFinal
              key={trackerKey}
              isActive={isRunning && !isResting}
              onTouchChange={setTouchCount}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
