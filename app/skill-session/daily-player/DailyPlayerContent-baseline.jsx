// 'use client';
export const dynamic = 'force-dynamic';"absolute inset-0 z-0 opacity-20 bg-cover bg-center pointer-events-none" style={{ backgroundImage: "url('/images/futuristic-football-bg.jpg'

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { sessionData } from '../../../lib/sessionData';
import { supabase } from '../../../lib/supabase';
import BallTouchTrackerFinal from '../../../components/BallTouchTrackerFinal';

export default function DailyPlayerPage() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionKeys = [params.get('sessionA'), params.get('sessionB')].filter(Boolean);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prepCountdown, setPrepCountdown] = useState(0);
  const [repCountdown, setRepCountdown] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [workoutFinished, setWorkoutFinished] = useState(false);
  const [currentRep, setCurrentRep] = useState(0);
  const [shouldStartAfterCountdown, setShouldStartAfterCountdown] = useState(false);
  const [finalTouchCount, setFinalTouchCount] = useState(0);
  const [player, setPlayer] = useState(null);

  const reps = 5;
  const workTime = 30;
  const restTime = 15;
  const skill = sessionData[sessionKeys[currentIndex]];
  const timerRef = useRef(null);

  useEffect(() => {
    const fetchPlayer = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: playerData } = await supabase
        .from('players')
        .select('*')
        .eq('auth_id', user.id)
        .single();
      setPlayer(playerData);
    };
    fetchPlayer();
  }, []);

  const handleStart = async () => {
    setShouldStartAfterCountdown(true);
    setPrepCountdown(3);
  };

  useEffect(() => {
    if (prepCountdown > 0) {
      timerRef.current = setTimeout(() => setPrepCountdown(p => p - 1), 1000);
    } else if (prepCountdown === 0 && shouldStartAfterCountdown && !isRunning && !workoutFinished) {
      setShouldStartAfterCountdown(false);
      startWorkout();
    }
    return () => clearTimeout(timerRef.current);
  }, [prepCountdown]);

  const startWorkout = async () => {
    setIsRunning(true);
    setCurrentRep(1);
    setRepCountdown(workTime);
  };

  useEffect(() => {
    if (!isRunning || isPaused || repCountdown <= 0) return;
    timerRef.current = setTimeout(() => setRepCountdown(t => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [repCountdown, isRunning, isPaused]);

  useEffect(() => {
    if (repCountdown === 0 && isRunning && !isPaused) {
      if (currentRep < reps) {
        setIsResting(true);
        setRepCountdown(restTime);
      } else {
        handleStop();
      }
    }
  }, [repCountdown, isRunning, isPaused]);

  useEffect(() => {
    if (isResting && repCountdown === 0) {
      setIsResting(false);
      setCurrentRep(r => r + 1);
      setRepCountdown(workTime);
    }
  }, [repCountdown, isResting]);

  const handleStop = async () => {
    clearTimeout(timerRef.current);
    setIsRunning(false);
    setIsPaused(false);
    setIsResting(false);

    if (currentIndex < sessionKeys.length - 1) {
      setCurrentIndex(i => i + 1);
      resetSession();
    } else {
      setWorkoutFinished(true);
      await awardXp();
    }
  };

  const resetSession = () => {
    setIsRunning(false);
    setIsPaused(false);
    setIsResting(false);
    setCurrentRep(0);
    setRepCountdown(0);
    setPrepCountdown(0);
    setShouldStartAfterCountdown(false);
    setWorkoutFinished(false);
  };

  const awardXp = async () => {
    if (!player) return;
    await supabase.from('workout_sessions').insert([{
      player_id: player.id,
      completed_at: new Date().toISOString(),
      skill_name: 'Daily Combo',
      reps,
      work_time: workTime,
      rest_time: restTime,
      touches: finalTouchCount,
      xr_awarded: 50
    }]);

    await supabase.from('players')
      .update({
        xp: (player.xp || 0) + 50,
        daily_streak: (player.daily_streak || 0) + 1,
        last_workout_date: new Date().toISOString()
      })
      .eq('id', player.id);
  };

  return (
    <main className="relative min-h-screen text-white px-4 py-6 bg-cover bg-center font-sans" style={{ backgroundImage: "url('/images/futuristic-football-bg.jpg')" }}>
      <div className="absolute inset-0 bg-black/60 z-0" />
      <div className="relative z-10 max-w-4xl mx-auto space-y-6">

        <div className="mb-2 hidden sm:flex">
          <button
            onClick={() => router.push('/skill-session')}
            className="text-white text-sm px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 transition"
          >
            ← Back to Skill Sessions
          </button>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-yellow-400 rounded-xl shadow-lg p-6 space-y-2">
          <h2 className="text-xl font-bold text-yellow-300 text-center">🔥 Daily Skill Session</h2>
          <ul className="text-sm text-center text-white space-y-1">
            {sessionKeys.map((key, i) => (
              <li key={key}>• {sessionData[key]?.title || `Skill ${i + 1}`}</li>
            ))}
          </ul>
          <div className="text-sm text-center text-gray-400 mt-2 space-y-1">
            <p>🔁 5 reps per drill</p>
            <p>⏱ ~{sessionKeys.length * 2.25} min total</p>
            <p>🏆 Earns <span className="text-white font-semibold">50 XP</span> and a streak boost</p>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6 space-y-6">
          <h1 className="text-2xl font-bold text-sky-300">{skill?.title}</h1>
          <p className="text-white">{skill?.description}</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div className="rounded-xl overflow-hidden shadow-md border border-white/10 bg-black/30 p-2">
              <video src={skill?.video} controls autoPlay muted loop className="w-full rounded-xl aspect-video object-cover" />
            </div>
            <div className="rounded-xl overflow-hidden shadow-md border border-white/10 bg-black/30 p-2">
              <BallTouchTrackerFinal
                isActive={isRunning && !isPaused && !isResting}
                onTouch={(touches) => setFinalTouchCount(t => t + touches)}
              />
            </div>
          </div>

          {!isRunning && !workoutFinished && prepCountdown === 0 && (
            <div className="text-center mt-6">
              <button
                onClick={handleStart}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:scale-105 transition"
              >
                ▶ Start Workout
              </button>
            </div>
          )}

          {prepCountdown > 0 && (
            <div className="text-center text-6xl font-bold text-sky-400 mt-10 animate-pulse">
              {prepCountdown}
            </div>
          )}

          {isRunning && (
            <div className="mt-6 text-center space-y-2">
              <p className="text-sm text-cyan-400">
                {isPaused ? '⏸ Paused' : isResting ? `💤 Rest (Next: Rep ${currentRep + 1})` : `🔥 Rep ${currentRep} of ${reps}`}
              </p>
              <p className="text-4xl font-bold text-green-300">{repCountdown}s</p>
              <div className="flex justify-center gap-4 mt-4">
                {!isPaused ? (
                  <button onClick={() => setIsPaused(true)} className="bg-yellow-500 px-4 py-2 rounded">Pause</button>
                ) : (
                  <button onClick={() => setIsPaused(false)} className="bg-blue-500 px-4 py-2 rounded">Resume</button>
                )}
                <button onClick={handleStop} className="bg-red-600 px-4 py-2 rounded">Stop</button>
              </div>
            </div>
          )}

          {workoutFinished && (
            <div className="mt-10 max-w-xl mx-auto bg-gradient-to-br from-green-700 to-emerald-600 text-white rounded-2xl shadow-xl p-6 text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-green-400 text-green-900 rounded-full p-2">✅</div>
                <h2 className="ml-3 text-2xl font-bold">Workout Complete!</h2>
              </div>
              <p className="text-lg font-medium">Total Touches: <span className="font-bold text-white">{finalTouchCount}</span></p>
              <p className="text-lg">Total Time: <span className="font-semibold text-white">{sessionKeys.length * 5 * (workTime + restTime) - restTime}s</span></p>
              <button
                onClick={() => location.reload()}
                className="mt-6 bg-white text-green-700 font-semibold px-6 py-2 rounded-full shadow hover:bg-green-100"
              >
                Start Again
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
