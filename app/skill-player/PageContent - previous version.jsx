'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { sessionData } from '../../lib/sessionData';
import { supabase } from '../../lib/supabase';
import dynamic from 'next/dynamic';

const FootballTouchTracker = dynamic(() => import('../../components/FootballTouchTracker'), { ssr: false });

export default function PageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionKey = params.get('session');
  const skill = sessionData[sessionKey];

  const [reps, setReps] = useState(5);
  const [timePerRep, setTimePerRep] = useState(30);
  const [restTime, setRestTime] = useState(15);
  const [prepCountdown, setPrepCountdown] = useState(0);
  const [repCountdown, setRepCountdown] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [currentRep, setCurrentRep] = useState(0);
  const [trackerActive, setTrackerActive] = useState(true);
  const [shouldStartAfterCountdown, setShouldStartAfterCountdown] = useState(false);
  const [workoutFinished, setWorkoutFinished] = useState(false);
  const [finalTouchCount, setFinalTouchCount] = useState(0);
  const [player, setPlayer] = useState(null);

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
    try {
      await fetch('http://localhost:5000/init');
    } catch {}
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
    setFinalTouchCount(0);
    setTrackerActive(true);
  };

  const startWorkout = async () => {
    setIsRunning(true);
    setCurrentRep(1);
    setRepCountdown(timePerRep);
    await fetch('http://localhost:5000/start').catch(() => {});
  };

  const handleStop = async () => {
    clearTimeout(timerRef.current);
    setIsRunning(false);
    setIsPaused(false);
    setIsResting(false);
    setTrackerActive(false);

    let touches = 0;
    try {
      const res = await fetch('http://localhost:5000/touches');
      const data = await res.json();
      touches = data?.touches || 0;
    } catch {
      alert('Could not retrieve touch data.');
    }

    await fetch('http://localhost:5000/stop').catch(() => {});

    if (touches > 0) {
      setFinalTouchCount(touches);
      setWorkoutFinished(true);
      await supabase.from('workout_sessions').insert([{
        player_id: player?.id,
        completed_at: new Date().toISOString(),
        skill_name: skill?.title,
        reps,
        work_time: timePerRep,
        rest_time: restTime,
        touches,
        xr_awarded: 15,
      }]);
    } else {
      resetSession();
    }
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
        (async () => await fetch('http://localhost:5000/pause').catch(() => {}))();
      } else {
        handleStop();
      }
    }
  }, [repCountdown, isRunning, isPaused]);

  useEffect(() => {
    if (isResting && repCountdown === 0) {
      setIsResting(false);
      setCurrentRep(r => r + 1);
      setRepCountdown(timePerRep);
      (async () => await fetch('http://localhost:5000/resume').catch(() => {}))();
    }
  }, [repCountdown, isResting]);

  if (!sessionKey || !skill) {
    return <div className="text-white p-6">Skill not found 🚫</div>;
  }

  return (
    <main className="relative min-h-screen text-white px-4 py-6 font-sans bg-cover bg-center" style={{ backgroundImage: "url('/images/futuristic-football-bg.jpg')" }}>
      <div className="absolute inset-0 bg-black/60 z-0" />
      <div className="relative z-10 max-w-4xl mx-auto space-y-6">

        {/* Back Button */}
        <div className="mb-2 hidden sm:flex">
          <button
            onClick={() => router.push('/skill-session')}
            className="text-white text-sm px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 transition"
          >
            ← Back to Skill Sessions
          </button>
        </div>

        {/* Title Box */}
        <div className="bg-white/5 backdrop-blur-md border border-yellow-400 rounded-xl shadow-lg p-6 space-y-2">
          <h2 className="text-xl font-bold text-yellow-300 text-center">{skill.title}</h2>
          <p className="text-center text-sm text-gray-300">{skill.description}</p>
        </div>

        {/* Main Section: Video + Tracker + Inputs */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <video src={skill.video} controls autoPlay muted loop className="w-full rounded-xl aspect-video object-cover border border-white/10" />
            <div className="rounded-xl border border-white/10 p-2 bg-black/30">
              <FootballTouchTracker active={trackerActive} onTouchDetected={() => {}} />
            </div>
          </div>

          {/* Inputs */}
          {!isRunning && !workoutFinished && prepCountdown === 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-white">
                <div>
                  <label className="block mb-1">Reps</label>
                  <input type="number" min="1" value={reps} onChange={e => setReps(Number(e.target.value))} className="w-full rounded px-2 py-1 bg-white/10 border border-white/20" />
                </div>
                <div>
                  <label className="block mb-1">Work Time (sec)</label>
                  <input type="number" min="5" value={timePerRep} onChange={e => setTimePerRep(Number(e.target.value))} className="w-full rounded px-2 py-1 bg-white/10 border border-white/20" />
                </div>
                <div>
                  <label className="block mb-1">Rest Time (sec)</label>
                  <input type="number" min="5" value={restTime} onChange={e => setRestTime(Number(e.target.value))} className="w-full rounded px-2 py-1 bg-white/10 border border-white/20" />
                </div>
              </div>
              <div className="text-center mt-4">
                <button onClick={handleStart} className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded shadow text-white">Start</button>
              </div>
            </>
          )}

          {prepCountdown > 0 && (
            <div className="text-center text-6xl font-bold text-sky-400 mt-10 animate-pulse">
              {prepCountdown}
            </div>
          )}

          {isRunning && (
            <div className="text-center space-y-2 mt-6">
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
              <h2 className="text-2xl font-bold mb-4">✅ Workout Complete</h2>
              <p className="text-lg font-medium">Total Touches: <span className="font-bold">{finalTouchCount}</span></p>
              <p className="text-lg">Total Time: <span className="font-semibold">{reps * (timePerRep + restTime) - restTime}s</span></p>
              <button onClick={resetSession} className="mt-6 bg-white text-green-700 font-semibold px-6 py-2 rounded-full hover:bg-green-100">Start Again</button>
            </div>
          )}
        </div>

        {/* Skill Carousel */}
        <div className="mt-10">
          <h2 className="text-xl font-bold text-sky-400 mb-2">Unlocked Skills</h2>
          <div className="relative">
            <button onClick={() => document.getElementById('scroll-unlocked').scrollBy({ left: -300, behavior: 'smooth' })} className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 px-2 py-1 rounded-r">←</button>
            <button onClick={() => document.getElementById('scroll-unlocked').scrollBy({ left: 300, behavior: 'smooth' })} className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 px-2 py-1 rounded-l">→</button>
            <div id="scroll-unlocked" className="overflow-x-auto no-scrollbar flex space-x-4 p-1">
              {Object.entries(sessionData)
                .filter(([_, info]) => player?.points >= info.unlockXP)
                .map(([key, info]) => {
                  const isNew = info.unlockedAt && (Date.now() - new Date(info.unlockedAt).getTime()) < 7 * 24 * 60 * 60 * 1000;
                  return (
                    <div key={key} onClick={() => router.push(`/skill-player?session=${key}`)} className="min-w-[180px] max-w-[180px] bg-black/40 border border-white/10 rounded-lg shadow hover:shadow-lg cursor-pointer relative">
                      {isNew && (
                        <span className="absolute top-2 left-2 bg-yellow-300 text-black text-xs font-bold px-2 py-1 rounded">NEW</span>
                      )}
                      <video src={info.video} muted loop className="w-full aspect-video object-cover rounded-t-lg" />
                      <div className="p-2 text-xs font-medium text-white truncate text-center">{info.title}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        <style jsx>{`
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      </div>
    </main>
  );
}
