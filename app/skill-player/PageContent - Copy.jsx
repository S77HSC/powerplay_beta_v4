// PageContent.jsx — patching Supabase logging logic

'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { sessionData } from '../../lib/sessionData';
import { supabase } from '../../lib/supabase';

const BallTouchTrackerFinal = dynamic(() => import('../../components/BallTouchTrackerFinal'), { ssr: false });

export default function PageContent() {
  const [reps, setReps] = useState(5);
  const [timePerRep, setTimePerRep] = useState(30);
  const [restTime, setRestTime] = useState(15);

  const [prepCountdown, setPrepCountdown] = useState(0);
  const [repCountdown, setRepCountdown] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [currentRep, setCurrentRep] = useState(0);

  const [shouldStartAfterCountdown, setShouldStartAfterCountdown] = useState(false);
  const [workoutFinished, setWorkoutFinished] = useState(false);
  const [completed, setCompleted] = useState(false);

  const [touchCount, setTouchCount] = useState(0);
  const [finalTouchCount, setFinalTouchCount] = useState(0);

  const timerRef = useRef(null);
  const searchParams = useSearchParams();
  const sessionKey = searchParams.get('session');
  const session = sessionData[sessionKey];

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

  const handleComplete = async (touches) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !sessionKey) return;

      const { data: player, error: playerErr } = await supabase
        .from('players')
        .select('id, points')
        .eq('auth_id', user.id)
        .single();
      if (playerErr || !player) throw playerErr;

      await supabase.from('workout_sessions').insert([
        {
          player_id: player.id,
          session_key: sessionKey,
          skill_name: session.title,
          reps: reps,
          completed_at: new Date().toISOString(),
          touches: touches,
        },
      ]);

      await supabase
        .from('players')
        .update({ points: player.points + session.xp })
        .eq('id', player.id);

      setCompleted(true);
    } catch (err) {
      console.error('Workout log failed', err);
    }
  };

  if (!session) {
    return (
      <div className="text-white text-center p-8">
        <h2 className="text-lg font-bold">Session not found.</h2>
      </div>
    );
  }

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
          <p className="text-sm text-gray-300">Train like a pro. Track your skills. Earn your XP.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-black/30 border border-yellow-500 rounded-xl p-4 flex flex-col gap-4">
            <video src={session.video} controls className="w-full rounded-md h-[240px] md:h-[320px] object-cover" />

            <div className="grid grid-cols-3 gap-4 text-xs">
              <label className="flex flex-col gap-1">
                <span>Reps:</span>
                <input type="number" value={reps} onChange={(e) => setReps(Number(e.target.value))} className="w-full bg-gray-800 border border-yellow-500 rounded px-2 py-1" />
              </label>
              <label className="flex flex-col gap-1">
                <span>Time/Rep (s):</span>
                <input type="number" value={timePerRep} onChange={(e) => setTimePerRep(Number(e.target.value))} className="w-full bg-gray-800 border border-yellow-500 rounded px-2 py-1" />
              </label>
              <label className="flex flex-col gap-1">
                <span>Rest Time (s):</span>
                <input type="number" value={restTime} onChange={(e) => setRestTime(Number(e.target.value))} className="w-full bg-gray-800 border border-yellow-500 rounded px-2 py-1" />
              </label>
            </div>

            <div className="mt-4">
              <h3 className="text-yellow-300 font-semibold text-sm uppercase mb-1">{session.title}</h3>
              <p className="text-gray-300 text-xs leading-relaxed">{session.description}</p>
            </div>

            <div className="text-center mt-4 space-y-2">
              {prepCountdown > 0 && <p className="text-lime-300">Get Ready: {prepCountdown}s</p>}
              {isResting && <p className="text-blue-300">Resting…</p>}
              {isRunning && !isResting && <p className="text-lime-400">Rep {currentRep} — {repCountdown}s left</p>}
              {workoutFinished && (
                <p className="text-green-400">
                  Workout complete! Touches: {finalTouchCount}
                </p>
              )}

              {!isRunning && !workoutFinished && (
                <button onClick={() => { setPrepCountdown(5); setShouldStartAfterCountdown(true); }} className="bg-yellow-400 text-black px-4 py-2 rounded font-bold text-xs hover:bg-yellow-500">▶ Start Workout</button>
              )}
              {isRunning && !isPaused && <button onClick={() => setIsPaused(true)} className="bg-orange-400 text-black px-4 py-1 rounded text-xs">⏸ Pause</button>}
              {isRunning && isPaused && <button onClick={() => setIsPaused(false)} className="bg-green-400 text-black px-4 py-1 rounded text-xs">▶ Resume</button>}
              {(isRunning || workoutFinished) && <button onClick={() => { setIsRunning(false); setIsPaused(false); setWorkoutFinished(false); setCurrentRep(0); setRepCountdown(0); setPrepCountdown(0); }} className="bg-red-500 text-white px-4 py-1 rounded text-xs">🔄 Reset</button>}
            </div>
          </div>

          <div className="bg-black/30 border border-yellow-500 rounded-xl p-4 flex flex-col">
            <h2 className="text-yellow-200 font-semibold text-sm mb-2">Skill Tracker</h2>
            <BallTouchTrackerFinal isActive={isRunning && !isResting} onTouchChange={setTouchCount} />
          </div>
        </div>
      </div>
    </main>
  );
}